/**
 * Retopic callback handler for photo analysis flow
 * Handles user selection of another reading topic from the same cup (inline keyboard)
 *
 * Flow: User completes a reading -> sees retopic keyboard -> selects new topic ->
 *       this handler validates & enqueues a retopic job using the existing vision_result
 */
import type { BotContext } from "../router/middleware.js";
import type { RetopicJobData } from "../../types/job-schemas.js";
import { getLogger } from "../../core/logger.js";
import { getSupabase } from "../../core/database.js";
import { sendRetopicJob } from "../../core/queue.js";
import { hasCreditsOfType } from "../credits/service.js";
import { parseRetopicCallback } from "./keyboards.js";
import { arinaStrategy } from "./personas/arina.strategy.js";
import { cassandraStrategy } from "./personas/cassandra.strategy.js";
import type { PersonaStrategy } from "./personas/arina.strategy.js";

const PERSONA_STRATEGIES: Record<"arina" | "cassandra", PersonaStrategy> = {
  arina: arinaStrategy,
  cassandra: cassandraStrategy,
};

const logger = getLogger().child({ module: "retopic-handler" });

/**
 * Session expired error messages in different languages
 */
const SESSION_EXPIRED_MESSAGES: Record<string, string> = {
  ru: "Сессия истекла. Отправьте новое фото.",
  en: "Session expired. Please send a new photo.",
  zh: "会话已过期。请发送新照片。",
};

/**
 * Topic already covered messages in different languages
 */
const TOPIC_ALREADY_COVERED_MESSAGES: Record<string, string> = {
  ru: "Вы уже получили толкование по этой теме.",
  en: "You already received a reading for this topic.",
  zh: "您已经获得了该主题的解读。",
};

/**
 * Insufficient credits error messages in different languages
 */
const INSUFFICIENT_CREDITS_MESSAGES: Record<string, string> = {
  ru: "Недостаточно Basic-кредитов. /credits для проверки баланса.",
  en: "Not enough Basic credits. /credits to check balance.",
  zh: "Basic积分不足。/credits 查看余额。",
};

/**
 * Get session expired message for language
 */
function getSessionExpiredMessage(language: string = "ru"): string {
  return SESSION_EXPIRED_MESSAGES[language] || SESSION_EXPIRED_MESSAGES["ru"]!;
}

/**
 * Get insufficient credits message for language
 */
function getTopicAlreadyCoveredMessage(language: string = "ru"): string {
  return (
    TOPIC_ALREADY_COVERED_MESSAGES[language] ||
    TOPIC_ALREADY_COVERED_MESSAGES["ru"]!
  );
}

function getInsufficientCreditsMessage(language: string = "ru"): string {
  return (
    INSUFFICIENT_CREDITS_MESSAGES[language] ||
    INSUFFICIENT_CREDITS_MESSAGES["ru"]!
  );
}

/**
 * Handle retopic selection callback from inline keyboard
 *
 * Flow:
 * 1. Parse callback data (rt:{topicKey}:{analysisId})
 * 2. Fetch original analysis from database
 * 3. Validate analysis ownership and status
 * 4. Check if user has sufficient basic credits
 * 5. Answer callback query
 * 6. Edit message to loading state
 * 7. Enqueue RetopicJob with existing vision_result
 *
 * @param ctx - Extended grammY context with user profile and state
 */
export async function handleRetopicCallback(ctx: BotContext): Promise<void> {
  // Type guards
  if (!ctx.callbackQuery?.data || !ctx.from || !ctx.chat) {
    logger.warn("Invalid retopic callback context");
    return;
  }

  const telegramUserId = ctx.from.id;
  const chatId = ctx.chat.id;
  const callbackData = ctx.callbackQuery.data;

  logger.info({ telegramUserId, callbackData }, "Received retopic callback");

  // Parse callback data
  const parsed = parseRetopicCallback(callbackData);
  if (!parsed) {
    logger.warn(
      { telegramUserId, callbackData },
      "Failed to parse retopic callback data"
    );
    await ctx.answerCallbackQuery({ text: "Invalid callback" });
    return;
  }

  const { topicKey, analysisId } = parsed;

  // Get user language
  const userLanguage =
    ctx.profile?.language_code || ctx.from.language_code || "ru";

  // Fetch original analysis from database
  const supabase = getSupabase();
  const { data: analysis, error: fetchError } = await supabase
    .from("analysis_history")
    .select(
      "id, telegram_user_id, persona, vision_result, session_group_id, status"
    )
    .eq("id", analysisId)
    .single();

  if (fetchError) {
    logger.warn(
      { telegramUserId, analysisId, error: fetchError },
      "Failed to fetch analysis for retopic"
    );
    await ctx.answerCallbackQuery({
      text: getSessionExpiredMessage(userLanguage),
      show_alert: true,
    });
    return;
  }

  // Validate analysis exists and is in a valid state
  if (!analysis) {
    logger.warn(
      { telegramUserId, analysisId },
      "Analysis not found for retopic"
    );
    await ctx.answerCallbackQuery({
      text: getSessionExpiredMessage(userLanguage),
      show_alert: true,
    });
    return;
  }

  if (analysis.status !== "completed") {
    logger.warn(
      { telegramUserId, analysisId, status: analysis.status },
      "Analysis not completed for retopic"
    );
    await ctx.answerCallbackQuery({
      text: getSessionExpiredMessage(userLanguage),
      show_alert: true,
    });
    return;
  }

  if (!analysis.vision_result) {
    logger.warn(
      { telegramUserId, analysisId },
      "Analysis has no vision_result for retopic"
    );
    await ctx.answerCallbackQuery({
      text: getSessionExpiredMessage(userLanguage),
      show_alert: true,
    });
    return;
  }

  // Security: verify analysis belongs to the requesting user
  if (analysis.telegram_user_id !== ctx.from.id) {
    logger.warn(
      {
        telegramUserId,
        analysisId,
        analysisOwner: analysis.telegram_user_id,
      },
      "Retopic ownership check failed"
    );
    await ctx.answerCallbackQuery({
      text: getSessionExpiredMessage(userLanguage),
      show_alert: true,
    });
    return;
  }

  // Check if topic was already covered in this session group
  if (analysis.session_group_id) {
    const { data: coveredRows } = await supabase
      .from("analysis_history")
      .select("topic")
      .eq("session_group_id", analysis.session_group_id)
      .eq("status", "completed")
      .neq("topic", "all");

    const coveredTopics = (coveredRows || []).map((r: { topic: string }) => r.topic);
    if (coveredTopics.includes(topicKey)) {
      logger.warn(
        { telegramUserId, topicKey, analysisId },
        "User attempted to retopic an already covered topic"
      );
      await ctx.answerCallbackQuery({
        text: getTopicAlreadyCoveredMessage(userLanguage),
        show_alert: true,
      });
      return;
    }
  }

  // CR-002 fix: Answer callback and edit message BEFORE credit check
  // This disables the keyboard immediately, preventing double-click race condition
  await ctx.answerCallbackQuery();

  const strategy = PERSONA_STRATEGIES[analysis.persona as "arina" | "cassandra"] || arinaStrategy;
  const loadingText = strategy.getLoadingMessage(userLanguage);
  const messageId = ctx.callbackQuery.message?.message_id;

  // CR-005 fix: Require valid messageId
  if (!messageId) {
    logger.error({ telegramUserId, analysisId }, "Missing message ID in retopic callback");
    return;
  }

  try {
    await ctx.api.editMessageText(chatId, messageId, loadingText);
  } catch (error) {
    logger.warn(
      { error },
      "Failed to edit retopic message to loading state"
    );
  }

  // Check credits AFTER disabling buttons (race-safe)
  const hasSufficientCredits = await hasCreditsOfType(
    telegramUserId,
    "basic"
  );

  if (!hasSufficientCredits) {
    logger.info(
      { telegramUserId, topicKey, analysisId },
      "Insufficient credits for retopic"
    );
    // Restore the message with error text (button already removed)
    try {
      await ctx.api.editMessageText(
        chatId,
        messageId,
        getInsufficientCreditsMessage(userLanguage)
      );
    } catch {
      // Ignore edit failure
    }
    return;
  }

  // Enqueue retopic job
  const jobData: RetopicJobData = {
    telegramUserId,
    chatId,
    messageId,
    analysisId,
    persona: analysis.persona as "arina" | "cassandra",
    topic: topicKey as RetopicJobData["topic"],
    language: userLanguage,
    userName:
      ctx.profile?.name ||
      ctx.from.username ||
      ctx.from.first_name ||
      undefined,
  };

  const jobId = await sendRetopicJob(jobData);

  if (!jobId) {
    logger.error(
      { telegramUserId, topicKey, analysisId },
      "Failed to enqueue retopic job"
    );
    return;
  }

  logger.info(
    {
      jobId,
      telegramUserId,
      topicKey,
      analysisId,
    },
    "Retopic job queued"
  );
}
