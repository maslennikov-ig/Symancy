/**
 * Topic selection keyboard for photo analysis flow
 * Allows users to choose a specific reading topic (Basic) or all topics (Pro)
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { READING_TOPICS } from "../../config/constants.js";

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
 * @param fileId - Telegram file ID of the photo. Embedded in callback data (topic:{key}:{fileId})
 *                 and retrieved when user selects a topic to enqueue the analysis job.
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

  // 2x3 grid layout for 6 topics
  for (let i = 0; i < READING_TOPICS.length; i += 2) {
    const topic1 = READING_TOPICS[i];
    const topic2 = READING_TOPICS[i + 1];

    if (topic1) {
      keyboard.text(
        getTopicButtonLabel(topic1, language),
        `topic:${topic1.key}:${fileId}`
      );
    }

    if (topic2) {
      keyboard.text(
        getTopicButtonLabel(topic2, language),
        `topic:${topic2.key}:${fileId}`
      );
    }

    keyboard.row();
  }

  // Bottom row: "All topics (PRO)" button
  const allLabel = ALL_TOPICS_LABELS[language] || ALL_TOPICS_LABELS["ru"]!;
  keyboard.text(allLabel, `topic:all:${fileId}`);

  return keyboard;
}

/**
 * Parse topic callback data
 * Format: topic:{topicKey}:{fileId}
 *
 * @param data - Callback data string from Telegram
 * @returns Parsed object with topicKey and fileId, or null if invalid
 *
 * @example
 * ```typescript
 * const result = parseTopicCallback("topic:love:AgACAgIAAxkBAAI...");
 * // { topicKey: "love", fileId: "AgACAgIAAxkBAAI..." }
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

  // Split into parts: ["topic", topicKey, ...fileIdParts]
  const parts = data.split(":");

  if (parts.length < 3) {
    return null;
  }

  const topicKey = parts[1];
  // Rejoin remaining parts in case fileId contains colons (unlikely but safe)
  const fileId = parts.slice(2).join(":");

  // Validate topicKey is not empty
  if (!topicKey || !fileId) {
    return null;
  }

  return { topicKey, fileId };
}

/**
 * Messages for topic selection prompt in different languages
 */
export const TOPIC_SELECTION_MESSAGES: Record<string, string> = {
  ru: "☕️ Фото получено! О чём хотите узнать?",
  en: "☕️ Photo received! What would you like to know about?",
  zh: "☕️ 照片已收到！您想了解什么？",
};

/**
 * Get topic selection prompt message for language
 */
export function getTopicSelectionMessage(language: string = "ru"): string {
  return TOPIC_SELECTION_MESSAGES[language] || TOPIC_SELECTION_MESSAGES["ru"]!;
}
