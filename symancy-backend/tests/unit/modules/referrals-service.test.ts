/**
 * Unit tests for referral service
 *
 * Mocks the service-role supabase client (core/database.js getSupabase),
 * following the pattern used in tests/unit/modules/credits.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOrCreateCode,
  getStats,
  captureReferral,
  attributeRefereeSignup,
  rewardReferrerOnActivation,
} from "../../../src/modules/referrals/service.js";

// Mock Supabase client (only .rpc is used by the referral service)
const mockSupabase = {
  rpc: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

const UID = "11111111-1111-1111-1111-111111111111";
const REFEREE_TG = 123456789;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateCode", () => {
  it("returns the code from the scalar text RPC", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: "ABCD1234", error: null });
    const code = await getOrCreateCode(UID);
    expect(code).toBe("ABCD1234");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_or_create_referral_code", {
      p_unified_user_id: UID,
    });
  });

  it("returns null when the RPC errors", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await getOrCreateCode(UID)).toBeNull();
  });

  it("returns null for invalid input without calling RPC", async () => {
    expect(await getOrCreateCode("")).toBeNull();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe("getStats", () => {
  it("maps the jsonb stats object with defaults", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { code: "ABCD1234", invited: 5, activated: 2, credits_earned: 2, pending: 3 },
      error: null,
    });
    const stats = await getStats(UID);
    expect(stats).toEqual({
      code: "ABCD1234",
      invited: 5,
      activated: 2,
      credits_earned: 2,
      pending: 3,
    });
  });

  it("coerces missing fields to safe defaults", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { code: null }, error: null });
    const stats = await getStats(UID);
    expect(stats).toEqual({
      code: null,
      invited: 0,
      activated: 0,
      credits_earned: 0,
      pending: 0,
    });
  });

  it("returns null on RPC error", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await getStats(UID)).toBeNull();
  });
});

describe("captureReferral", () => {
  it("returns ok:true on successful capture", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const res = await captureReferral("ABCD1234", REFEREE_TG);
    expect(res).toEqual({ ok: true });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("capture_referral", {
      p_code: "ABCD1234",
      p_referee_telegram_id: REFEREE_TG,
    });
  });

  it("passes through a business reason (self_referral)", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { ok: false, reason: "self_referral" },
      error: null,
    });
    const res = await captureReferral("ABCD1234", REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "self_referral" });
  });

  it("returns rpc_error on RPC failure (never throws)", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    const res = await captureReferral("ABCD1234", REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "rpc_error" });
  });

  it("rejects an empty code without calling RPC", async () => {
    const res = await captureReferral("", REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "invalid_code" });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe("attributeRefereeSignup", () => {
  it("returns ok with credited on success", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: true, credited: 1 }, error: null });
    const res = await attributeRefereeSignup(REFEREE_TG, UID);
    expect(res).toEqual({ ok: true, credited: 1 });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("attribute_referee_signup", {
      p_referee_telegram_id: REFEREE_TG,
      p_referee_unified_user_id: UID,
    });
  });

  it("passes through no_pending reason", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { ok: false, reason: "no_pending" },
      error: null,
    });
    const res = await attributeRefereeSignup(REFEREE_TG, UID);
    expect(res).toEqual({ ok: false, reason: "no_pending" });
  });

  it("returns rpc_error on failure", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const res = await attributeRefereeSignup(REFEREE_TG, UID);
    expect(res).toEqual({ ok: false, reason: "rpc_error" });
  });
});

describe("rewardReferrerOnActivation", () => {
  it("returns ok with credited on reward", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: true, credited: 1 }, error: null });
    const res = await rewardReferrerOnActivation(REFEREE_TG);
    expect(res).toEqual({ ok: true, credited: 1 });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("reward_referrer_on_activation", {
      p_referee_telegram_id: REFEREE_TG,
    });
  });

  it("passes through monthly_limit reason", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { ok: false, reason: "monthly_limit" },
      error: null,
    });
    const res = await rewardReferrerOnActivation(REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "monthly_limit" });
  });

  it("passes through nothing_to_reward reason", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { ok: false, reason: "nothing_to_reward" },
      error: null,
    });
    const res = await rewardReferrerOnActivation(REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "nothing_to_reward" });
  });

  it("unwraps an array-wrapped jsonb row", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [{ ok: true, credited: 1 }], error: null });
    const res = await rewardReferrerOnActivation(REFEREE_TG);
    expect(res).toEqual({ ok: true, credited: 1 });
  });

  it("returns rpc_error on failure", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const res = await rewardReferrerOnActivation(REFEREE_TG);
    expect(res).toEqual({ ok: false, reason: "rpc_error" });
  });
});
