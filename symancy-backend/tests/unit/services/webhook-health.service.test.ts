/**
 * Unit tests for Webhook Health Service (sym-mqd)
 *
 * Verifies:
 *   - Pure classification (ok / misconfigured / not_set / error)
 *   - Auto-recovery flow (success + failure paths)
 *   - Alert dedup (cooldown + state-change transitions)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env BEFORE importing the service so that getEnv() resolves cleanly.
vi.mock("../../../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    WEBHOOK_BASE_URL: "https://symancy.ru",
    ADMIN_CHAT_ID: 123,
    TELEGRAM_BOT_TOKEN: "1:abc",
  })),
}));

// Mock telegram core — both webhook info and setWebhook.
const { mockGetWebhookInfo, mockSetWebhook } = vi.hoisted(() => ({
  mockGetWebhookInfo: vi.fn(),
  mockSetWebhook: vi.fn(),
}));

vi.mock("../../../src/core/telegram.js", () => ({
  getWebhookInfo: mockGetWebhookInfo,
  setWebhook: mockSetWebhook,
}));

// Mock admin-alerts to capture alerts without hitting Telegram.
const { mockSendAdminAlert } = vi.hoisted(() => ({
  mockSendAdminAlert: vi.fn(async () => undefined),
}));

vi.mock("../../../src/utils/admin-alerts.js", () => ({
  sendAdminAlert: mockSendAdminAlert,
}));

import {
  checkWebhookHealth,
  runWebhookHealthCheck,
  resetWebhookHealthState,
} from "../../../src/services/webhook-health.service.js";

const EXPECTED_URL = "https://symancy.ru/webhook/telegram";
const FOREIGN_URL = "https://flow8n.ru/webhook/telegram"; // the actual hijacker from the incident

describe("webhook-health.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWebhookHealthState();
  });

  // ===========================================================================
  // checkWebhookHealth (pure classification)
  // ===========================================================================
  describe("checkWebhookHealth", () => {
    it("returns ok when webhook URL matches expected", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: EXPECTED_URL,
        pending_update_count: 0,
      });

      const result = await checkWebhookHealth();

      expect(result.state).toBe("ok");
      expect(result.actualUrl).toBe(EXPECTED_URL);
      expect(result.pendingUpdates).toBe(0);
    });

    it("returns misconfigured when URL is set but different", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: FOREIGN_URL,
        pending_update_count: 12,
      });

      const result = await checkWebhookHealth();

      expect(result.state).toBe("misconfigured");
      expect(result.actualUrl).toBe(FOREIGN_URL);
      expect(result.pendingUpdates).toBe(12);
    });

    it("returns not_set when webhook URL is empty", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: "",
        pending_update_count: 0,
      });

      const result = await checkWebhookHealth();

      expect(result.state).toBe("not_set");
      expect(result.actualUrl).toBeNull();
    });

    it("returns error when getWebhookInfo throws", async () => {
      mockGetWebhookInfo.mockRejectedValueOnce(new Error("network down"));

      const result = await checkWebhookHealth();

      expect(result.state).toBe("error");
      expect(result.recoveryError).toBe("network down");
    });
  });

  // ===========================================================================
  // runWebhookHealthCheck — alerts
  // ===========================================================================
  describe("runWebhookHealthCheck — alerting", () => {
    it("does NOT alert when state is ok and no prior bad state", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: EXPECTED_URL,
        pending_update_count: 0,
      });

      const result = await runWebhookHealthCheck({ attemptRecovery: false });

      expect(result.state).toBe("ok");
      expect(mockSendAdminAlert).not.toHaveBeenCalled();
    });

    it("alerts admin when webhook is misconfigured", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: FOREIGN_URL,
        pending_update_count: 99,
      });

      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1);
      const callArgs = mockSendAdminAlert.mock.calls[0]!;
      const message = callArgs[0] as string;
      const severity = callArgs[1] as string;
      const context = callArgs[2] as Record<string, unknown>;
      expect(message).toContain("MISCONFIGURED");
      expect(message).toContain(EXPECTED_URL);
      expect(message).toContain(FOREIGN_URL);
      expect(severity).toBe("error");
      expect(context).toMatchObject({
        state: "misconfigured",
        actualUrl: FOREIGN_URL,
      });
    });

    it("alerts admin when webhook is not_set", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: "",
        pending_update_count: 0,
      });

      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1);
      const message = mockSendAdminAlert.mock.calls[0]![0] as string;
      expect(message).toContain("NOT SET");
    });

    it("dedupes identical bad states within cooldown window", async () => {
      // Same misconfigured URL twice in a row — only first should alert.
      mockGetWebhookInfo
        .mockResolvedValueOnce({ url: FOREIGN_URL, pending_update_count: 0 })
        .mockResolvedValueOnce({ url: FOREIGN_URL, pending_update_count: 0 });

      await runWebhookHealthCheck({ attemptRecovery: false });
      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1);
    });

    it("re-alerts when bad URL changes to a different bad URL", async () => {
      mockGetWebhookInfo
        .mockResolvedValueOnce({ url: FOREIGN_URL, pending_update_count: 0 })
        .mockResolvedValueOnce({
          url: "https://evil.example.com/wh",
          pending_update_count: 0,
        });

      await runWebhookHealthCheck({ attemptRecovery: false });
      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).toHaveBeenCalledTimes(2);
    });

    it("alerts on recovery transition (bad -> ok)", async () => {
      mockGetWebhookInfo
        .mockResolvedValueOnce({ url: FOREIGN_URL, pending_update_count: 0 })
        .mockResolvedValueOnce({ url: EXPECTED_URL, pending_update_count: 0 });

      // First run: misconfigured -> alert
      await runWebhookHealthCheck({ attemptRecovery: false });
      // Second run: ok -> recovery alert
      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).toHaveBeenCalledTimes(2);
      const secondMessage = mockSendAdminAlert.mock.calls[1]![0] as string;
      const secondSeverity = mockSendAdminAlert.mock.calls[1]![1] as string;
      expect(secondMessage).toContain("recovered");
      expect(secondSeverity).toBe("info");
    });

    it("does not re-alert on steady ok after one ok", async () => {
      mockGetWebhookInfo
        .mockResolvedValueOnce({ url: EXPECTED_URL, pending_update_count: 0 })
        .mockResolvedValueOnce({ url: EXPECTED_URL, pending_update_count: 0 });

      await runWebhookHealthCheck({ attemptRecovery: false });
      await runWebhookHealthCheck({ attemptRecovery: false });

      expect(mockSendAdminAlert).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // runWebhookHealthCheck — auto-recovery
  // ===========================================================================
  describe("runWebhookHealthCheck — auto-recovery", () => {
    it("calls setWebhook and reports recovery=ok when re-probe succeeds", async () => {
      mockGetWebhookInfo
        // initial probe — misconfigured
        .mockResolvedValueOnce({ url: FOREIGN_URL, pending_update_count: 5 })
        // re-probe after setWebhook — ok
        .mockResolvedValueOnce({ url: EXPECTED_URL, pending_update_count: 0 });
      mockSetWebhook.mockResolvedValueOnce(undefined);

      const result = await runWebhookHealthCheck({ attemptRecovery: true });

      expect(mockSetWebhook).toHaveBeenCalledWith(EXPECTED_URL);
      expect(result.state).toBe("ok");
      expect(result.recovery).toBe("ok");

      // One alert was sent — describing recovery success.
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1);
      const message = mockSendAdminAlert.mock.calls[0]![0] as string;
      expect(message).toContain("Auto-recovery: setWebhook() succeeded");
    });

    it("reports recovery=failed when setWebhook throws", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: FOREIGN_URL,
        pending_update_count: 0,
      });
      mockSetWebhook.mockRejectedValueOnce(new Error("Telegram 401"));

      const result = await runWebhookHealthCheck({ attemptRecovery: true });

      expect(result.recovery).toBe("failed");
      expect(result.recoveryError).toBe("Telegram 401");

      const message = mockSendAdminAlert.mock.calls[0]![0] as string;
      expect(message).toContain("Auto-recovery: setWebhook() FAILED");
      expect(message).toContain("Telegram 401");
    });

    it("does NOT auto-recover when state is error", async () => {
      mockGetWebhookInfo.mockRejectedValueOnce(new Error("dns fail"));

      const result = await runWebhookHealthCheck({ attemptRecovery: true });

      expect(mockSetWebhook).not.toHaveBeenCalled();
      expect(result.state).toBe("error");
    });

    it("does NOT auto-recover when state is ok", async () => {
      mockGetWebhookInfo.mockResolvedValueOnce({
        url: EXPECTED_URL,
        pending_update_count: 0,
      });

      await runWebhookHealthCheck({ attemptRecovery: true });

      expect(mockSetWebhook).not.toHaveBeenCalled();
    });
  });
});
