/**
 * Webhook Health Service
 *
 * Periodic and startup checks of the Telegram webhook configuration.
 * Detects:
 *   - "ok"            — webhook URL matches expected
 *   - "misconfigured" — webhook URL is set but points elsewhere (e.g. hijacked)
 *   - "not_set"       — webhook URL is empty
 *   - "error"         — getWebhookInfo() failed
 *
 * On bad state:
 *   1. Optionally attempts auto-recovery via setWebhook(expectedUrl).
 *   2. Sends a Telegram alert to ADMIN_CHAT_ID — but only if state changed
 *      since the last alert OR more than ALERT_COOLDOWN_MS passed.
 *
 * Background of incident sym-mqd:
 *   Between 11.04.2026 and 09.05.2026 the webhook silently pointed to an
 *   external host (flow8n.ru) for 28 days. /health detected it but no
 *   one polled /health. This service closes that gap.
 */
import { getEnv } from "../config/env.js";
import { getLogger } from "../core/logger.js";
import { getWebhookInfo, setWebhook } from "../core/telegram.js";
import { sendAdminAlert } from "../utils/admin-alerts.js";

const logger = getLogger().child({ service: "webhook-health" });

/**
 * Possible outcomes of a webhook health probe.
 */
export type WebhookHealthState =
  | "ok"
  | "misconfigured"
  | "not_set"
  | "error";

/**
 * Result of a single health check.
 */
export interface WebhookHealthCheckResult {
  state: WebhookHealthState;
  expectedUrl: string;
  actualUrl: string | null;
  pendingUpdates?: number;
  /**
   * If state was bad and auto-recovery was attempted, the outcome:
   *   "ok"      — setWebhook() succeeded
   *   "failed"  — setWebhook() threw
   *   "skipped" — auto-recovery not applicable (e.g. state === "ok")
   */
  recovery?: "ok" | "failed" | "skipped";
  recoveryError?: string;
}

/**
 * Cooldown between identical alerts (24 hours).
 * Prevents spamming the admin every hour about the same misconfigured URL.
 */
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * In-memory dedup state. Key: `${state}|${actualUrl ?? ""}`
 */
interface DedupEntry {
  lastAlertTime: number;
}
const alertDedup = new Map<string, DedupEntry>();

/**
 * Last known state — used to detect transitions (ok -> bad, bad -> bad with
 * different URL, bad -> ok recovered).
 */
let lastKnownState: WebhookHealthState | null = null;

/**
 * Build the dedup key from current state. We dedupe by state AND actual URL
 * so that switching from one bad URL to another still produces an alert.
 */
function dedupKey(state: WebhookHealthState, actualUrl: string | null): string {
  return `${state}|${actualUrl ?? ""}`;
}

/**
 * Reset internal dedup/state caches. Exposed for tests.
 */
export function resetWebhookHealthState(): void {
  alertDedup.clear();
  lastKnownState = null;
}

/**
 * Decide whether to send an alert given the current state.
 *
 * Rules:
 *   - state === "ok": caller decides via the `forceOk` flag; we never spam
 *     while the webhook is steadily healthy.
 *   - bad state: alert if state-key not seen before OR cooldown expired.
 */
function shouldAlert(
  state: WebhookHealthState,
  actualUrl: string | null,
  now: number,
  forceOk: boolean
): boolean {
  if (state === "ok") {
    return forceOk;
  }

  const key = dedupKey(state, actualUrl);
  const entry = alertDedup.get(key);
  if (!entry) {
    return true;
  }
  return now - entry.lastAlertTime >= ALERT_COOLDOWN_MS;
}

/**
 * Record that an alert has just been sent for this state.
 */
function recordAlert(
  state: WebhookHealthState,
  actualUrl: string | null,
  now: number
): void {
  alertDedup.set(dedupKey(state, actualUrl), { lastAlertTime: now });
}

/**
 * Probe the webhook once and classify the outcome.
 * Does NOT alert and does NOT attempt recovery — pure inspection.
 */
export async function checkWebhookHealth(): Promise<WebhookHealthCheckResult> {
  const env = getEnv();
  const expectedUrl = `${env.WEBHOOK_BASE_URL}/webhook/telegram`;

  try {
    const info = await getWebhookInfo();
    const actualUrl = info.url || null;
    const pendingUpdates = info.pending_update_count;

    let state: WebhookHealthState;
    if (actualUrl === expectedUrl) {
      state = "ok";
    } else if (actualUrl) {
      state = "misconfigured";
    } else {
      state = "not_set";
    }

    return {
      state,
      expectedUrl,
      actualUrl,
      pendingUpdates,
      recovery: "skipped",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "getWebhookInfo() failed");
    return {
      state: "error",
      expectedUrl,
      actualUrl: null,
      recovery: "skipped",
      recoveryError: message,
    };
  }
}

/**
 * Compose the human-readable alert text.
 */
function formatAlertMessage(result: WebhookHealthCheckResult): string {
  const lines: string[] = [];

  switch (result.state) {
    case "misconfigured":
      lines.push("Telegram webhook MISCONFIGURED — points to a foreign URL.");
      break;
    case "not_set":
      lines.push("Telegram webhook is NOT SET — bot is not receiving updates.");
      break;
    case "error":
      lines.push("Failed to query Telegram webhook info.");
      break;
    case "ok":
      lines.push("Telegram webhook recovered — now points to the expected URL.");
      break;
  }

  lines.push(`Expected: ${result.expectedUrl}`);
  lines.push(`Actual: ${result.actualUrl ?? "(none)"}`);

  if (typeof result.pendingUpdates === "number") {
    lines.push(`Pending updates: ${result.pendingUpdates}`);
  }

  if (result.recovery === "ok") {
    lines.push("Auto-recovery: setWebhook() succeeded — webhook restored.");
  } else if (result.recovery === "failed") {
    lines.push(
      `Auto-recovery: setWebhook() FAILED — ${result.recoveryError ?? "unknown error"}.`
    );
    lines.push("Manual action required.");
  } else if (result.state !== "ok" && result.state !== "error") {
    lines.push("Manual action required: re-run setWebhook on startup.");
  }

  return lines.join("\n");
}

/**
 * Map internal state to alert severity.
 */
function severityFor(state: WebhookHealthState): "error" | "warning" | "info" {
  if (state === "ok") return "info";
  if (state === "error") return "warning";
  // misconfigured / not_set are critical — bot is silently dead.
  return "error";
}

/**
 * Send an admin alert for the given check result.
 * Goes through utils/admin-alerts so it is non-blocking and respects the
 * ADMIN_CHAT_ID-not-set short-circuit.
 */
export async function alertAdminAboutWebhook(
  result: WebhookHealthCheckResult
): Promise<void> {
  const message = formatAlertMessage(result);
  const severity = severityFor(result.state);

  await sendAdminAlert(message, severity, {
    state: result.state,
    expectedUrl: result.expectedUrl,
    actualUrl: result.actualUrl ?? "(none)",
    pendingUpdates: result.pendingUpdates ?? 0,
    recovery: result.recovery ?? "skipped",
  });
}

/**
 * Full orchestrated health check: probe → optional auto-recovery → alert
 * (with dedup) → update internal state.
 *
 * This is the entry point used by both the startup check (in API mode) and
 * the periodic cron worker.
 *
 * @param options.attemptRecovery — if true (default) and state is
 *   "misconfigured" or "not_set", call setWebhook(expectedUrl) and re-probe.
 */
export async function runWebhookHealthCheck(options?: {
  attemptRecovery?: boolean;
}): Promise<WebhookHealthCheckResult> {
  const attemptRecovery = options?.attemptRecovery ?? true;

  let result = await checkWebhookHealth();

  logger.info(
    {
      state: result.state,
      expectedUrl: result.expectedUrl,
      actualUrl: result.actualUrl,
      pendingUpdates: result.pendingUpdates,
    },
    "Webhook health probe complete"
  );

  // Auto-recovery: only when URL is wrong/missing AND we have a clear target.
  // We never auto-recover on "error" — that means the API itself is unreachable.
  if (
    attemptRecovery &&
    (result.state === "misconfigured" || result.state === "not_set")
  ) {
    const badStateBefore = result.state;
    const badUrlBefore = result.actualUrl;
    try {
      logger.warn(
        { badState: badStateBefore, badUrl: badUrlBefore, target: result.expectedUrl },
        "Attempting webhook auto-recovery"
      );
      await setWebhook(result.expectedUrl);
      // Re-probe to confirm recovery — but keep the original bad-state info
      // so the alert correctly describes what was wrong.
      const reprobe = await checkWebhookHealth();
      result = {
        ...result,
        // After recovery the state is whatever the re-probe says; usually "ok".
        state: reprobe.state,
        actualUrl: reprobe.actualUrl,
        pendingUpdates: reprobe.pendingUpdates,
        recovery: reprobe.state === "ok" ? "ok" : "failed",
        recoveryError:
          reprobe.state === "ok"
            ? undefined
            : `re-probe still ${reprobe.state}`,
      };
      logger.info(
        { newState: result.state, recovery: result.recovery },
        "Auto-recovery completed"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ...result,
        recovery: "failed",
        recoveryError: message,
      };
      logger.error({ error: message }, "Auto-recovery setWebhook() failed");
    }
  }

  // Dedup + alert.
  // For state === "ok" we want to notify only on transitions worth knowing:
  //   - we just performed an auto-recovery this cycle (recovery=ok|failed), OR
  //   - the previous known state was bad (passive recovery)
  // For other states the dedup map and cooldown apply.
  const now = Date.now();
  const recoveryHappenedThisCycle =
    result.recovery === "ok" || result.recovery === "failed";
  const passiveRecovery =
    result.state === "ok" &&
    lastKnownState !== null &&
    lastKnownState !== "ok";
  const forceOk = recoveryHappenedThisCycle || passiveRecovery;

  if (shouldAlert(result.state, result.actualUrl, now, forceOk)) {
    await alertAdminAboutWebhook(result);
    recordAlert(result.state, result.actualUrl, now);
  } else {
    logger.debug(
      { state: result.state, lastKnownState },
      "Alert suppressed (cooldown or steady ok state)"
    );
  }

  lastKnownState = result.state;
  return result;
}
