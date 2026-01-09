/**
 * Topic callback handler for photo analysis flow
 * Handles user selection of reading topic from inline keyboard
 */
import type { BotContext } from "../router/middleware.js";
import type { PhotoAnalysisJobData } from "../../types/job-schemas.js";
import type { CreditType, ReadingTopic } from "../../types/job-schemas.js";
import { getLogger } from "../../core/logger.js";
import { sendAnalyzePhotoJob } from "../../core/queue.js";
import { hasCreditsOfType } from "../credits/service.js";
import { parseTopicCallback } from "./keyboards.js";
import { arinaStrategy } from "./personas/arina.strategy.js";

const logger = getLogger().child({ module: "topic-handler" });

/**
 * Insufficient credits error messages in different languages
 * Now supports credit type differentiation
 */
const INSUFFICIENT_CREDITS_MESSAGES: Record<string, Record<string, string>> = {
  basic: {
    ru: "У вас недостаточно Basic-кредитов. Используйте /credits для проверки баланса.",
    en: "You don't have enough Basic credits. Use /credits to check your balance.",
    zh: "您没有足够的Basic积分。使用 /credits 查看您的余额。",
  },
  pro: {
    ru: "У вас недостаточно Pro-кредитов для полного анализа. Используйте /credits для проверки баланса.",
    en: "You don't have enough Pro credits for full analysis. Use /credits to check your balance.",
    zh: "您没有足够的Pro积分进行完整分析。使用 /credits 查看您的余额。",
  },
};

/**
 * Get insufficient credits message for language and credit type
 */
function getInsufficientCreditsMessage(creditType: CreditType, language: string = "ru"): string {
  const messages = INSUFFICIENT_CREDITS_MESSAGES[creditType] || INSUFFICIENT_CREDITS_MESSAGES["basic"]!;
  return messages[language] || messages["ru"]!;
}

/**
 * Valid topic keys including "all"
 */
const VALID_TOPICS = new Set([
  "love",
  "career",
  "money",
  "health",
  "family",
  "spiritual",
  "all",
]);

/**
 * Handle topic selection callback from inline keyboard
 *
 * Flow:
 * 1. Parse callback data (topic:{topicKey}:{fileId})
 * 2. Determine credit type (basic for single topic, pro for "all")
 * 3. Check if user has sufficient credits
 * 4. Answer callback query
 * 5. Edit message to loading state
 * 6. Enqueue PhotoAnalysisJob with topic and creditType
 *
 * @param ctx - Extended grammY context with user profile and state
 */
export async function handleTopicCallback(ctx: BotContext): Promise<void> {
  // Type guards
  if (!ctx.callbackQuery?.data || !ctx.from || !ctx.chat) {
    logger.warn("Invalid topic callback context");
    return;
  }

  const telegramUserId = ctx.from.id;
  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  logger.info({ telegramUserId, callbackData }, "Received topic callback");

  // Parse callback data
  const parsed = parseTopicCallback(callbackData);
  if (!parsed) {
    logger.warn({ telegramUserId, callbackData }, "Failed to parse topic callback data");
    await ctx.answerCallbackQuery({ text: "Invalid callback data" });
    return;
  }

  const { topicKey, fileId } = parsed;

  // Validate fileId format (basic check for Telegram file ID)
  // Telegram file IDs are base64-like strings, typically 40+ chars
  if (!fileId || fileId.length < 20) {
    logger.warn({ telegramUserId, fileId }, "Invalid file ID format");
    await ctx.answerCallbackQuery({ text: "Invalid photo reference" });
    return;
  }

  // Validate topic key
  if (!VALID_TOPICS.has(topicKey)) {
    logger.warn({ telegramUserId, topicKey }, "Invalid topic key");
    await ctx.answerCallbackQuery({ text: "Invalid topic" });
    return;
  }

  // Determine credit type: "pro" for "all", "basic" for single topic
  const creditType: CreditType = topicKey === "all" ? "pro" : "basic";
  const topic: ReadingTopic = topicKey as ReadingTopic;

  logger.info(
    { telegramUserId, topic, creditType, fileId },
    "Processing topic selection"
  );

  // Check if user has sufficient credits of the correct type
  // Basic topics use basic credits, "all" uses pro credits
  const hasSufficientCredits = await hasCreditsOfType(telegramUserId, creditType);

  if (!hasSufficientCredits) {
    const userLanguage =
      ctx.profile?.language_code || ctx.from.language_code || "ru";
    const errorMessage = getInsufficientCreditsMessage(creditType, userLanguage);

    logger.info({ telegramUserId, topic, creditType }, "Insufficient credits");
    await ctx.answerCallbackQuery({
      text: errorMessage,
      show_alert: true, // Show as popup
    });
    return;
  }

  // Answer callback query (removes loading indicator)
  await ctx.answerCallbackQuery();

  // Get user language
  const userLanguage =
    ctx.profile?.language_code || ctx.from.language_code || "ru";

  // Edit message to loading state using persona's loading message
  const loadingText = arinaStrategy.getLoadingMessage(userLanguage);

  // Get the message ID from the callback query
  const messageId = ctx.callbackQuery.message?.message_id;

  if (!messageId) {
    logger.warn({ telegramUserId }, "No message ID in callback query");
    // Fall back to sending a new message
    const loadingMessage = await ctx.reply(loadingText);
    await enqueueJob({
      telegramUserId,
      chatId,
      messageId: loadingMessage.message_id,
      fileId,
      topic,
      creditType,
      language: userLanguage,
      userName: ctx.profile?.name || ctx.from.username || ctx.from.first_name || undefined,
    });
    return;
  }

  // Edit the original message to show loading state (removes keyboard)
  try {
    await ctx.api.editMessageText(chatId, messageId, loadingText);
  } catch (error) {
    logger.warn(
      { telegramUserId, messageId, error },
      "Failed to edit message to loading state"
    );
    // Continue with job enqueueing anyway - message state is not critical
  }

  // Enqueue the job
  await enqueueJob({
    telegramUserId,
    chatId,
    messageId,
    fileId,
    topic,
    creditType,
    language: userLanguage,
    userName: ctx.profile?.name || ctx.from.username || ctx.from.first_name || undefined,
  });
}

/**
 * Enqueue photo analysis job
 */
async function enqueueJob(params: {
  telegramUserId: number;
  chatId: number;
  messageId: number;
  fileId: string;
  topic: ReadingTopic;
  creditType: CreditType;
  language: string;
  userName?: string;
}): Promise<void> {
  const {
    telegramUserId,
    chatId,
    messageId,
    fileId,
    topic,
    creditType,
    language,
    userName,
  } = params;

  // Prepare job data
  const jobData: PhotoAnalysisJobData = {
    telegramUserId,
    chatId,
    messageId,
    fileId,
    persona: "arina", // Default persona for now
    language,
    userName,
    topic,
    creditType,
  };

  // Enqueue job
  const jobId = await sendAnalyzePhotoJob(jobData);

  if (!jobId) {
    logger.error(
      { telegramUserId, topic, creditType },
      "Failed to enqueue photo analysis job"
    );
    return;
  }

  logger.info(
    {
      jobId,
      telegramUserId,
      topic,
      creditType,
      fileId,
    },
    "Photo analysis job queued with topic"
  );
}
