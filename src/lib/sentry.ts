/**
 * Sentry Error Tracking Integration
 *
 * Initializes Sentry for error tracking and performance monitoring.
 * Gracefully degrades when VITE_SENTRY_DSN is not set (dev environments).
 *
 * @module lib/sentry
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry SDK.
 * Must be called before any other code runs (before React mounts).
 * No-ops gracefully if VITE_SENTRY_DSN is not configured.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.debug('[Sentry] Disabled (VITE_SENTRY_DSN not set)');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

/**
 * Capture an exception and send it to Sentry.
 * No-ops gracefully if Sentry is not initialized.
 *
 * @param error - The error to capture
 * @param context - Optional extra context to attach to the event
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}
