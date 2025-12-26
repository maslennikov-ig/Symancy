/**
 * Main message dispatcher for routing Telegram updates
 * Sets up bot handlers, middleware, and message processing logic
 */
import { getBot } from "../../core/telegram.js";
import { getLogger } from "../../core/logger.js";
import { loadProfile, loadUserState, checkBanned, type BotContext } from "./middleware.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { handlePhotoMessage } from "../photo-analysis/handler.js";
import { handleTextMessage } from "../chat/handler.js";

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

  // Handle text messages - delegate to chat module
  bot.on("message:text", handleTextMessage);

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
