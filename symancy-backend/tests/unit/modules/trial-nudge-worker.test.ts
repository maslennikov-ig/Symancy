/**
 * Unit tests for processTrialNudge (Trial follow-up wiring, sym-g5xm).
 *
 * Focused on the worker's grouping + dispatch behaviour:
 *  (a) empty finder result -> sendBatchEngagementMessages is never called
 *  (b) mixed stages -> sendBatchEngagementMessages called once per non-empty
 *      stage group with the correct message_type ("trial-low" / "trial-zero")
 *      and the createTariffPickerKeyboard() result threaded as replyMarkup.
 *
 * Mirrors the relative-import mock style of trial-nudge.test.ts (worker.ts
 * imports its deps via relative paths, not the @/ alias, so the global setup
 * mock won't match — every relative dep used at module-load is mocked here).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// Mocks (declared before importing the module under test)
// -----------------------------------------------------------------------------

// Logger: worker.ts imports "../../core/logger.js" (relative, bypasses @/ mock).
// Use a plain self-referential stub (not vi.fn methods) so the global
// afterEach restoreAllMocks() doesn't strip .child off the module-level logger
// captured by worker.ts at import time.
vi.mock("../../../src/core/logger.js", () => {
  const stub: Record<string, unknown> = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
  stub.child = () => stub;
  return { getLogger: () => stub };
});

// Database / queue / metrics are pulled in at module load by worker.ts but are
// not exercised by processTrialNudge — stub them so nothing real connects.
vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(),
  getPool: vi.fn(),
}));
vi.mock("../../../src/core/queue.js", () => ({
  registerWorker: vi.fn(),
}));
vi.mock("../../../src/services/metrics.service.js", () => ({
  recordMetric: vi.fn(),
  recordMetricBatch: vi.fn(),
  startTimer: vi.fn(() => 0),
  recordDuration: vi.fn(),
}));

// Sibling triggers / chains imported by worker.ts (unused here) — stub to avoid
// loading langchain / supabase-backed modules.
vi.mock("../../../src/modules/engagement/triggers/inactive.js", () => ({
  createInactiveReminderMessage: vi.fn(),
}));
vi.mock("../../../src/modules/engagement/triggers/weekly-checkin.js", () => ({
  createWeeklyCheckInMessage: vi.fn(),
}));
vi.mock("../../../src/modules/engagement/triggers/photo-cleanup.js", () => ({
  cleanupExpiredPhotos: vi.fn(),
}));
vi.mock("../../../src/modules/engagement/triggers/streak-at-risk.js", () => ({
  findStreakAtRiskUsers: vi.fn(),
  createStreakAtRiskMessage: vi.fn(),
}));
vi.mock("../../../src/chains/daily-insight.chain.js", () => ({
  generateMorningAdvice: vi.fn(),
  generateEveningInsight: vi.fn(),
  generateWithRetry: vi.fn(),
}));
vi.mock("../../../src/modules/engagement/triggers/static-insights.js", () => ({
  getStaticMorningInsight: vi.fn(),
  getStaticEveningInsight: vi.fn(),
}));
vi.mock("../../../src/modules/engagement/dispatcher.js", () => ({
  dispatchMorningInsights: vi.fn(),
  dispatchEveningInsights: vi.fn(),
  getTodayInTimezone: vi.fn(),
}));

// --- The mocks that matter for these tests -----------------------------------
// vi.mock factories are hoisted above all top-level code, so the spies they
// reference must be created via vi.hoisted (also hoisted) to avoid TDZ errors.

const FAKE_KEYBOARD = { inline_keyboard: [[{ text: "buy", callback_data: "buy:basic" }]] };

const {
  mockSendBatch,
  mockFindTrialNudgeUsers,
  mockCreateTrialNudgeMessage,
  mockCreateTariffPickerKeyboard,
} = vi.hoisted(() => ({
  mockSendBatch: vi.fn(),
  mockFindTrialNudgeUsers: vi.fn(),
  mockCreateTrialNudgeMessage: vi.fn((stage: string) => `msg-${stage}`),
  mockCreateTariffPickerKeyboard: vi.fn(),
}));

vi.mock("../../../src/services/proactive/index.js", () => ({
  getProactiveMessageService: vi.fn(() => ({
    sendBatchEngagementMessages: mockSendBatch,
  })),
}));

vi.mock("../../../src/modules/engagement/triggers/trial-nudge.js", () => ({
  findTrialNudgeUsers: mockFindTrialNudgeUsers,
  createTrialNudgeMessage: mockCreateTrialNudgeMessage,
}));

vi.mock("../../../src/modules/payments/keyboards.js", () => ({
  createTariffPickerKeyboard: mockCreateTariffPickerKeyboard,
}));

import { processTrialNudge } from "../../../src/modules/engagement/worker.js";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeUser(id: string, telegramId: number) {
  return {
    id,
    telegramId,
    displayName: `User ${id}`,
    languageCode: "ru",
    lastActiveAt: new Date(),
  };
}

// Minimal pg-boss Job stub (only .id is read).
const fakeJob = { id: "job-trial-nudge-1" } as never;

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("processTrialNudge", () => {
  beforeEach(() => {
    mockSendBatch.mockReset();
    mockFindTrialNudgeUsers.mockReset();
    mockCreateTrialNudgeMessage.mockClear();
    mockCreateTrialNudgeMessage.mockImplementation((stage: string) => `msg-${stage}`);
    mockCreateTariffPickerKeyboard.mockReset();
    mockCreateTariffPickerKeyboard.mockReturnValue(FAKE_KEYBOARD);
    mockSendBatch.mockResolvedValue({ total: 0, success: 0, failed: 0, blocked: 0 });
  });

  it("(a) does not call sendBatch when the finder returns no users", async () => {
    mockFindTrialNudgeUsers.mockResolvedValue([]);

    await processTrialNudge(fakeJob);

    expect(mockFindTrialNudgeUsers).toHaveBeenCalledOnce();
    expect(mockSendBatch).not.toHaveBeenCalled();
  });

  it("(b) sends one batch per non-empty stage group with correct type + replyMarkup", async () => {
    mockFindTrialNudgeUsers.mockResolvedValue([
      { user: makeUser("a", 1001), stage: "low" },
      { user: makeUser("b", 1002), stage: "zero" },
      { user: makeUser("c", 1003), stage: "low" },
    ]);
    mockSendBatch.mockResolvedValue({ total: 2, success: 2, failed: 0, blocked: 0 });

    await processTrialNudge(fakeJob);

    // One call per distinct stage (low, zero).
    expect(mockSendBatch).toHaveBeenCalledTimes(2);

    const callsByType = new Map(
      mockSendBatch.mock.calls.map((call) => [call[1] as string, call])
    );

    expect(callsByType.has("trial-low")).toBe(true);
    expect(callsByType.has("trial-zero")).toBe(true);

    // trial-low group has the two "low" users (a, c).
    const lowCall = callsByType.get("trial-low")!;
    const lowUsers = lowCall[0] as ReturnType<typeof makeUser>[];
    expect(lowUsers.map((u) => u.id).sort()).toEqual(["a", "c"]);

    // trial-zero group has the single "zero" user (b).
    const zeroCall = callsByType.get("trial-zero")!;
    const zeroUsers = zeroCall[0] as ReturnType<typeof makeUser>[];
    expect(zeroUsers.map((u) => u.id)).toEqual(["b"]);

    // Both calls thread the tariff-picker keyboard as replyMarkup.
    for (const call of mockSendBatch.mock.calls) {
      const opts = call[3] as { replyMarkup?: unknown };
      expect(opts).toEqual({ replyMarkup: FAKE_KEYBOARD });
    }

    // The keyboard was built via the payments factory.
    expect(mockCreateTariffPickerKeyboard).toHaveBeenCalled();

    // Content generator is wired to createTrialNudgeMessage with the stage.
    const lowGenerator = lowCall[2] as (u: ReturnType<typeof makeUser>) => unknown;
    lowGenerator(lowUsers[0]!);
    expect(mockCreateTrialNudgeMessage).toHaveBeenCalledWith("low", "User a", "ru");
  });
});
