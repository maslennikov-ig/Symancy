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
 * Rate limiting: Track last alert time per error type
 * Key: error message hash, Value: timestamp
 */
const alertCache = new Map<string, number>();

/**
 * Rate limit duration: 1 minute per unique error
 */
const RATE_LIMIT_MS = 60 * 1000;

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
 * Check if alert should be rate-limited
 */
function shouldRateLimit(errorKey: string): boolean {
  const lastAlertTime = alertCache.get(errorKey);
  if (!lastAlertTime) {
    return false;
  }

  const timeSinceLastAlert = Date.now() - lastAlertTime;
  return timeSinceLastAlert < RATE_LIMIT_MS;
}

/**
 * Record alert in rate limit cache
 */
function recordAlert(errorKey: string): void {
  alertCache.set(errorKey, Date.now());

  // Clean up old entries (older than 5 minutes)
  const cutoffTime = Date.now() - 5 * 60 * 1000;
  for (const [key, timestamp] of alertCache.entries()) {
    if (timestamp < cutoffTime) {
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
 * Format alert message with severity and timestamp
 */
function formatAlertMessage(
  message: string,
  severity: AlertSeverity,
  context?: Record<string, unknown>
): string {
  const emoji = SEVERITY_EMOJI[severity];
  const timestamp = new Date().toISOString();

  let formatted = `${emoji} ${severity.toUpperCase()} ALERT\n`;
  formatted += `Time: ${timestamp}\n\n`;
  formatted += `Message: ${message}\n`;

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
 * Format error alert message with stack trace
 */
function formatErrorAlert(
  error: Error,
  context?: Record<string, unknown>
): string {
  const emoji = SEVERITY_EMOJI.error;
  const timestamp = new Date().toISOString();

  let formatted = `${emoji} ERROR ALERT\n`;
  formatted += `Time: ${timestamp}\n\n`;
  formatted += `Message: ${error.message}\n`;

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

    // Format message
    const formattedMessage = formatAlertMessage(message, severity, context);

    // Send to admin
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, formattedMessage, {
      parse_mode: undefined, // Plain text to avoid HTML/Markdown issues
    });

    // Record alert
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

    // Rate limiting based on error message
    const errorKey = hashString(error.message);
    if (shouldRateLimit(errorKey)) {
      logger.debug("Error alert rate-limited", { error: error.message });
      return;
    }

    // Format message
    const formattedMessage = formatErrorAlert(error, context);

    // Send to admin
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, formattedMessage, {
      parse_mode: undefined,
    });

    // Record alert
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
