/**
 * Daily Insight Constants
 * Extracted magic numbers from daily insight chain and workers
 */

// =============================================================================
// Text Processing
// =============================================================================

/**
 * Maximum length for short text preview (truncated with ellipsis)
 */
export const SHORT_TEXT_LENGTH = 100;

/**
 * Minimum percentage of maxLen to preserve when truncating at word boundary
 * Prevents cutting too short (e.g., "Hi..." instead of "Hello world...")
 */
export const TRUNCATE_MIN_RATIO = 0.7;

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Delay between processing users in batch jobs (milliseconds)
 * Prevents overwhelming external APIs and Telegram rate limits
 */
export const BATCH_RATE_LIMIT_DELAY_MS = 200;

// =============================================================================
// Context Loading
// =============================================================================

/**
 * Maximum number of recent messages to load for context
 */
export const MAX_RECENT_MESSAGES = 10;

/**
 * Maximum number of memories to retrieve for context
 */
export const MAX_MEMORIES = 5;

// =============================================================================
// LLM Configuration
// =============================================================================

/**
 * Maximum tokens for insight generation
 */
export const INSIGHT_MAX_TOKENS = 500;

/**
 * Default retry attempts for AI generation
 */
export const AI_RETRY_ATTEMPTS = 3;

/**
 * Initial delay for exponential backoff (milliseconds)
 */
export const AI_RETRY_INITIAL_DELAY_MS = 1000;

// =============================================================================
// Time Thresholds
// =============================================================================

/**
 * Hour (0-23) after which to show evening insight instead of morning
 */
export const EVENING_HOUR_THRESHOLD = 20;

/**
 * Hour (0-23) for morning insight delivery
 */
export const MORNING_INSIGHT_HOUR = 8;

/**
 * Hour (0-23) for evening insight delivery
 */
export const EVENING_INSIGHT_HOUR = 20;
