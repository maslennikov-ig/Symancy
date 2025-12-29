/**
 * Admin panel pagination and limit constants
 * Centralized configuration for consistent behavior across admin pages
 */

export const PAGE_SIZES = {
  USERS: 25,
  MESSAGES: 50,
  USER_STATES: 25,
  DEFAULT: 20,
} as const;

export const MAX_CREDIT_ADJUSTMENT = {
  basic: 1000,
  pro: 100,
  cassandra: 50,
} as const;

/**
 * Time thresholds for admin panel features
 */
export const TIME_THRESHOLDS = {
  /** Hours before a user in onboarding is considered "stuck" */
  STUCK_THRESHOLD_HOURS: 24,
  /** Debounce delay for search inputs in milliseconds */
  SEARCH_DEBOUNCE_MS: 300,
  /** Success message display duration in milliseconds */
  SUCCESS_MESSAGE_DURATION_MS: 3000,
} as const;
