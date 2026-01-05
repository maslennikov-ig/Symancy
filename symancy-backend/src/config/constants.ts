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

/**
 * Maximum caption length for photo messages
 */
export const MAX_CAPTION_LENGTH = 1000;

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

/**
 * Queue name for inactive reminder engagement
 */
export const QUEUE_INACTIVE_REMINDER = "inactive-reminder";

/**
 * Queue name for weekly check-in engagement
 */
export const QUEUE_WEEKLY_CHECKIN = "weekly-checkin";

/**
 * Queue name for daily fortune engagement
 */
export const QUEUE_DAILY_FORTUNE = "daily-fortune";

/**
 * Queue name for photo cleanup
 */
export const QUEUE_PHOTO_CLEANUP = "photo-cleanup";

/**
 * Queue name for timezone-aware insight dispatcher (hourly)
 */
export const QUEUE_INSIGHT_DISPATCHER = "insight-dispatcher";

/**
 * Queue name for morning insights (legacy batch)
 */
export const QUEUE_MORNING_INSIGHT = "morning-insight";

/**
 * Queue name for evening insights (legacy batch)
 */
export const QUEUE_EVENING_INSIGHT = "evening-insight";

/**
 * Queue name for single-user morning insight jobs
 */
export const QUEUE_MORNING_INSIGHT_SINGLE = "morning-insight-single";

/**
 * Queue name for single-user evening insight jobs
 */
export const QUEUE_EVENING_INSIGHT_SINGLE = "evening-insight-single";

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
// Credit Costs
// =============================================================================

/**
 * Credit cost for Arina persona (basic tier)
 */
export const CREDIT_COST_ARINA = 1;

/**
 * Credit cost for Cassandra persona (premium tier)
 */
export const CREDIT_COST_CASSANDRA = 3;

// =============================================================================
// LLM Models (OpenRouter)
// =============================================================================

/**
 * Model for Arina persona (interpretation)
 */
export const MODEL_ARINA = "xiaomi/mimo-v2-flash:free";

/**
 * Model for Cassandra persona (alternative)
 */
export const MODEL_CASSANDRA = "xiaomi/mimo-v2-flash:free";

/**
 * Model for general chat
 */
export const MODEL_CHAT = "xiaomi/mimo-v2-flash:free";

/**
 * Model for vision analysis (multimodal)
 * Always operates in English - receives English prompts and returns English descriptions
 */
export const MODEL_VISION = "x-ai/grok-4.1-fast";

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

// =============================================================================
// Image Validation (Troll Protection)
// =============================================================================

/**
 * Minimum confidence threshold to REJECT an image
 * We only reject if model is THIS confident it's NOT coffee grounds
 * Higher value = more permissive (reject only when very sure)
 */
export const REJECTION_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Maximum number of personalized responses for invalid images per day
 * After this limit, we send a simple fallback message (no API cost)
 *
 * Rationale for value "2":
 * - Most users make at most 1 mistake (wrong photo, accidental send)
 * - Value of 2 allows for genuine mistake + one retry
 * - Serial trolls send 5+ invalid images, so 2 is enough to detect abuse
 * - Each personalized response costs ~200 tokens, fallback costs 0
 */
export const MAX_DAILY_INVALID_RESPONSES = 2;

/**
 * Simple fallback messages when daily limit exceeded
 * Used to save API costs while still being helpful
 */
export const INVALID_IMAGE_FALLBACK: Record<string, string> = {
  ru: "Пожалуйста, пришли фото кофейной гущи в чашке ☕",
  en: "Please send a photo of coffee grounds in a cup ☕",
  zh: "请发送一张杯中咖啡渣的照片 ☕",
};

/**
 * Get simple fallback message for language
 */
export function getInvalidImageFallback(language: string = "ru"): string {
  return INVALID_IMAGE_FALLBACK[language] || INVALID_IMAGE_FALLBACK["ru"]!;
}
