/**
 * Unit tests for trial-nudge engagement trigger (sym-6ga, Trial follow-up approach B).
 *
 * Covers:
 * - stage derivation (total 1 -> low, 0 -> zero, >=2 / free_credit_granted=false -> skip)
 * - eligibility (purchased excluded, notifications disabled excluded, not linked /
 *   banned / onboarding-incomplete excluded)
 * - all-time dedup (existing trial-low row excludes low again; trial-zero independent)
 * - message generators (AI failure -> fallback; ru/en/zh present; low vs zero tones differ)
 *
 * Mirrors the supabase-mock style of tests/unit/modules/credits.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// Mocks (must be declared before importing the module under test)
// -----------------------------------------------------------------------------

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Logger is imported via a relative path in the source, so mock it explicitly
// (the global setup mock targets the @/ alias which won't match relative imports).
vi.mock("../../../src/core/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

// Mock the LLM model factory so AI generation is deterministic / failable.
const mockInvoke = vi.fn();
vi.mock("../../../src/core/langchain/models.js", () => ({
  createModel: vi.fn(() => ({ invoke: mockInvoke })),
}));

import {
  findTrialNudgeUsers,
  createTrialNudgeMessage,
  type TrialNudgeUser,
} from "../../../src/modules/engagement/triggers/trial-nudge.js";

// -----------------------------------------------------------------------------
// Supabase mock helpers
// -----------------------------------------------------------------------------

type CreditRow = {
  credits_basic: number;
  credits_pro: number;
  credits_cassandra: number;
  unified_user_id: string;
  unified_users: unknown;
};

type LogRow = { telegram_id: number; message_type: string };

interface MockData {
  /** Rows returned from unified_user_credits join query. */
  creditRows: CreditRow[];
  /** unified_user_ids that have a purchase credit_transaction. */
  purchasedUserIds: string[];
  /** Prior engagement_log rows (any date) for trial-low / trial-zero. */
  engagementLog: LogRow[];
  /** Force an error from a specific table query. */
  errors?: Partial<Record<string, { message: string }>>;
}

/**
 * Build a supabase.from() dispatcher matching the three queries the finder runs:
 * - unified_user_credits: select(...).eq('free_credit_granted', true)
 * - credit_transactions:  select(...).eq('transaction_type', 'purchase')
 * - engagement_log:       select(...).in('message_type', [...])
 */
function setupSupabase(data: MockData): void {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "unified_user_credits") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: data.errors?.unified_user_credits ? null : data.creditRows,
            error: data.errors?.unified_user_credits ?? null,
          }),
        }),
      };
    }

    if (table === "credit_transactions") {
      // Source chains .select(...).eq('transaction_type','purchase').in('unified_user_id', ids)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: data.errors?.credit_transactions
                ? null
                : data.purchasedUserIds.map((id) => ({ unified_user_id: id })),
              error: data.errors?.credit_transactions ?? null,
            }),
          }),
        }),
      };
    }

    if (table === "engagement_log") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: data.errors?.engagement_log ? null : data.engagementLog,
            error: data.errors?.engagement_log ?? null,
          }),
        }),
      };
    }

    throw new Error(`Unexpected table in mock: ${table}`);
  });
}

/** Eligible embedded unified_users object with sensible defaults. */
function eligibleUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "uuid-1",
    telegram_id: 111,
    display_name: "Тест",
    language_code: "ru",
    is_telegram_linked: true,
    is_banned: false,
    onboarding_completed: true,
    notification_settings: { enabled: true },
    ...overrides,
  };
}

/** Build a credit row with a given balance split + embedded user. */
function creditRow(
  total: { basic: number; pro: number; cassandra: number },
  unifiedUserId: string,
  user: unknown
): CreditRow {
  return {
    credits_basic: total.basic,
    credits_pro: total.pro,
    credits_cassandra: total.cassandra,
    unified_user_id: unifiedUserId,
    unified_users: user,
  };
}

describe("trial-nudge: findTrialNudgeUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("stage derivation", () => {
    it("derives 'low' when total welcome balance is 1", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 1, pro: 0, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
      expect(result[0]!.stage).toBe("low");
      expect(result[0]!.user.telegramId).toBe(111);
    });

    it("derives 'zero' when total welcome balance is 0", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 0, pro: 0, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
      expect(result[0]!.stage).toBe("zero");
    });

    it("skips users with total balance >= 2", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 1, pro: 1, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("sums all three credit buckets to compute total", async () => {
      // basic 0 + pro 0 + cassandra 1 = 1 -> low
      setupSupabase({
        creditRows: [creditRow({ basic: 0, pro: 0, cassandra: 1 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
      expect(result[0]!.stage).toBe("low");
    });
  });

  describe("eligibility", () => {
    it("excludes purchased users (credit_transactions purchase row)", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 0, pro: 0, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: ["uuid-1"],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("excludes users with notifications disabled", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ notification_settings: { enabled: false } })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("excludes users who are not telegram-linked", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ is_telegram_linked: false })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("excludes banned users", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ is_banned: true })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("excludes users with onboarding not completed", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ onboarding_completed: false })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("excludes users with null telegram_id", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ telegram_id: null })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("treats notification_settings === null as enabled", async () => {
      setupSupabase({
        creditRows: [
          creditRow(
            { basic: 0, pro: 0, cassandra: 0 },
            "uuid-1",
            eligibleUser({ notification_settings: null })
          ),
        ],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
    });

    it("normalizes embedded relation when supabase returns it as an array", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 0, pro: 0, cassandra: 0 }, "uuid-1", [eligibleUser()])],
        purchasedUserIds: [],
        engagementLog: [],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
      expect(result[0]!.user.id).toBe("uuid-1");
    });
  });

  describe("all-time dedup", () => {
    it("excludes a user already nudged at the same stage (any date)", async () => {
      setupSupabase({
        creditRows: [creditRow({ basic: 1, pro: 0, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        // Prior trial-low row for telegram 111 -> must be excluded from low.
        engagementLog: [{ telegram_id: 111, message_type: "trial-low" }],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(0);
    });

    it("treats trial-zero as independent of trial-low", async () => {
      // User now at zero; previously got trial-low. Should still get trial-zero.
      setupSupabase({
        creditRows: [creditRow({ basic: 0, pro: 0, cassandra: 0 }, "uuid-1", eligibleUser())],
        purchasedUserIds: [],
        engagementLog: [{ telegram_id: 111, message_type: "trial-low" }],
      });

      const result = await findTrialNudgeUsers();

      expect(result).toHaveLength(1);
      expect(result[0]!.stage).toBe("zero");
    });
  });

  describe("error handling", () => {
    it("throws when the credits query fails", async () => {
      setupSupabase({
        creditRows: [],
        purchasedUserIds: [],
        engagementLog: [],
        errors: { unified_user_credits: { message: "boom" } },
      });

      await expect(findTrialNudgeUsers()).rejects.toThrow();
    });

    it("returns empty array when no credit rows", async () => {
      setupSupabase({ creditRows: [], purchasedUserIds: [], engagementLog: [] });

      const result = await findTrialNudgeUsers();

      expect(result).toEqual([]);
    });
  });
});

describe("trial-nudge: createTrialNudgeMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AI text for ru when generation succeeds", async () => {
    mockInvoke.mockResolvedValue({ content: "🔮 Тёплое сообщение от Арины про кредиты ☕" });

    const msg = await createTrialNudgeMessage("low", "Игорь", "ru");

    expect(msg).toContain("Арины");
    expect(mockInvoke).toHaveBeenCalledOnce();
  });

  it("falls back to localized text when AI generation fails (ru)", async () => {
    mockInvoke.mockRejectedValue(new Error("model down"));

    const msg = await createTrialNudgeMessage("zero", "Игорь", "ru");

    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("provides distinct fallback tones for low vs zero (ru)", async () => {
    mockInvoke.mockRejectedValue(new Error("model down"));

    const low = await createTrialNudgeMessage("low", "Игорь", "ru");
    const zero = await createTrialNudgeMessage("zero", "Игорь", "ru");

    expect(low).not.toBe(zero);
  });

  it("uses fallback (no AI) for non-ru languages", async () => {
    const en = await createTrialNudgeMessage("low", "Igor", "en");
    const zh = await createTrialNudgeMessage("low", "Igor", "zh");

    expect(en.length).toBeGreaterThan(0);
    expect(zh.length).toBeGreaterThan(0);
    // AI must not be invoked for non-ru.
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("covers all three locales for both stages", async () => {
    for (const lang of ["ru", "en", "zh"]) {
      // Force fallback path for ru too by failing the model.
      mockInvoke.mockRejectedValue(new Error("model down"));
      for (const stage of ["low", "zero"] as const) {
        const msg = await createTrialNudgeMessage(stage, "Имя", lang);
        expect(msg.length).toBeGreaterThan(0);
      }
    }
  });

  it("handles a null user name gracefully", async () => {
    const msg = await createTrialNudgeMessage("zero", null, "en");
    expect(msg.length).toBeGreaterThan(0);
  });
});

// Type-level smoke check: the exported interface shape is what wiring expects.
describe("trial-nudge: exported types", () => {
  it("TrialNudgeUser carries user + stage", () => {
    const sample: TrialNudgeUser = {
      stage: "low",
      user: {
        id: "x",
        telegramId: 1,
        displayName: null,
        languageCode: "ru",
        lastActiveAt: new Date(),
      },
    };
    expect(sample.stage).toBe("low");
  });
});
