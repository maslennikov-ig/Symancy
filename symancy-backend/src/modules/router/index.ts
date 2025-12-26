/**
 * Main message dispatcher for routing Telegram updates
 * Sets up bot handlers, middleware, and message processing logic
 */
import { getBot } from "../../core/telegram.js";
import { getLogger } from "../../core/logger.js";
import { loadProfile, loadUserState, checkBanned, type BotContext } from "./middleware.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { sendJob } from "../../core/queue.js";
import { isMaintenanceMode } from "../config/service.js";
import { QUEUE_CHAT_REPLY } from "../../config/constants.js";
import { hasCredits } from "../credits/service.js";
import { handlePhotoMessage } from "../photo-analysis/handler.js";
import type { ChatReplyJobData } from "../../types/telegram.js";

const logger = getLogger().child({ module: "router" });

/**
 * Setup bot message handlers and middleware
 * Call this once during application startup
 */
export function setupRouter(): void {
  const bot = getBot();

  // Apply middleware in order
  bot.use(loadProfile);
  bot.use(loadUserState);
  bot.use(checkBanned);
  bot.use(rateLimitMiddleware);

  // Handle /start command
  bot.command("start", async (ctx: BotContext) => {
    logger.info({ telegramUserId: ctx.from?.id }, "Received /start command");

    // Check if onboarding needed
    if (!ctx.userState?.onboarding_step && !ctx.profile?.onboarding_completed) {
      // TODO: Start onboarding flow (Phase 5)
      await ctx.reply("Добро пожаловать! Давайте познакомимся...");
      return;
    }

    await ctx.reply("Привет! Отправьте мне фото кофейной гущи для гадания.");
  });

  // Handle photos - delegate to photo-analysis module
  bot.on("message:photo", handlePhotoMessage);

  // Handle text messages
  bot.on("message:text", async (ctx: BotContext) => {
    // Type guards
    if (!ctx.message?.text || !ctx.chat || !ctx.from || !ctx.message) {
      logger.warn("Invalid text message context");
      return;
    }

    let text = ctx.message.text;

    // Skip commands (handled separately)
    if (text.startsWith("/")) {
      return;
    }

    logger.info({ telegramUserId: ctx.from.id }, "Received text message");

    // Check maintenance mode
    if (await isMaintenanceMode()) {
      await ctx.reply("Бот находится на обслуживании. Попробуйте позже.");
      return;
    }

    // Validate text length (4000 chars max)
    if (text.length > 4000) {
      logger.warn(
        { telegramUserId: ctx.from.id, textLength: text.length },
        "Text message too long"
      );
      await ctx.reply("Сообщение слишком длинное. Максимум 4000 символов.");
      return;
    }

    // Sanitize text: remove null bytes and control characters
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // Check if text is empty after sanitization
    if (text.trim().length === 0) {
      logger.warn({ telegramUserId: ctx.from.id }, "Text message empty after sanitization");
      return;
    }

    // Check if user has credits
    if (!await hasCredits(ctx.from.id, 1)) {
      logger.info({ telegramUserId: ctx.from.id }, "User has insufficient credits for chat");
      await ctx.reply("У вас недостаточно кредитов. Пожалуйста, пополните баланс.");
      return;
    }

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    // Queue chat reply job
    const jobData: ChatReplyJobData = {
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text,
    };

    const jobId = await sendJob(QUEUE_CHAT_REPLY, jobData);
    logger.info({ jobId, telegramUserId: ctx.from.id }, "Chat reply job queued");
  });

  // Handle callback queries (inline button presses)
  bot.on("callback_query:data", async (ctx: BotContext) => {
    // Type guards
    if (!ctx.callbackQuery?.data || !ctx.from) {
      logger.warn("Invalid callback query context");
      return;
    }

    logger.info(
      { telegramUserId: ctx.from.id, data: ctx.callbackQuery.data },
      "Received callback query"
    );

    // TODO: Implement callback query handling (Phase 4/5)
    await ctx.answerCallbackQuery({ text: "Обрабатывается..." });
  });

  // Global error handler
  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    logger.error({ error: err.error, updateId }, "Bot error");
  });

  logger.info("Router setup complete");
}

// Re-export for convenience
export type { BotContext } from "./middleware.js";
