/**
 * Topic selection keyboard for photo analysis flow
 * Allows users to choose a specific reading topic (Basic) or all topics (Pro)
 *
 * Note: Uses short IDs for file references due to Telegram's 64-byte callback_data limit.
 * The storeFileId/resolveFileId functions handle the mapping.
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { READING_TOPICS } from "../../config/constants.js";
import { SingleTopicEnum } from "../../types/job-schemas.js";
import { storeFileId, resolveFileId } from "./file-id-cache.js";

/**
 * Labels for the "All topics" button in different languages
 */
const ALL_TOPICS_LABELS: Record<string, string> = {
  ru: "💎 Всё сразу (PRO)",
  en: "💎 All topics (PRO)",
  zh: "💎 全部主题 (PRO)",
};

/**
 * Get topic label for a specific language
 * @param topic - Topic object from READING_TOPICS
 * @param language - Language code (ru, en, zh)
 * @returns Formatted label with emoji
 */
function getTopicButtonLabel(
  topic: (typeof READING_TOPICS)[number],
  language: string
): string {
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
 * Create topic selection keyboard for photo analysis
 * Layout: 2x3 grid for 6 topics + bottom row for "All topics (PRO)"
 *
 * @param fileId - Telegram file ID of the photo. Stored in cache and referenced by short ID
 *                 in callback data (topic:{key}:{shortId}) to stay within Telegram's 64-byte limit.
 * @param language - User's language code (ru, en, zh)
 * @returns InlineKeyboardMarkup for grammY
 *
 * @example
 * ```typescript
 * const keyboard = createTopicKeyboard("AgACAgIAAxkBAAI...", "ru");
 * await ctx.reply("О чём хотите узнать?", { reply_markup: keyboard });
 * ```
 */
export function createTopicKeyboard(
  fileId: string,
  language: string = "ru"
): InlineKeyboardMarkup {
  const keyboard = new InlineKeyboard();

  // Store fileId and get short ID for callback_data (Telegram 64-byte limit)
  const shortId = storeFileId(fileId);

  // 2x3 grid layout for 6 topics
  for (let i = 0; i < READING_TOPICS.length; i += 2) {
    const topic1 = READING_TOPICS[i];
    const topic2 = READING_TOPICS[i + 1];

    if (topic1) {
      keyboard.text(
        getTopicButtonLabel(topic1, language),
        `topic:${topic1.key}:${shortId}`
      );
    }

    if (topic2) {
      keyboard.text(
        getTopicButtonLabel(topic2, language),
        `topic:${topic2.key}:${shortId}`
      );
    }

    keyboard.row();
  }

  // Bottom row: "All topics (PRO)" button
  const allLabel = ALL_TOPICS_LABELS[language] || ALL_TOPICS_LABELS["ru"]!;
  keyboard.text(allLabel, `topic:all:${shortId}`);

  return keyboard;
}

/**
 * Parse topic callback data
 * Format: topic:{topicKey}:{shortId}
 *
 * The shortId is resolved back to the original fileId using the cache.
 *
 * @param data - Callback data string from Telegram
 * @returns Parsed object with topicKey and fileId, or null if invalid/expired
 *
 * @example
 * ```typescript
 * const result = parseTopicCallback("topic:love:abc123xyz0");
 * // { topicKey: "love", fileId: "AgACAgIAAxkBAAI..." } or null if expired
 * ```
 */
export function parseTopicCallback(data: string): {
  topicKey: string;
  fileId: string;
} | null {
  // Validate format starts with "topic:"
  if (!data.startsWith("topic:")) {
    return null;
  }

  // Split into parts: ["topic", topicKey, shortId]
  const parts = data.split(":");

  if (parts.length < 3) {
    return null;
  }

  const topicKey = parts[1];
  const shortId = parts[2];

  // Validate topicKey and shortId are not empty
  if (!topicKey || !shortId) {
    return null;
  }

  // Resolve shortId back to fileId
  const fileId = resolveFileId(shortId);

  if (!fileId) {
    // Short ID not found or expired
    return null;
  }

  return { topicKey, fileId };
}

/**
 * Messages for topic selection prompt in different languages
 * Explains Basic (single topic) vs Pro (all topics) credit usage
 */
export const TOPIC_SELECTION_MESSAGES: Record<string, string> = {
  ru: "☕️ Фото получено!\n\nВыберите тему (1 Basic-кредит) или получите полный анализ (1 Pro-кредит):",
  en: "☕️ Photo received!\n\nChoose a topic (1 Basic credit) or get full analysis (1 Pro credit):",
  zh: "☕️ 照片已收到！\n\n选择主题（1个Basic积分）或获取完整分析（1个Pro积分）:",
};

/**
 * Get topic selection prompt message for language
 */
export function getTopicSelectionMessage(language: string = "ru"): string {
  return TOPIC_SELECTION_MESSAGES[language] || TOPIC_SELECTION_MESSAGES["ru"]!;
}

// =============================================================================
// Retopic Keyboard (re-reading another topic from same cup)
// =============================================================================

/**
 * Prompt messages for retopic keyboard in different languages
 * Shown above the retopic inline keyboard after a reading is complete
 */
export const RETOPIC_MESSAGES: Record<string, string> = {
  ru: "☕ Хотите узнать о другой теме? (1 Basic-кредит)",
  en: "☕ Want to read another topic? (1 Basic credit)",
  zh: "☕ 想了解其他主题吗？（1个Basic积分）",
};

/**
 * Valid single topic keys (derived from SingleTopicEnum, excludes "all")
 */
const VALID_SINGLE_TOPICS: Set<string> = new Set(SingleTopicEnum.options);

/**
 * UUID v4 format regex for validation
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create retopic keyboard for selecting another topic from the same cup
 * Filters out topics already covered in the analysis session
 *
 * @param analysisId - UUID of the original analysis record
 * @param coveredTopics - Array of topic keys already read in this session
 * @param language - User's language code (ru, en, zh)
 * @returns InlineKeyboardMarkup or null if no remaining topics
 *
 * @example
 * ```typescript
 * const keyboard = createRetopicKeyboard("uuid-here", ["love", "career"], "ru");
 * if (keyboard) {
 *   await ctx.reply(RETOPIC_MESSAGES["ru"], { reply_markup: keyboard });
 * }
 * ```
 */
export function createRetopicKeyboard(
  analysisId: string,
  coveredTopics: string[],
  language: string = "ru"
): InlineKeyboardMarkup | null {
  // Filter READING_TOPICS excluding already covered topics
  const coveredSet = new Set(coveredTopics);
  const remainingTopics = READING_TOPICS.filter(
    (topic) => !coveredSet.has(topic.key)
  );

  // No remaining topics to show
  if (remainingTopics.length === 0) {
    return null;
  }

  const keyboard = new InlineKeyboard();

  // 2-column grid layout (same as createTopicKeyboard)
  for (let i = 0; i < remainingTopics.length; i += 2) {
    const topic1 = remainingTopics[i];
    const topic2 = remainingTopics[i + 1];

    if (topic1) {
      keyboard.text(
        getTopicButtonLabel(topic1, language),
        `rt:${topic1.key}:${analysisId}`
      );
    }

    if (topic2) {
      keyboard.text(
        getTopicButtonLabel(topic2, language),
        `rt:${topic2.key}:${analysisId}`
      );
    }

    keyboard.row();
  }

  return keyboard;
}

/**
 * Parse retopic callback data
 * Format: rt:{topicKey}:{analysisId}
 *
 * @param data - Callback data string from Telegram
 * @returns Parsed object with topicKey and analysisId, or null if invalid
 *
 * @example
 * ```typescript
 * const result = parseRetopicCallback("rt:love:550e8400-e29b-41d4-a716-446655440000");
 * // { topicKey: "love", analysisId: "550e8400-e29b-41d4-a716-446655440000" }
 * ```
 */
export function parseRetopicCallback(data: string): {
  topicKey: string;
  analysisId: string;
} | null {
  // Validate format starts with "rt:"
  if (!data.startsWith("rt:")) {
    return null;
  }

  // Split into exactly 3 parts: ["rt", topicKey, analysisId]
  const parts = data.split(":");

  if (parts.length !== 3) {
    return null;
  }

  const topicKey = parts[1];
  const analysisId = parts[2];

  // Validate topicKey is not empty and is a valid single topic
  if (!topicKey || !VALID_SINGLE_TOPICS.has(topicKey)) {
    return null;
  }

  // Validate analysisId looks like UUID format
  if (!analysisId || !UUID_REGEX.test(analysisId)) {
    return null;
  }

  return { topicKey, analysisId };
}
