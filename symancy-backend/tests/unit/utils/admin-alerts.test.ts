/**
 * Unit tests for admin-alerts transient connection error aggregation (sym-s7lc)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMessageMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/core/telegram.js", () => ({
  getBotApi: () => ({ sendMessage: sendMessageMock }),
}));

vi.mock("@/config/env.js", () => ({
  getEnv: () => ({ ADMIN_CHAT_ID: "12345" }),
}));

vi.mock("@/core/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/core/sentry.js", () => ({
  captureException: vi.fn(),
}));

import {
  sendErrorAlert,
  isTransientConnectionError,
  resetTransientEpisodeState,
} from "../../../src/utils/admin-alerts.js";

describe("isTransientConnectionError", () => {
  it.each([
    "Connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
    "Connection terminated unexpectedly",
    "connect ECONNREFUSED 1.2.3.4:6543",
    "read ECONNRESET",
    "connect ETIMEDOUT 1.2.3.4:6543",
    "getaddrinfo ENOTFOUND aws-1-eu-west-1.pooler.supabase.com",
    "getaddrinfo EAI_AGAIN aws-1-eu-west-1.pooler.supabase.com",
  ])("matches transient error: %s", (message) => {
    expect(isTransientConnectionError(message)).toBe(true);
  });

  it.each([
    "new row for relation violates check constraint",
    "duplicate key value violates unique constraint",
    "Job stale - cleared by cleanup task",
  ])("does not match unrelated error: %s", (message) => {
    expect(isTransientConnectionError(message)).toBe(false);
  });
});

describe("sendErrorAlert transient aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetTransientEpisodeState();
  });

  afterEach(() => {
    resetTransientEpisodeState();
    vi.useRealTimers();
  });

  it("sends one alert for a burst of alternating transient errors", async () => {
    // Simulate the real incident: alternating messages every ~30s for 4.5 min
    const messages = [
      "Connection terminated due to connection timeout",
      "timeout exceeded when trying to connect",
    ];
    for (let i = 0; i < 9; i++) {
      await sendErrorAlert(new Error(messages[i % 2]), { source: "pg-boss" });
      await vi.advanceTimersByTimeAsync(30_000);
    }

    // Old behavior: ~5-9 alerts. New behavior: exactly 1 "degraded" alert.
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock.mock.calls[0][1]).toContain("connectivity degraded");
  });

  it("sends a recovery notice with totals after errors stop", async () => {
    await sendErrorAlert(new Error("timeout exceeded when trying to connect"));
    await vi.advanceTimersByTimeAsync(60_000);
    await sendErrorAlert(
      new Error("Connection terminated due to connection timeout")
    );

    // Quiet period (3 min) passes -> recovery notice fires
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    const recovery = sendMessageMock.mock.calls[1][1] as string;
    expect(recovery).toContain("connectivity restored");
    expect(recovery).toContain("2 transient connection error(s)");
  });

  it("re-alerts within one long episode only after the 10-minute window", async () => {
    // Errors every 30s for 21 minutes without a quiet gap
    for (let i = 0; i < 42; i++) {
      await sendErrorAlert(new Error("timeout exceeded when trying to connect"));
      await vi.advanceTimersByTimeAsync(30_000);
    }

    // Alerts at ~0, ~10 and ~20 minutes; no recovery yet (no quiet gap)
    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    for (const call of sendMessageMock.mock.calls) {
      expect(call[1]).toContain("connectivity degraded");
    }
  });

  it("starts a fresh episode after recovery", async () => {
    await sendErrorAlert(new Error("read ECONNRESET"));
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000); // recovery fires

    await sendErrorAlert(new Error("read ECONNRESET"));

    // degraded + recovered + degraded (new episode alerts immediately)
    expect(sendMessageMock).toHaveBeenCalledTimes(3);
    expect(sendMessageMock.mock.calls[2][1]).toContain("connectivity degraded");
  });

  it("keeps normal rate limiting for non-transient errors", async () => {
    await sendErrorAlert(new Error("duplicate key value violates unique constraint"));
    await sendErrorAlert(new Error("duplicate key value violates unique constraint"));

    // Second identical error within 60s is rate-limited
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock.mock.calls[0][1]).toContain("ERROR ALERT");
  });
});
