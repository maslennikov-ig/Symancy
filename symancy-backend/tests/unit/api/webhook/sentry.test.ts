/**
 * Unit tests for Sentry webhook handler (forwards Sentry alerts → Telegram).
 *
 * Covers:
 *   - formatSentryAlert renders levels, project, environment, release, URL.
 *   - sentryWebhookHandler authentication: missing token, wrong token,
 *     correct token; 503 when SENTRY_WEBHOOK_SECRET is unconfigured.
 *   - Successful delivery calls bot.sendMessage with admin chat id.
 *   - Telegram send failures are caught (do not propagate).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { formatSentryAlert, sentryWebhookHandler } from "../../../../src/api/webhook/sentry.js";

const mockGetEnv = vi.hoisted(() => vi.fn());
vi.mock("../../../../src/config/env.js", () => ({
  getEnv: mockGetEnv,
}));

const mockSendMessage = vi.hoisted(() => vi.fn());
vi.mock("../../../../src/core/telegram.js", () => ({
  getBotApi: () => ({ sendMessage: mockSendMessage }),
}));

vi.mock("../../../../src/core/logger.js", () => ({
  getLogger: () => ({
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

// Minimal fake reply
function makeReply() {
  return {
    status: vi.fn().mockReturnThis(),
  };
}

describe("formatSentryAlert", () => {
  it("renders error level with project and environment", () => {
    const msg = formatSentryAlert({
      level: "error",
      project_slug: "symancy-backend",
      message: "Something blew up",
      event: { environment: "production" },
    });
    expect(msg).toContain("❌");
    expect(msg).toContain("SENTRY ERROR");
    expect(msg).toContain("symancy-backend");
    expect(msg).toContain("production");
    expect(msg).toContain("Something blew up");
  });

  it("uses fatal emoji for fatal level", () => {
    const msg = formatSentryAlert({ level: "fatal", message: "boom" });
    expect(msg).toContain("🔴");
    expect(msg).toContain("SENTRY FATAL");
  });

  it("uses warning emoji for warning level", () => {
    const msg = formatSentryAlert({ level: "warning", message: "careful" });
    expect(msg).toContain("⚠️");
    expect(msg).toContain("SENTRY WARNING");
  });

  it("falls back to error emoji when level unknown", () => {
    const msg = formatSentryAlert({ level: "weird", message: "x" });
    expect(msg).toContain("❌");
    expect(msg).toContain("SENTRY WEIRD");
  });

  it("includes release and triggering rule when provided", () => {
    const msg = formatSentryAlert({
      level: "error",
      message: "fail",
      project_slug: "symancy-web",
      triggering_rules: ["All errors → Telegram"],
      event: { environment: "production", release: "abc1234" },
    });
    expect(msg).toContain("Release: abc1234");
    expect(msg).toContain("Rule: All errors → Telegram");
  });

  it("includes URL line when present", () => {
    const msg = formatSentryAlert({
      level: "error",
      message: "x",
      url: "https://sentry.io/issues/123",
    });
    expect(msg).toContain("https://sentry.io/issues/123");
  });

  it("uses event.title over message when available", () => {
    const msg = formatSentryAlert({
      level: "error",
      message: "raw message",
      event: { title: "Pretty title" },
    });
    expect(msg).toContain("Pretty title");
    // Title supersedes message — message line should not duplicate
    expect(msg).not.toContain("raw message");
  });

  it("handles empty payload gracefully", () => {
    const msg = formatSentryAlert({});
    expect(msg).toContain("SENTRY ERROR"); // defaults to "error"
    expect(msg).toContain("Unknown error");
    expect(msg).toContain("unknown-project");
  });

  it("truncates very long messages", () => {
    const longMessage = "x".repeat(5000);
    const msg = formatSentryAlert({ level: "error", message: longMessage });
    expect(msg.length).toBeLessThanOrEqual(3500);
    expect(msg).toContain("(truncated)");
  });

  it("does not duplicate culprit when it equals title", () => {
    const msg = formatSentryAlert({
      level: "error",
      culprit: "same",
      event: { title: "same" },
    });
    // Should appear exactly once in the body
    expect((msg.match(/same/g) || []).length).toBe(1);
  });

  it("renders culprit on a separate line when distinct from title", () => {
    const msg = formatSentryAlert({
      level: "error",
      culprit: "src/foo.ts in handler",
      event: { title: "TypeError: bad" },
    });
    expect(msg).toContain("Culprit: src/foo.ts in handler");
    expect(msg).toContain("TypeError: bad");
  });
});

describe("sentryWebhookHandler authentication", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockGetEnv.mockReset();
  });

  it("returns 503 when SENTRY_WEBHOOK_SECRET is not configured", async () => {
    mockGetEnv.mockReturnValue({ ADMIN_CHAT_ID: 1 });
    const reply = makeReply();
    const result = await sentryWebhookHandler(
      { query: { token: "anything" }, body: {}, ip: "1.2.3.4" } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(result).toEqual({ ok: false });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns 401 when token is missing", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "supersecret-1234567890ab",
      ADMIN_CHAT_ID: 1,
    });
    const reply = makeReply();
    const result = await sentryWebhookHandler(
      { query: {}, body: {}, ip: "1.2.3.4" } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(result).toEqual({ ok: false });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns 401 when token is wrong", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "supersecret-1234567890ab",
      ADMIN_CHAT_ID: 1,
    });
    const reply = makeReply();
    const result = await sentryWebhookHandler(
      { query: { token: "wrong-token-different-length" }, body: {}, ip: "1.2.3.4" } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(result).toEqual({ ok: false });
  });

  it("returns 401 when tokens have same length but differ", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "1234567890abcdef1234567890abcdef",
      ADMIN_CHAT_ID: 1,
    });
    const reply = makeReply();
    const result = await sentryWebhookHandler(
      {
        query: { token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, // 32 chars, wrong
        body: {},
        ip: "1.2.3.4",
      } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(result).toEqual({ ok: false });
  });

  it("forwards to Telegram and returns ok:true on valid token", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "supersecret-1234567890ab",
      ADMIN_CHAT_ID: 166848328,
    });
    mockSendMessage.mockResolvedValue({});

    const reply = makeReply();
    const result = await sentryWebhookHandler(
      {
        query: { token: "supersecret-1234567890ab" },
        body: {
          level: "error",
          project_slug: "symancy-backend",
          message: "Test error",
          event: { environment: "production" },
        },
        ip: "1.2.3.4",
      } as never,
      reply as never
    );

    expect(result).toEqual({ ok: true });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [chatId, message, opts] = mockSendMessage.mock.calls[0];
    expect(chatId).toBe(166848328);
    expect(message).toContain("symancy-backend");
    expect(message).toContain("Test error");
    expect(opts.link_preview_options).toEqual({ is_disabled: true });
  });

  it("returns ok:true without sending when ADMIN_CHAT_ID is unset", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "supersecret-1234567890ab",
      // ADMIN_CHAT_ID intentionally undefined
    });
    const reply = makeReply();
    const result = await sentryWebhookHandler(
      {
        query: { token: "supersecret-1234567890ab" },
        body: { level: "error", message: "x" },
        ip: "1.2.3.4",
      } as never,
      reply as never
    );
    expect(result).toEqual({ ok: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("swallows Telegram send errors so Sentry does not retry the webhook", async () => {
    mockGetEnv.mockReturnValue({
      SENTRY_WEBHOOK_SECRET: "supersecret-1234567890ab",
      ADMIN_CHAT_ID: 1,
    });
    mockSendMessage.mockRejectedValue(new Error("Telegram down"));

    const reply = makeReply();
    const result = await sentryWebhookHandler(
      {
        query: { token: "supersecret-1234567890ab" },
        body: { level: "error", message: "x" },
        ip: "1.2.3.4",
      } as never,
      reply as never
    );
    expect(result).toEqual({ ok: true });
  });
});
