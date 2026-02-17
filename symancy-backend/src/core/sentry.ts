/**
 * Sentry error tracking integration
 * Lazy singleton pattern matching logger.ts and database.ts
 *
 * - Disabled gracefully when SENTRY_DSN is not set
 * - Captures exceptions and messages with structured context
 * - Flushes events before graceful shutdown
 */
import * as Sentry from "@sentry/node";
import { getEnv, isProduction } from "@/config/env.js";
import { getLogger } from "@/core/logger.js";

let _initialized = false;

/**
 * Initialize Sentry SDK
 * Safe to call multiple times; only initializes once.
 * Does nothing if SENTRY_DSN is not configured.
 */
export function initSentry(): void {
  if (_initialized) return;

  const env = getEnv();

  if (!env.SENTRY_DSN) {
    getLogger().info("Sentry disabled (SENTRY_DSN not set)");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.GIT_COMMIT || "unknown",
    tracesSampleRate: isProduction() ? 0.1 : 1.0,
  });

  _initialized = true;
  getLogger().info("Sentry initialized");
}

/**
 * Capture an exception and send it to Sentry
 * No-op if Sentry is not initialized.
 *
 * @param error - The error to capture
 * @param context - Additional context to attach as extra data
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (!_initialized) return;
  Sentry.captureException(error, { extra: context });
}

/**
 * Capture a message event and send it to Sentry
 * No-op if Sentry is not initialized.
 *
 * @param message - The message string
 * @param level - Sentry severity level (default: "info")
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
): void {
  if (!_initialized) return;
  Sentry.captureMessage(message, level);
}

/**
 * Flush all pending events and disable the Sentry SDK
 * Should be called during graceful shutdown.
 *
 * @param timeout - Maximum time in ms to wait for flush (default: 2000)
 */
export async function flushSentry(timeout = 2000): Promise<void> {
  if (!_initialized) return;
  await Sentry.close(timeout);
}
