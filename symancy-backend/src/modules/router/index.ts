/**
 * Main message dispatcher for routing Telegram updates
 * Sets up bot handlers, middleware, and message processing logic
 */
import { Composer } from "grammy";
import { getBot } from "../../core/telegram.js";
import { getLogger } from "../../core/logger.js";
import { loadProfile, loadUserState, checkBanned, type BotContext } from "./middleware.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { handlePhotoMessage } from "../photo-analysis/handler.js";
import { handleTextMessage } from "../chat/handler.js";
import {
  startOnboarding,
  handleOnboardingText,
  handleOnboardingCallback,
  isInOnboarding,
} from "../onboarding/handler.js";

const logger = getLogger().child({ module: "router" });

/**
 * Setup bot message handlers and middleware
 * Call this once during application startup
 */
export function setupRouter(): void {
  const bot = getBot();

  // Create protected composer for middleware with error boundary
  const protectedMiddleware = new Composer<BotContext>();

  // Apply middleware to protected composer
  protectedMiddleware.use(loadProfile);
  protectedMiddleware.use(loadUserState);
  protectedMiddleware.use(checkBanned);
  protectedMiddleware.use(rateLimitMiddleware);

  // Install middleware with error boundary
  bot.use(
    protectedMiddleware.errorBoundary((err) => {
      logger.error(
        { error: err.error, updateId: err.ctx?.update?.update_id },
        "Middleware error caught by boundary"
      );
      // Don't call next() - stop processing on middleware errors
    })
  );

  // Handle /start command
  bot.command("start", async (ctx: BotContext) => {
    logger.info({ telegramUserId: ctx.from?.id }, "Received /start command");

    // Check if onboarding needed
    if (!ctx.profile?.onboarding_completed) {
      // Start onboarding flow (T055)
      await startOnboarding(ctx);
      return;
    }

    await ctx.reply("Привет! Отправьте мне фото кофейной гущи для гадания.");
  });

  // Handle photos - delegate to photo-analysis module
  bot.on("message:photo", handlePhotoMessage);

  // Handle text messages - route based on onboarding state (T055)
  bot.on("message:text", async (ctx: BotContext) => {
    // Check if user is in onboarding flow
    const inOnboarding = await isInOnboarding(ctx);

    if (inOnboarding) {
      await handleOnboardingText(ctx);
    } else {
      await handleTextMessage(ctx);
    }
  });

  // Handle callback queries (inline button presses) - T055
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

    // Route onboarding callbacks
    if (ctx.callbackQuery.data.startsWith("onboarding:")) {
      await handleOnboardingCallback(ctx);
      return;
    }

    // TODO: Implement other callback query handling (Phase 4)
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
