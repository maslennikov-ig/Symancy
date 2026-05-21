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
  handleCompareDynamicsCommand,
  handleCompareCompatibilityCommand,
  handleCancelCompareCommand,
  handleCompareCommand,
} from "./commands.js";
import {
  startOnboarding,
  startOnboardingWithPendingPhoto,
  handleOnboardingText,
  handleOnboardingCallback,
  isInOnboarding,
} from "../onboarding/handler.js";
import { handleMoodCommand, handleMoodCallback } from "../mood/handler.js";
import {
  handleComparePhoto,
  handleCompareText,
  handleCompareCancelCallback,
  handleCompareModeCallback,
  handleCompareStartFromCallback,
  handleCompareStartFromModeCallback,
  isCompareSessionActive,
} from "../compare/handler.js";
import {
  isCompareCallback,
  COMPARE_CANCEL_CALLBACK,
  COMPARE_MODE_PREFIX,
  COMPARE_START_FROM_PREFIX,
  COMPARE_START_FROM_MODE_PREFIX,
} from "../compare/keyboards.js";
import { createMainMenuKeyboard } from "../menu/keyboards.js";
import { handleMainMenuText } from "../menu/handler.js";
import {
  handleBuyCommand,
  handleBuyCallback,
  handlePreCheckoutQuery,
  handleSuccessfulPayment,
} from "../payments/index.js";

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

      const language = botCtx.profile?.language_code || ctx.from?.language_code;
      await ctx.reply("Привет! Отправьте мне фото кофейной гущи для гадания.", {
        reply_markup: createMainMenuKeyboard(language),
      });
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

  // Handle /buy command
  bot.command("buy", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /buy command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleBuyCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /buy command");
      await ctx.reply("Ошибка в команде /buy");
    }
  });

  // Handle /mood command
  bot.command("mood", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /mood command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleMoodCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /mood command");
      await ctx.reply("Ошибка в команде /mood");
    }
  });

  // Handle unified /compare command (mode picker → dynamics or compatibility)
  bot.command("compare", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /compare command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCompareCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /compare command");
      await ctx.reply("Ошибка в команде /compare");
    }
  });

  // Handle /compare_dynamics command (Arina, pro credit)
  bot.command("compare_dynamics", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /compare_dynamics command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCompareDynamicsCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /compare_dynamics command");
      await ctx.reply("Ошибка в команде /compare_dynamics");
    }
  });

  // Handle /compare_compatibility command (Cassandra, cassandra credit)
  bot.command("compare_compatibility", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /compare_compatibility command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCompareCompatibilityCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /compare_compatibility command");
      await ctx.reply("Ошибка в команде /compare_compatibility");
    }
  });

  // Handle /cancel_compare command (clear pending compare session)
  bot.command("cancel_compare", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received /cancel_compare command");

    if (requiresOnboarding(botCtx)) {
      await sendOnboardingRequired(botCtx);
      return;
    }

    try {
      await handleCancelCompareCommand(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error in /cancel_compare command");
      await ctx.reply("Ошибка в команде /cancel_compare");
    }
  });

  // Handle photos - delegate to compare module first (if active), else photo-analysis
  bot.on("message:photo", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info({ telegramUserId: ctx.from?.id }, "Received photo message");

    try {
      // If onboarding not completed - save photo and start friendly onboarding
      if (requiresOnboarding(botCtx)) {
        await handlePhotoBeforeOnboarding(botCtx);
        return;
      }

      // Active compare session? Route through compare handler.
      // It returns false if the session has just expired or is missing,
      // in which case we fall through to the normal photo flow.
      if (ctx.from && (await isCompareSessionActive(ctx.from.id))) {
        const consumed = await handleComparePhoto(botCtx);
        if (consumed) {
          return;
        }
      }

      await handlePhotoMessage(botCtx);
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from?.id }, "Error handling photo message");
      await ctx.reply("Произошла ошибка. Попробуйте отправить фото ещё раз.");
    }
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
        // Main-menu reply-keyboard button? Dispatch to the matching command.
        // Menu buttons short-circuit the rest of the text pipeline so they
        // never reach the compare nudge or the chat handler.
        if (!text.startsWith("/")) {
          const consumedByMenu = await handleMainMenuText(botCtx);
          if (consumedByMenu) {
            return;
          }
        }

        // Compare session active? Nudge the user to send a photo (or cancel).
        // Skip nudge for commands so /cancel_compare etc. still work.
        if (!text.startsWith("/") && ctx.from) {
          const consumed = await handleCompareText(botCtx);
          if (consumed) {
            return;
          }
        }

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

      // Route mood callbacks
      if (ctx.callbackQuery.data.startsWith("mood:")) {
        await handleMoodCallback(botCtx);
        return;
      }

      // Route compare callbacks. The `cmp:` family fans out into:
      //   cmp:cancel              → cancel an active session
      //   cmp:mode:*              → /compare mode picker
      //   cmp:start_from:*        → "Compare with a new cup" CTA
      //   cmp:sfm:*               → mode picker for "compare from analysis"
      if (isCompareCallback(ctx.callbackQuery.data)) {
        const data = ctx.callbackQuery.data;
        if (data === COMPARE_CANCEL_CALLBACK) {
          await handleCompareCancelCallback(botCtx);
        } else if (data.startsWith(COMPARE_START_FROM_MODE_PREFIX)) {
          // NOTE: must be checked BEFORE COMPARE_START_FROM_PREFIX because
          // "cmp:sfm:" does NOT share a prefix with "cmp:start_from:" — they
          // are distinct, but the order is kept defensive in case the
          // constants ever change.
          await handleCompareStartFromModeCallback(botCtx);
        } else if (data.startsWith(COMPARE_START_FROM_PREFIX)) {
          await handleCompareStartFromCallback(botCtx);
        } else if (data.startsWith(COMPARE_MODE_PREFIX)) {
          await handleCompareModeCallback(botCtx);
        } else {
          // Unknown cmp:* callback — acknowledge to clear the spinner.
          await ctx.answerCallbackQuery();
        }
        return;
      }

      // Route payment callbacks (tariff picker + payment method picker)
      if (
        ctx.callbackQuery.data.startsWith("buy:") ||
        ctx.callbackQuery.data.startsWith("pay:")
      ) {
        await handleBuyCallback(botCtx);
        return;
      }

      // Unknown callback - acknowledge to remove loading state
      await ctx.answerCallbackQuery({ text: "Обрабатывается..." });
    } catch (error) {
      logger.error({ error, telegramUserId: ctx.from.id }, "Error handling callback query");
      await ctx.answerCallbackQuery({ text: "Произошла ошибка" });
    }
  });

  // Telegram payments: validate pre_checkout_query (must answer within 10s)
  bot.on("pre_checkout_query", async (ctx) => {
    logger.info(
      {
        telegramUserId: ctx.from?.id,
        currency: ctx.preCheckoutQuery?.currency,
        totalAmount: ctx.preCheckoutQuery?.total_amount,
      },
      "Received pre_checkout_query"
    );
    try {
      await handlePreCheckoutQuery(ctx);
    } catch (error) {
      logger.error(
        { error, telegramUserId: ctx.from?.id },
        "pre_checkout_query handler failed"
      );
    }
  });

  // Telegram payments: process successful_payment service-message
  bot.on("message:successful_payment", async (ctx) => {
    const botCtx = ctx as BotContext;
    logger.info(
      {
        telegramUserId: ctx.from?.id,
        currency: ctx.message?.successful_payment?.currency,
        totalAmount: ctx.message?.successful_payment?.total_amount,
      },
      "Received successful_payment"
    );
    try {
      await handleSuccessfulPayment(botCtx);
    } catch (error) {
      logger.error(
        { error, telegramUserId: ctx.from?.id },
        "successful_payment handler failed"
      );
    }
  });

  // Global error handler
  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    logger.error({ error: err.error, updateId }, "Bot error caught by global handler");
  });

  // Set bot commands menu (fire-and-forget).
  //
  // Note: /compare_dynamics and /compare_compatibility are intentionally NOT
  // shown in the visible Telegram command menu — they remain functional for
  // backwards compatibility but are superseded by the unified /compare.
  bot.api
    .setMyCommands([
      { command: "start", description: "Начать работу с ботом" },
      { command: "cassandra", description: "Премиум гадалка Кассандра" },
      { command: "compare", description: "Сравнить две чашки" },
      { command: "cancel_compare", description: "Отменить сравнение чашек" },
      { command: "credits", description: "Проверить баланс кредитов" },
      { command: "buy", description: "Купить кредиты" },
      { command: "history", description: "История гаданий" },
      { command: "link", description: "Связать с веб-версией" },
      { command: "mood", description: "Записать настроение" },
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
