/**
 * Main message dispatcher for routing Telegram updates
 * Sets up bot handlers, middleware, and message processing logic
 */
import { getBot } from "../../core/telegram.js";
import { getLogger } from "../../core/logger.js";
import { getEnv } from "../../config/env.js";
import { loadProfile, loadUserState, checkBanned, type BotContext } from "./middleware.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { handlePhotoMessage } from "../photo-analysis/handler.js";
import { handleTopicCallback } from "../photo-analysis/topic-handler.js";
import { handleRetopicCallback } from "../photo-analysis/retopic-handler.js";
import { handleTextMessage } from "../chat/handler.js";
import {
  handleCassandraCommand,
  handleHelpCommand,
  handleCreditsCommand,
  handleHistoryCommand,
  handleLinkCommand,
} from "./commands.js";
import {
  startOnboarding,
  startOnboardingWithPendingPhoto,
  handleOnboardingText,
  handleOnboardingCallback,
  isInOnboarding,
} from "../onboarding/handler.js";

const logger = getLogger().child({ module: "router" });

/**
 * Check if user needs to complete onboarding first
 * Returns true if user should be blocked from using commands
 */
function requiresOnboarding(ctx: BotContext): boolean {
  // No profile = definitely needs onboarding
  if (!ctx.profile) {
    return true;
  }
  // Has profile but not completed onboarding
  return !ctx.profile.onboarding_completed;
}

/**
 * Send message prompting user to complete onboarding
 */
async function sendOnboardingRequired(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "👋 Сначала давайте познакомимся! Нажмите /start чтобы начать.",
    { parse_mode: "HTML" }
  );
}

/**
 * Parse persona preference from photo caption
 * Returns persona name if found, undefined otherwise
 *
 * MEDIUM #9 FIX: Save persona from caption
 */
function parsePersonaFromCaption(caption: string | undefined): "arina" | "cassandra" | undefined {
  if (!caption) return undefined;

  const lowerCaption = caption.toLowerCase().trim();

  // Check for Cassandra keywords
  if (
    lowerCaption.includes("кассандра") ||
    lowerCaption.includes("cassandra") ||
    lowerCaption.includes("премиум") ||
    lowerCaption.includes("premium")
  ) {
    return "cassandra";
  }

  // Check for explicit Arina keywords
  if (
    lowerCaption.includes("арина") ||
    lowerCaption.includes("arina")
  ) {
    return "arina";
  }

  return undefined;
}

/**
 * Handle photo from user who hasn't completed onboarding
 * Saves photo for later processing and starts friendly onboarding
 */
async function handlePhotoBeforeOnboarding(ctx: BotContext): Promise<void> {
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) {
    return;
  }

  // Get the largest photo (last in array)
  const largestPhoto = photos[photos.length - 1];
  if (!largestPhoto) {
    logger.warn({ telegramUserId: ctx.from?.id }, 'Photo array empty despite length check');
    return;
  }
  const fileId = largestPhoto.file_id;

  // MEDIUM #9 FIX: Parse persona from caption
  const caption = ctx.message?.caption;
  const persona = parsePersonaFromCaption(caption);

  logger.info(
    { telegramUserId: ctx.from?.id, fileId, caption, persona },
    "New user sent photo before onboarding - saving and starting friendly onboarding"
  );

  // Start onboarding with pending photo (will save fileId and send friendly message)
  await startOnboardingWithPendingPhoto(ctx, fileId, persona);
}

/**
 * Setup bot message handlers and middleware
 * Call this once during application startup
 */
export function setupRouter(): void {
  const bot = getBot();

  // Middleware 1: Load user profile
  bot.use(async (ctx, next) => {
    try {
      await loadProfile(ctx as BotContext, next);
    } catch (error) {
      logger.error({ error, updateId: ctx.update?.update_id }, "Error in loadProfile middleware");
      await next();
    }
  });

  // Middleware 2: Load user state
  bot.use(async (ctx, next) => {
    try {
      await loadUserState(ctx as BotContext, next);
    } catch (error) {
      logger.error({ error, updateId: ctx.update?.update_id }, "Error in loadUserState middleware");
      await next();
    }
  });

  // Middleware 3: Check if banned
  bot.use(async (ctx, next) => {
    try {
      await checkBanned(ctx as BotContext, next);
    } catch (error) {
      logger.error({ error, updateId: ctx.update?.update_id }, "Error in checkBanned middleware");
      await next();
    }
  });

  // Middleware 4: Rate limiting
  bot.use(async (ctx, next) => {
    try {
      await rateLimitMiddleware(ctx, next);
    } catch (error) {
      logger.error({ error, updateId: ctx.update?.update_id }, "Error in rateLimitMiddleware");
      await next();
    }
  });

  // Handle /start command - always available
  bot.command("start", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /start command");

    try {
      // Check if onboarding needed
      if (requiresOnboarding(botCtx)) {
        await startOnboarding(botCtx);
        return;
      }

      await ctx.reply("Привет! Отправьте мне фото кофейной гущи для гадания.");
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /start command");
      await ctx.reply("Произошла ошибка. Попробуйте /start ещё раз.");
    }
  });

  // Handle /cassandra and /premium commands (premium fortune teller)
  bot.command(["cassandra", "premium"], async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /cassandra command");

    // Block if onboarding not completed
    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCassandraCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /cassandra command");
      await ctx.reply("Ошибка в команде /cassandra");
    }
  });

  // Handle /help command
  bot.command("help", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /help command");

    // Block if onboarding not completed
    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleHelpCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /help command");
      await ctx.reply("Ошибка в команде /help");
    }
  });

  // Handle /credits command
  bot.command("credits", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /credits command");

    // Block if onboarding not completed
    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCreditsCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /credits command");
      await ctx.reply("Ошибка в команде /credits");
    }
  });

  // Handle /history command
  bot.command("history", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /history command");

    // Block if onboarding not completed
    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleHistoryCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /history command");
      await ctx.reply("Ошибка в команде /history");
    }
  });

  // Handle /link command
  bot.command("link", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /link command");

    // Block if onboarding not completed
    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleLinkCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /link command");
      await ctx.reply("Ошибка в команде /link");
    }
  });

  // Handle photos - delegate to photo-analysis module
  bot.on("message:photo", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received photo message");

    // If onboarding not completed - save photo and start friendly onboarding
    if (requiresOnboarding(botCtx)) {
      await handlePhotoBeforeOnboarding(botCtx);
      return;
    }

    await handlePhotoMessage(botCtx);
  });

  // Handle text messages - route based on onboarding state
  bot.on("message:text", async (ctx) => {
    const botCtx = ctx as BotContext;
    const text = ctx.message?.text || "";

    try {
      // If no profile at all, require /start
      if (!botCtx.profile) {
        await sendOnboardingRequired(botCtx);
        return;
      }

      // Check if user is in active onboarding flow (has onboarding_step set)
      const inOnboarding = await isInOnboarding(botCtx);

      if (inOnboarding) {
        // If user sends a command during onboarding, remind them to finish
        if (text.startsWith("/")) {
          await ctx.reply(
            "Пожалуйста, сначала завершите знакомство. Просто напишите ваше имя.",
            { parse_mode: "HTML" }
          );
          return;
        }
        await handleOnboardingText(botCtx);
      } else if (requiresOnboarding(botCtx)) {
        // Profile exists but onboarding not completed - prompt to start
        await sendOnboardingRequired(botCtx);
      } else {
        // Normal message handling for users who completed onboarding
        await handleTextMessage(botCtx);
      }
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error handling text message");
    }
  });

  // Handle callback queries (inline button presses) - T055
  bot.on("callback_query:data", async (ctx) => {
    const botCtx = ctx as BotContext;

    // Type guards
    if (!ctx.callbackQuery?.data || !ctx.from) {
      logger.warn("Invalid callback query context");
      return;
    }

    logger.info(
      { telegramUserId: ctx.from.id, data: ctx.callbackQuery.data },
      "Received callback query"
    );

    try {
      // Route onboarding callbacks
      if (ctx.callbackQuery.data.startsWith("onboarding:")) {
        await handleOnboardingCallback(botCtx);
        return;
      }

      // Route topic selection callbacks (photo analysis)
      if (ctx.callbackQuery.data.startsWith("topic:")) {
        await handleTopicCallback(botCtx);
        return;
      }

      // Route retopic callbacks (another topic from same cup)
      if (ctx.callbackQuery.data.startsWith("rt:")) {
        await handleRetopicCallback(botCtx);
        return;
      }

      // Unknown callback - acknowledge to remove loading state
      await ctx.answerCallbackQuery({ text: "Обрабатывается..." });
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from.id }, "Error handling callback query");
      await ctx.answerCallbackQuery({ text: "Произошла ошибка" });
    }
  });

  // Global error handler
  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    logger.error({ error: err.error, updateId }, "Bot error caught by global handler");
  });

  // Set bot commands menu (fire-and-forget)
  bot.api
    .setMyCommands([
      { command: "start", description: "Начать работу с ботом" },
      { command: "cassandra", description: "Премиум гадалка Кассандра" },
      { command: "credits", description: "Проверить баланс кредитов" },
      { command: "history", description: "История гаданий" },
      { command: "link", description: "Связать с веб-версией" },
      { command: "help", description: "Справка по командам" },
    ])
    .then(() => logger.info("Bot commands menu set"))
    .catch((err) => logger.error({ error: err }, "Failed to set bot commands"));

  // Set WebApp Chat Menu Button (if WEBAPP_URL configured)
  const env = getEnv();
  if (env.WEBAPP_URL) {
    bot.api
      .setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Symancy",
          web_app: {
            url: env.WEBAPP_URL,
          },
        },
      })
      .then(() => logger.info({ url: env.WEBAPP_URL }, "WebApp menu button set"))
      .catch((err) => logger.error({ error: err }, "Failed to set WebApp menu button"));
  }

  logger.info("Router setup complete");
}

// Re-export for convenience
export type { BotContext } from "./middleware.js";
