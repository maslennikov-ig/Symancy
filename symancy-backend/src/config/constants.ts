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

/**
 * Queue name for retopic (re-reading another topic from same cup)
 */
export const QUEUE_RETOPIC_PHOTO = "retopic-photo";

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
// Reading Topics (Basic vs Pro differentiation)
// =============================================================================

/**
 * Available reading topics for fortune telling
 * Basic tier: user selects ONE topic
 * Pro tier: user gets ALL topics analyzed
 */
export const READING_TOPICS = [
  { key: "love", emoji: "❤️", label_ru: "Любовь", label_en: "Love", label_zh: "爱情" },
  { key: "career", emoji: "💼", label_ru: "Карьера", label_en: "Career", label_zh: "事业" },
  { key: "money", emoji: "💰", label_ru: "Финансы", label_en: "Money", label_zh: "财运" },
  { key: "health", emoji: "🏥", label_ru: "Здоровье", label_en: "Health", label_zh: "健康" },
  { key: "family", emoji: "👨‍👩‍👧", label_ru: "Семья", label_en: "Family", label_zh: "家庭" },
  { key: "spiritual", emoji: "🌟", label_ru: "Духовное", label_en: "Spiritual", label_zh: "心灵" },
] as const;

/**
 * Reading topic type (single topic or all)
 */
export type ReadingTopic = typeof READING_TOPICS[number]["key"] | "all";

/**
 * Topic focus instructions for interpretation prompt
 * Maps topic key to specific focus guidance
 */
export const TOPIC_FOCUS_INSTRUCTIONS: Record<ReadingTopic, Record<string, string>> = {
  love: {
    ru: "Сфокусируйся на любви и отношениях. Что говорит гуща о романтической жизни, партнёрстве, эмоциональных связях?",
    en: "Focus on love and relationships. What does the grounds say about romantic life, partnership, emotional connections?",
    zh: "专注于爱情和关系。咖啡渣对浪漫生活、伴侣关系、情感联系有什么启示?",
  },
  career: {
    ru: "Сфокусируйся на карьере и работе. Что видно про профессиональный путь, проекты, коллег, достижения?",
    en: "Focus on career and work. What's visible about professional path, projects, colleagues, achievements?",
    zh: "专注于事业和工作。关于职业道路、项目、同事、成就有什么启示?",
  },
  money: {
    ru: "Сфокусируйся на финансах и материальном благополучии. Деньги, инвестиции, возможности заработка.",
    en: "Focus on finances and material wellbeing. Money, investments, earning opportunities.",
    zh: "专注于财务和物质福祉。金钱、投资、赚钱机会。",
  },
  health: {
    ru: "Сфокусируйся на здоровье и энергии. Физическое и эмоциональное состояние, на что обратить внимание.",
    en: "Focus on health and energy. Physical and emotional state, what to pay attention to.",
    zh: "专注于健康和精力。身体和情绪状态，需要注意什么。",
  },
  family: {
    ru: "Сфокусируйся на семье и близких. Родители, дети, родственники, домашний очаг.",
    en: "Focus on family and loved ones. Parents, children, relatives, home life.",
    zh: "专注于家庭和亲人。父母、孩子、亲戚、家庭生活。",
  },
  spiritual: {
    ru: "Сфокусируйся на духовном развитии и внутреннем росте. Саморазвитие, смысл, предназначение.",
    en: "Focus on spiritual development and inner growth. Self-development, meaning, purpose.",
    zh: "专注于精神发展和内心成长。自我发展、意义、使命。",
  },
  all: {
    ru: "Дай полный анализ по всем сферам жизни: любовь, карьера, финансы, здоровье, семья, духовное развитие. Раздели на секции.",
    en: "Give a complete analysis of all life areas: love, career, finances, health, family, spiritual growth. Divide into sections.",
    zh: "对生活的各个方面进行全面分析:爱情、事业、财务、健康、家庭、精神成长。分章节阐述。",
  },
};

/**
 * Get topic label for language
 */
export function getTopicLabel(
  topicKey: string,
  language: string = "ru"
): string {
  const topic = READING_TOPICS.find((t) => t.key === topicKey);
  if (!topic) return topicKey;

  switch (language) {
    case "en":
      return `${topic.emoji} ${topic.label_en}`;
    case "zh":
      return `${topic.emoji} ${topic.label_zh}`;
    default:
      return `${topic.emoji} ${topic.label_ru}`;
  }
}

/**
 * Get topic focus instruction for interpretation
 */
export function getTopicFocusInstruction(
  topic: ReadingTopic,
  language: string = "ru"
): string {
  const instructions = TOPIC_FOCUS_INSTRUCTIONS[topic];
  return instructions[language] || instructions["ru"] || "";
}

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
export const MODEL_ARINA = "qwen/qwen3.6-plus";

/**
 * Model for Arina basic single-topic readings (cheapest tier)
 */
export const MODEL_ARINA_BASIC = "deepseek/deepseek-v4-flash";

/**
 * Model for Cassandra persona (premium, thinking model)
 */
export const MODEL_CASSANDRA = "moonshotai/kimi-k2-thinking";

/**
 * Model for general chat
 */
export const MODEL_CHAT = "deepseek/deepseek-v4-flash";

/**
 * Model for vision analysis (multimodal)
 * Always operates in English - receives English prompts and returns English descriptions
 */
export const MODEL_VISION = "google/gemma-4-31b-it";

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
