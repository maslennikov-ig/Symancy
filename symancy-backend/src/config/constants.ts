/**
 * Application constants
 * Per TZ section: TELEGRAM_LIMIT, SAFE_LIMIT, RETRY_ATTEMPTS
 */

// =============================================================================
// Telegram Limits
// =============================================================================

/**
 * Maximum message length for Telegram (characters)
 */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * Safe message length to avoid edge cases
 */
export const TELEGRAM_SAFE_LIMIT = 4000;

/**
 * Maximum photo size in bytes (10MB Telegram limit)
 */
export const TELEGRAM_PHOTO_SIZE_LIMIT = 10 * 1024 * 1024;

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Default retry attempts for failed operations
 */
export const RETRY_ATTEMPTS = 3;

/**
 * Base delay between retries in milliseconds
 */
export const RETRY_BASE_DELAY_MS = 1000;

/**
 * Maximum delay between retries in milliseconds
 */
export const RETRY_MAX_DELAY_MS = 30000;

// =============================================================================
// Image Processing
// =============================================================================

/**
 * Maximum image dimension (width/height) after resize
 */
export const IMAGE_MAX_DIMENSION = 800;

/**
 * Image format for processed photos
 */
export const IMAGE_FORMAT = "webp" as const;

/**
 * WebP quality (0-100)
 */
export const IMAGE_QUALITY = 85;

// =============================================================================
// Queue Names
// =============================================================================

/**
 * Queue name for photo analysis jobs
 */
export const QUEUE_ANALYZE_PHOTO = "analyze-photo";

/**
 * Queue name for chat reply jobs
 */
export const QUEUE_CHAT_REPLY = "chat-reply";

/**
 * Queue name for scheduled message jobs
 */
export const QUEUE_SEND_MESSAGE = "send-message";

// =============================================================================
// Rate Limits
// =============================================================================

/**
 * Maximum chat messages per user per day
 */
export const DAILY_CHAT_LIMIT = 50;

/**
 * Typing indicator update interval in milliseconds
 */
export const TYPING_INTERVAL_MS = 4000;

// =============================================================================
// Cache TTL
// =============================================================================

/**
 * Dynamic config cache TTL in seconds
 */
export const CONFIG_CACHE_TTL_SECONDS = 60;

/**
 * Chat history load limit (last N messages)
 */
export const CHAT_HISTORY_LIMIT = 20;

// =============================================================================
// LLM Models (OpenRouter)
// =============================================================================

/**
 * Model for Arina persona (interpretation)
 */
export const MODEL_ARINA = "anthropic/claude-3.5-sonnet";

/**
 * Model for Cassandra persona (alternative)
 */
export const MODEL_CASSANDRA = "anthropic/claude-3.5-sonnet";

/**
 * Model for general chat
 */
export const MODEL_CHAT = "anthropic/claude-3.5-sonnet";

/**
 * Model for vision analysis
 */
export const MODEL_VISION = "anthropic/claude-3.5-sonnet";

// =============================================================================
// Timeouts
// =============================================================================

/**
 * Default job timeout in milliseconds (5 minutes)
 */
export const JOB_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Health check timeout in milliseconds
 */
export const HEALTH_CHECK_TIMEOUT_MS = 5000;
