/**
 * Admin Alert Utility
 *
 * Send critical error notifications to admin Telegram chat with:
 * - Severity levels (error, warning, info)
 * - Formatted messages with timestamps
 * - Rate limiting to prevent spam
 * - Non-blocking error handling
 */
import { getBotApi } from "@/core/telegram.js";
import { getEnv } from "@/config/env.js";
import { logger } from "@/core/logger.js";
import { captureException } from "@/core/sentry.js";

/**
 * Alert severity levels
 */
export type AlertSeverity = "error" | "warning" | "info";

/**
 * Severity emoji mapping
 */
const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

/**
 * Max message length to prevent truncation by Telegram
 */
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Alert cache entry with count aggregation
 */
interface AlertCacheEntry {
  lastSentTime: number;
  count: number;
}

/**
 * Rate limiting: Track last alert time and count per error type
 * Key: error message hash, Value: { lastSentTime, count }
 */
const alertCache = new Map<string, AlertCacheEntry>();

/**
 * Rate limit duration: 1 minute per unique error
 */
const RATE_LIMIT_MS = 60 * 1000;

/**
 * Known transient connection error patterns.
 *
 * Network blips between the VPS and the Supabase pooler arrive in bursts of
 * alternating messages ("Connection terminated due to connection timeout" /
 * "timeout exceeded when trying to connect"), so per-message rate limiting
 * still produced ~2 alerts/minute for the whole episode (sym-s7lc). All such
 * errors share one aggregation bucket with a longer alert window and a
 * recovery notice once the burst stops.
 */
const TRANSIENT_CONNECTION_ERROR_PATTERNS: RegExp[] = [
  /connection terminated due to connection timeout/i,
  /timeout exceeded when trying to connect/i,
  /connection terminated unexpectedly/i,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
];

/**
 * Check whether an error message matches a known transient connection error
 */
export function isTransientConnectionError(message: string): boolean {
  return TRANSIENT_CONNECTION_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Minimum interval between repeated alerts within one connectivity episode
 */
const TRANSIENT_ALERT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Quiet period without transient errors after which the episode is
 * considered over and a recovery notice is sent
 */
const TRANSIENT_RECOVERY_QUIET_MS = 3 * 60 * 1000;

/**
 * State of the current transient-connectivity episode (null = no episode)
 */
interface TransientEpisodeState {
  firstErrorAt: number;
  lastErrorAt: number;
  count: number;
  lastAlertAt: number;
  lastErrorMessage: string;
  recoveryTimer: NodeJS.Timeout | null;
}

let transientEpisode: TransientEpisodeState | null = null;

/**
 * Reset transient episode state (for tests)
 */
export function resetTransientEpisodeState(): void {
  if (transientEpisode?.recoveryTimer) {
    clearTimeout(transientEpisode.recoveryTimer);
  }
  transientEpisode = null;
}

/**
 * Aggregate transient connection errors into a single episode:
 * - first error sends one "connectivity degraded" alert immediately;
 * - repeats within TRANSIENT_ALERT_WINDOW_MS only bump the counter;
 * - after TRANSIENT_RECOVERY_QUIET_MS without errors a recovery notice
 *   with episode totals is sent and the state is cleared.
 */
async function handleTransientConnectionError(
  error: Error,
  context?: Record<string, unknown>
): Promise<void> {
  const now = Date.now();

  if (!transientEpisode) {
    transientEpisode = {
      firstErrorAt: now,
      lastErrorAt: now,
      count: 1,
      lastAlertAt: 0,
      lastErrorMessage: error.message,
      recoveryTimer: null,
    };
  } else {
    transientEpisode.count++;
    transientEpisode.lastErrorAt = now;
    transientEpisode.lastErrorMessage = error.message;
  }

  // (Re)arm the recovery timer on every error so it fires only after quiet
  if (transientEpisode.recoveryTimer) {
    clearTimeout(transientEpisode.recoveryTimer);
  }
  transientEpisode.recoveryTimer = setTimeout(() => {
    void sendTransientRecoveryNotice();
  }, TRANSIENT_RECOVERY_QUIET_MS);
  transientEpisode.recoveryTimer.unref?.();

  const isFirstAlert = transientEpisode.lastAlertAt === 0;
  if (!isFirstAlert && now - transientEpisode.lastAlertAt < TRANSIENT_ALERT_WINDOW_MS) {
    logger.debug("Transient connection error aggregated", {
      count: transientEpisode.count,
      error: error.message,
    });
    return;
  }
  transientEpisode.lastAlertAt = now;

  // Sentry once per alert (not per error) to avoid flooding
  captureException(error, context);

  const sinceFirst = Math.round((now - transientEpisode.firstErrorAt) / 1000);
  let body = `⚠️ WARNING ALERT\nTime: ${new Date(now).toISOString()}\n`;
  body += `\nMessage: DB/network connectivity degraded (transient connection errors)\n`;
  body += `Errors in episode: ${transientEpisode.count}`;
  body += isFirstAlert ? ` (episode just started)\n` : ` over ${sinceFirst}s\n`;
  body += `Latest error: ${error.message}\n`;
  if (context && Object.keys(context).length > 0) {
    body += `\nContext:\n`;
    for (const [key, value] of Object.entries(context)) {
      const valueStr =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      body += `- ${key}: ${valueStr}\n`;
    }
  }
  body += `\nA recovery notice will follow once errors stop for ${TRANSIENT_RECOVERY_QUIET_MS / 60000} min.`;

  try {
    const env = getEnv();
    if (!env.ADMIN_CHAT_ID) {
      return;
    }
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, truncateMessage(body, MAX_MESSAGE_LENGTH), {
      parse_mode: undefined,
    });
  } catch (sendError) {
    logger.error("Failed to send transient connectivity alert", {
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  }
}

/**
 * Send a recovery notice summarizing the finished connectivity episode
 */
async function sendTransientRecoveryNotice(): Promise<void> {
  const episode = transientEpisode;
  transientEpisode = null;
  if (!episode) {
    return;
  }

  const durationSec = Math.max(
    1,
    Math.round((episode.lastErrorAt - episode.firstErrorAt) / 1000)
  );
  let body = `✅ RECOVERED\nTime: ${new Date().toISOString()}\n`;
  body += `\nMessage: DB/network connectivity restored\n`;
  body += `Episode: ${episode.count} transient connection error(s) over ${durationSec}s\n`;
  body += `First: ${new Date(episode.firstErrorAt).toISOString()}\n`;
  body += `Last:  ${new Date(episode.lastErrorAt).toISOString()}\n`;
  body += `Last error: ${episode.lastErrorMessage}`;

  try {
    const env = getEnv();
    if (!env.ADMIN_CHAT_ID) {
      return;
    }
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, truncateMessage(body, MAX_MESSAGE_LENGTH), {
      parse_mode: undefined,
    });
    logger.info("Transient connectivity episode recovered", {
      count: episode.count,
      durationSec,
    });
  } catch (sendError) {
    logger.error("Failed to send recovery notice", {
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  }
}

/**
 * Simple hash function for error messages
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Check if alert should be rate-limited and increment count
 */
function shouldRateLimit(errorKey: string): boolean {
  const entry = alertCache.get(errorKey);
  if (!entry) {
    // First occurrence - initialize entry
    alertCache.set(errorKey, { lastSentTime: 0, count: 1 });
    return false;
  }

  const timeSinceLastAlert = Date.now() - entry.lastSentTime;

  if (timeSinceLastAlert < RATE_LIMIT_MS) {
    // Within rate limit - increment count
    entry.count++;
    return true;
  }

  // Rate limit expired - reset count
  entry.count = 1;
  return false;
}

/**
 * Record alert in rate limit cache with count
 */
function recordAlert(errorKey: string): void {
  const entry = alertCache.get(errorKey);
  if (entry) {
    entry.lastSentTime = Date.now();
    // Count is reset in shouldRateLimit when rate limit expires
  } else {
    alertCache.set(errorKey, { lastSentTime: Date.now(), count: 1 });
  }

  // Clean up old entries (older than 5 minutes)
  const cutoffTime = Date.now() - 5 * 60 * 1000;
  for (const [key, entry] of alertCache.entries()) {
    if (entry.lastSentTime < cutoffTime) {
      alertCache.delete(key);
    }
  }
}

/**
 * Truncate message if too long
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }

  const truncated = message.slice(0, maxLength - 50);
  return `${truncated}\n\n... (message truncated, ${message.length} chars total)`;
}

/**
 * Format alert message with severity, timestamp, and occurrence count
 */
function formatAlertMessage(
  message: string,
  severity: AlertSeverity,
  context?: Record<string, unknown>,
  count?: number
): string {
  const emoji = SEVERITY_EMOJI[severity];
  const timestamp = new Date().toISOString();

  let formatted = `${emoji} ${severity.toUpperCase()} ALERT\n`;
  formatted += `Time: ${timestamp}\n`;

  // Add count if > 1
  if (count && count > 1) {
    formatted += `Occurrences: ${count} times in last ${RATE_LIMIT_MS / 1000}s\n`;
  }

  formatted += `\nMessage: ${message}\n`;

  if (context && Object.keys(context).length > 0) {
    formatted += `\nContext:\n`;
    for (const [key, value] of Object.entries(context)) {
      const valueStr =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      formatted += `- ${key}: ${valueStr}\n`;
    }
  }

  return truncateMessage(formatted, MAX_MESSAGE_LENGTH);
}

/**
 * Format error alert message with stack trace and occurrence count
 */
function formatErrorAlert(
  error: Error,
  context?: Record<string, unknown>,
  count?: number
): string {
  const emoji = SEVERITY_EMOJI.error;
  const timestamp = new Date().toISOString();

  let formatted = `${emoji} ERROR ALERT\n`;
  formatted += `Time: ${timestamp}\n`;

  // Add count if > 1
  if (count && count > 1) {
    formatted += `Occurrences: ${count} times in last ${RATE_LIMIT_MS / 1000}s\n`;
  }

  formatted += `\nMessage: ${error.message}\n`;

  if (context && Object.keys(context).length > 0) {
    formatted += `\nContext:\n`;
    for (const [key, value] of Object.entries(context)) {
      const valueStr =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      formatted += `- ${key}: ${valueStr}\n`;
    }
  }

  if (error.stack) {
    formatted += `\nStack:\n${error.stack}\n`;
  }

  return truncateMessage(formatted, MAX_MESSAGE_LENGTH);
}

/**
 * Send admin alert to Telegram
 *
 * @param message - Alert message
 * @param severity - Alert severity level
 *
 * Non-blocking: Errors are logged but not thrown
 * Rate-limited: Max 1 alert per error type per minute
 *
 * @example
 * ```typescript
 * await sendAdminAlert("API request failed", "warning");
 * ```
 */
export async function sendAdminAlert(
  message: string,
  severity: AlertSeverity = "error",
  context?: Record<string, unknown>
): Promise<void> {
  try {
    // Check if admin chat ID is configured
    const env = getEnv();
    if (!env.ADMIN_CHAT_ID) {
      logger.debug("Admin alerts disabled (ADMIN_CHAT_ID not set)");
      return;
    }

    // Rate limiting
    const errorKey = hashString(`${severity}:${message}`);
    if (shouldRateLimit(errorKey)) {
      logger.debug("Admin alert rate-limited", { message, severity });
      return;
    }

    // Get count from cache
    const entry = alertCache.get(errorKey);
    const count = entry?.count || 1;

    // Format message with count
    const formattedMessage = formatAlertMessage(message, severity, context, count);

    // Send to admin
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, formattedMessage, {
      parse_mode: undefined, // Plain text to avoid HTML/Markdown issues
    });

    // Record alert (resets count)
    recordAlert(errorKey);

    logger.debug("Admin alert sent", { message, severity });
  } catch (error) {
    // Non-blocking: Log error but don't throw
    logger.error("Failed to send admin alert", {
      error: error instanceof Error ? error.message : String(error),
      originalMessage: message,
    });
  }
}

/**
 * Send error alert to admin with stack trace
 *
 * @param error - Error object
 * @param context - Additional context (user ID, file ID, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   await sendErrorAlert(error as Error, { userId: 123, fileId: "abc" });
 *   throw error;
 * }
 * ```
 */
export async function sendErrorAlert(
  error: Error,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    // Check if admin chat ID is configured
    const env = getEnv();
    if (!env.ADMIN_CHAT_ID) {
      logger.debug("Admin alerts disabled (ADMIN_CHAT_ID not set)");
      return;
    }

    // Transient connection errors (network blips toward the Supabase pooler)
    // are aggregated into one episode instead of per-message alerts (sym-s7lc)
    if (isTransientConnectionError(error.message)) {
      await handleTransientConnectionError(error, context);
      return;
    }

    // Rate limiting based on error message
    const errorKey = hashString(error.message);
    if (shouldRateLimit(errorKey)) {
      logger.debug("Error alert rate-limited", { error: error.message });
      return;
    }

    // Report to Sentry (always, even if Telegram alert fails below)
    captureException(error, context);

    // Get count from cache
    const entry = alertCache.get(errorKey);
    const count = entry?.count || 1;

    // Format message with count
    const formattedMessage = formatErrorAlert(error, context, count);

    // Send to admin
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, formattedMessage, {
      parse_mode: undefined,
    });

    // Record alert (resets count)
    recordAlert(errorKey);

    logger.debug("Error alert sent", { error: error.message });
  } catch (sendError) {
    // Non-blocking: Log error but don't throw
    logger.error("Failed to send error alert", {
      error: sendError instanceof Error ? sendError.message : String(sendError),
      originalError: error.message,
    });
  }
}
