/**
 * Chat message handler for follow-up questions and conversations
 * Validates text messages, checks daily limits, and queues chat jobs
 */
import type { BotContext } from "../router/middleware.js";
import type { ChatReplyJobData } from "../../types/telegram.js";
import { getLogger } from "../../core/logger.js";
import { hasCredits } from "../credits/service.js";
import { sendJob } from "../../core/queue.js";
import { isMaintenanceMode } from "../config/service.js";
import { getSupabase } from "../../core/database.js";
import { findOrCreateByTelegramId } from "../../services/user/UnifiedUserService.js";
import { getOrCreateConversation } from "../../services/conversation/ConversationService.js";
import {
  QUEUE_CHAT_REPLY,
  TELEGRAM_SAFE_LIMIT,
  DAILY_CHAT_LIMIT,
} from "../../config/constants.js";

const logger = getLogger().child({ module: "chat-handler" });

/**
 * Message for when daily limit is reached
 */
const LIMIT_REACHED_MESSAGE =
  "📊 Вы достигли лимита сообщений на сегодня (50 сообщений).\n" +
  "Лимит обновится завтра. Вы также можете отправить фото для нового гадания.";

/**
 * Check if user has reached daily message limit
 * Returns remaining messages count
 *
 * @param telegramUserId - Telegram user ID
 * @returns Object with allowed flag and remaining count
 */
async function checkDailyLimit(
  telegramUserId: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = getSupabase();

  // Get current user state
  const { data: userState, error } = await supabase
    .from("user_states")
    .select("daily_messages_count, last_message_date")
    .eq("telegram_user_id", telegramUserId)
    .single();

  if (error) {
    logger.error(
      { error, telegramUserId },
      "Failed to fetch user state for daily limit check"
    );
    // Allow on error (fail open)
    return { allowed: true, remaining: DAILY_CHAT_LIMIT };
  }

  // If no state record, user is new - allow
  if (!userState) {
    return { allowed: true, remaining: DAILY_CHAT_LIMIT };
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const lastMessageDate = userState.last_message_date;

  // If no previous messages or different day, reset count
  if (!lastMessageDate || lastMessageDate !== today) {
    return { allowed: true, remaining: DAILY_CHAT_LIMIT };
  }

  // Same day - check count
  const count = userState.daily_messages_count || 0;
  const remaining = DAILY_CHAT_LIMIT - count;

  if (count >= DAILY_CHAT_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining };
}

/**
 * Handle text message from Telegram
 * Main entry point for chat-based follow-up questions
 *
 * Flow:
 * 1. Validate context and text
 * 2. Skip commands (handled separately)
 * 3. Check maintenance mode
 * 4. Validate text length (max 4000 chars)
 * 5. Sanitize text (remove control characters)
 * 6. Check daily message limit
 * 7. Check user credits
 * 8. Send typing action
 * 9. Enqueue background job
 *
 * @param ctx - Extended grammY context with user profile and state
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  // Type guards: Ensure required context data exists
  if (!ctx.message?.text || !ctx.chat || !ctx.from) {
    logger.warn("Invalid text message context");
    return;
  }

  let text = ctx.message.text;

  // Skip commands (handled separately)
  if (text.startsWith("/")) {
    logger.debug({ telegramUserId: ctx.from.id }, "Skipping command message");
    return;
  }

  const telegramUserId = ctx.from.id;
  const chatId = ctx.chat.id;

  logger.info({ telegramUserId, textLength: text.length }, "Received text message");

  // Check maintenance mode (early exit)
  if (await isMaintenanceMode()) {
    await ctx.reply("⚙️ Бот находится на обслуживании. Попробуйте позже.");
    return;
  }

  // Validate text length (4000 chars max)
  if (text.length > TELEGRAM_SAFE_LIMIT) {
    logger.warn(
      { telegramUserId, textLength: text.length },
      "Text message too long"
    );
    await ctx.reply(
      `📝 Сообщение слишком длинное. Максимум ${TELEGRAM_SAFE_LIMIT} символов.`
    );
    return;
  }

  // Sanitize text: remove null bytes and control characters
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // Check if text is empty after sanitization
  if (text.trim().length === 0) {
    logger.warn({ telegramUserId }, "Text message empty after sanitization");
    return;
  }

  // Check daily message limit
  const { allowed, remaining } = await checkDailyLimit(telegramUserId);

  if (!allowed) {
    logger.info({ telegramUserId }, "User reached daily message limit");
    await ctx.reply(LIMIT_REACHED_MESSAGE);
    return;
  }

  logger.debug(
    { telegramUserId, remaining },
    "Daily limit check passed"
  );

  // Check if user has credits (must have at least 1 credit)
  if (!(await hasCredits(telegramUserId, 1))) {
    logger.info({ telegramUserId }, "User has insufficient credits for chat");
    await ctx.reply(
      "💳 У вас недостаточно кредитов для чата.\n" +
        "Пожалуйста, пополните баланс."
    );
    return;
  }

  // Get or create unified user for this Telegram user
  // Map Telegram language code to our supported languages (ru, en, zh)
  const telegramLang = ctx.from.language_code || 'ru';
  const supportedLang = telegramLang.startsWith('zh') ? 'zh' :
                       telegramLang.startsWith('en') ? 'en' : 'ru';

  const unifiedUser = await findOrCreateByTelegramId({
    telegramId: ctx.from.id,
    displayName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    languageCode: supportedLang,
  });

  logger.debug(
    { telegramUserId, unifiedUserId: unifiedUser.id },
    'Unified user resolved'
  );

  // Get or create active conversation for this user
  const conversation = await getOrCreateConversation(unifiedUser.id);

  logger.debug(
    {
      telegramUserId,
      conversationId: conversation.id,
      messageCount: conversation.message_count,
    },
    'Active conversation resolved'
  );

  // Store incoming message to messages table with omnichannel fields
  const supabase = getSupabase();
  const { data: storedMessage, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      channel: 'telegram',
      interface: 'bot',
      role: 'user',
      content: text,
      content_type: 'text',
      metadata: {
        telegram_message_id: ctx.message.message_id,
        telegram_chat_id: chatId,
      },
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (messageError) {
    logger.error(
      { error: messageError, telegramUserId, conversationId: conversation.id },
      'Failed to store message'
    );
    await ctx.reply('❌ Не удалось сохранить сообщение. Попробуйте ещё раз.');
    return;
  }

  logger.info(
    {
      telegramUserId,
      conversationId: conversation.id,
      messageId: storedMessage.id,
      textLength: text.length,
    },
    'Message stored successfully'
  );

  // Send typing action (immediate feedback)
  await ctx.replyWithChatAction("typing");

  // Prepare job data for background worker
  const jobData: ChatReplyJobData = {
    telegramUserId,
    chatId,
    messageId: ctx.message.message_id,
    text,
    // Add omnichannel fields
    omnichannelMessageId: storedMessage.id,
    conversationId: conversation.id,
  };

  // Enqueue job to pg-boss
  const jobId = await sendJob(QUEUE_CHAT_REPLY, jobData);

  if (!jobId) {
    logger.error({ telegramUserId }, "Failed to enqueue chat reply job");
    await ctx.reply("❌ Не удалось обработать запрос. Попробуйте ещё раз.");
    return;
  }

  logger.info(
    {
      jobId,
      telegramUserId,
      textLength: text.length,
    },
    "Chat reply job queued"
  );
}
