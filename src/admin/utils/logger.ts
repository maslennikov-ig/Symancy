/**
 * Admin panel logger utility
 * Provides consistent logging with [Admin] prefix and environment-aware behavior
 */

const PREFIX = '[Admin]';

export const logger = {
  /**
   * Log an error with optional error object
   * Always logs in all environments
   */
  error: (message: string, error?: unknown) => {
    console.error(`${PREFIX} ${message}:`, error);
    // Could integrate with error tracking (Sentry, etc.)
  },

  /**
   * Log a warning with optional data
   * Always logs in all environments
   */
  warn: (message: string, data?: unknown) => {
    console.warn(`${PREFIX} ${message}`, data);
  },

  /**
   * Log info message with optional data
   * Only logs in development environment
   */
  info: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.info(`${PREFIX} ${message}`, data);
    }
  },

  /**
   * Log debug message with optional data
   * Only logs in development environment
   */
  debug: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.debug(`${PREFIX} ${message}`, data);
    }
  },
};
