/**
 * Integration test for the referral program service lifecycle.
 *
 * Exercises the full happy-path through the thin service wrappers against a
 * stateful in-memory mock of the Postgres RPCs:
 *   capture -> signup attribution -> activation reward -> idempotent re-reward
 *   -> monthly limit.
 *
 * The mock mimics the documented RPC contract and persists a tiny bit of state
 * between calls so idempotency and the monthly limit can be asserted end-to-end
 * through the real service code.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  captureReferral,
  attributeRefereeSignup,
  rewardReferrerOnActivation,
  getStats,
  getOrCreateCode,
} from "@/modules/referrals/service.js";

// ---------------------------------------------------------------------------
// Stateful RPC mock
// ---------------------------------------------------------------------------

const REFERRER_UID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REFEREE_UID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REFERRER_CODE = "REF12345";
const REFEREE_TG = 555000111;

interface RefState {
  captured: boolean;
  attributed: boolean;
  rewardsThisMonth: number;
  rewarded: boolean; // whether THIS referee already produced a reward
}

// Test uses limit=1 for brevity; production DB enforces limit=5 per rolling
// 30 days (see migration supabase/migrations/20260527114605_referral_program.sql,
// reward_referrer_on_activation).
const MONTHLY_LIMIT = 1;
let state: RefState;

function resetState() {
  state = { captured: false, attributed: false, rewardsThisMonth: 0, rewarded: false };
}

const mockSupabase = {
  rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
    switch (name) {
      case "get_or_create_referral_code":
        return { data: REFERRER_CODE, error: null };

      case "capture_referral": {
        if (params.p_code !== REFERRER_CODE) {
          return { data: { ok: false, reason: "invalid_code" }, error: null };
        }
        if (state.captured) {
          return { data: { ok: false, reason: "already_captured" }, error: null };
        }
        state.captured = true;
        return { data: { ok: true }, error: null };
      }

      case "attribute_referee_signup": {
        if (!state.captured) {
          return { data: { ok: false, reason: "no_pending" }, error: null };
        }
        if (state.attributed) {
          // Already attributed -> nothing new to credit
          return { data: { ok: true, credited: 0 }, error: null };
        }
        state.attributed = true;
        return { data: { ok: true, credited: 1 }, error: null };
      }

      case "reward_referrer_on_activation": {
        if (!state.attributed) {
          return { data: { ok: false, reason: "nothing_to_reward" }, error: null };
        }
        if (state.rewarded) {
          // Idempotent: this referee was already rewarded
          return { data: { ok: false, reason: "nothing_to_reward" }, error: null };
        }
        if (state.rewardsThisMonth >= MONTHLY_LIMIT) {
          return { data: { ok: false, reason: "monthly_limit" }, error: null };
        }
        state.rewarded = true;
        state.rewardsThisMonth += 1;
        return { data: { ok: true, credited: 1 }, error: null };
      }

      case "get_referral_stats": {
        return {
          data: {
            code: REFERRER_CODE,
            invited: state.captured ? 1 : 0,
            activated: state.rewarded ? 1 : 0,
            credits_earned: state.rewardsThisMonth,
            pending: state.captured && !state.attributed ? 1 : 0,
          },
          error: null,
        };
      }

      default:
        return { data: null, error: { message: `unexpected RPC ${name}` } };
    }
  }),
};

vi.mock("@/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

beforeEach(() => {
  resetState();
  mockSupabase.rpc.mockClear();
});

describe("referral lifecycle (integration)", () => {
  it("captures, attributes signup, rewards activation, then is idempotent", async () => {
    // 1) Referrer obtains a code
    const code = await getOrCreateCode(REFERRER_UID);
    expect(code).toBe(REFERRER_CODE);

    // 2) Referee taps the deep link -> capture succeeds
    const capture = await captureReferral(REFERRER_CODE, REFEREE_TG);
    expect(capture).toEqual({ ok: true });

    // 3) Referee finishes onboarding -> signup attributed, +1 basic
    const signup = await attributeRefereeSignup(REFEREE_TG, REFEREE_UID);
    expect(signup).toEqual({ ok: true, credited: 1 });

    // 4) Referee activates (first completed analysis) -> referrer rewarded
    const reward1 = await rewardReferrerOnActivation(REFEREE_TG);
    expect(reward1).toEqual({ ok: true, credited: 1 });

    // 5) Subsequent activations are idempotent (no double reward)
    const reward2 = await rewardReferrerOnActivation(REFEREE_TG);
    expect(reward2.ok).toBe(false);
    expect(reward2.reason).toBe("nothing_to_reward");

    // Stats reflect the completed flow
    const stats = await getStats(REFERRER_UID);
    expect(stats).toEqual({
      code: REFERRER_CODE,
      invited: 1,
      activated: 1,
      credits_earned: 1,
      pending: 0,
    });
  });

  it("rejects self/invalid capture and double capture", async () => {
    const bad = await captureReferral("WRONGCODE", REFEREE_TG);
    expect(bad).toEqual({ ok: false, reason: "invalid_code" });

    const ok = await captureReferral(REFERRER_CODE, REFEREE_TG);
    expect(ok).toEqual({ ok: true });

    const again = await captureReferral(REFERRER_CODE, REFEREE_TG);
    expect(again).toEqual({ ok: false, reason: "already_captured" });
  });

  it("enforces a monthly reward limit across distinct referees", async () => {
    // Set up first referee fully through reward (consumes the monthly slot)
    await captureReferral(REFERRER_CODE, REFEREE_TG);
    await attributeRefereeSignup(REFEREE_TG, REFEREE_UID);
    const first = await rewardReferrerOnActivation(REFEREE_TG);
    expect(first).toEqual({ ok: true, credited: 1 });

    // Simulate a second, distinct referee who is attributed but the referrer
    // has already hit the monthly limit. Re-open attribution state and clear
    // the per-referee rewarded flag to model a different referee.
    state.rewarded = false; // different referee, not yet rewarded
    const limited = await rewardReferrerOnActivation(REFEREE_TG);
    expect(limited.ok).toBe(false);
    expect(limited.reason).toBe("monthly_limit");
  });

  it("returns no_pending when attributing without a prior capture", async () => {
    const res = await attributeRefereeSignup(REFEREE_TG, REFEREE_UID);
    expect(res).toEqual({ ok: false, reason: "no_pending" });
  });
});
