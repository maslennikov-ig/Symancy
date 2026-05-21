/**
 * Main-menu reply-keyboard handler.
 *
 * The persistent reply keyboard (see ./keyboards.ts) sends ordinary text
 * messages containing the button labels. This module:
 *
 *  1. Matches an incoming text message against every button label in every
 *     supported locale (ru / en / zh) → `MenuAction | null`.
 *  2. Dispatches that action to the existing command handlers (so the menu
 *     and the slash-command interfaces behave identically and stay in sync).
 *
 * Compare-session interaction:
 *  - If the user has an active /compare session (waiting for the second
 *    photo), most menu buttons would derail the flow and burn credits.
 *  - We allow `compare` and `help` through unchanged — both are safe / useful
 *    inside a compare session.
 *  - For every other menu button we reply with a gentle warning telling the
 *    user to send the second photo or `/cancel_compare`, and we mark the
 *    message as consumed so the regular text router doesn't fall through.
 */
import type { BotContext } from "../router/middleware.js";
import { getLogger } from "../../core/logger.js";
import {
  getBotMessage,
  normalizeLang,
  type BotLang,
  type BotMessageKey,
} from "../../services/i18n/index.js";
import { InlineKeyboard } from "grammy";
import { getEnv } from "../../config/env.js";
import {
  MENU_ACTIONS,
  MENU_BUTTON_KEYS,
  type MenuAction,
} from "./keyboards.js";
import {
  handleHelpCommand,
  handleCreditsCommand,
  handleHistoryCommand,
  handleCassandraCommand,
  handleCompareCommand,
} from "../router/commands.js";
import { handleMoodCommand } from "../mood/handler.js";
import { isCompareSessionActive } from "../compare/handler.js";

const logger = getLogger().child({ module: "menu" });

const SUPPORTED_LANGS: readonly BotLang[] = ["ru", "en", "zh"] as const;

/**
 * Menu buttons that are safe to use inside an active /compare session.
 * Everything else gets the "you're in a compare session" warning instead.
 */
const COMPARE_SAFE_ACTIONS: ReadonlySet<MenuAction> = new Set<MenuAction>([
  "compare", // opens the mode picker — does not consume credits or fork the flow
  "help", // always informational
]);

/**
 * Build a label→action index across all supported languages.
 * Built lazily once so we don't pay i18n lookups on every text message.
 *
 * NOTE: label collisions across locales would be a bug in the i18n table.
 * We log a warning if one is detected but the first-registered action wins.
 */
let labelIndex: Map<string, MenuAction> | null = null;

function buildLabelIndex(): Map<string, MenuAction> {
  const index = new Map<string, MenuAction>();
  for (const action of MENU_ACTIONS) {
    const key = MENU_BUTTON_KEYS[action];
    for (const lang of SUPPORTED_LANGS) {
      const label = getBotMessage(key, lang);
      const existing = index.get(label);
      if (existing && existing !== action) {
        logger.warn(
          { label, existing, conflicting: action, lang },
          "Menu label collides across actions — first registration wins",
        );
        continue;
      }
      index.set(label, action);
    }
  }
  return index;
}

function getLabelIndex(): Map<string, MenuAction> {
  if (!labelIndex) {
    labelIndex = buildLabelIndex();
  }
  return labelIndex;
}

/**
 * Match a free-form text message against every known menu-button label.
 *
 * Returns the corresponding `MenuAction` or null if the text is not a menu
 * button. Comparison is exact (after trimming) so we don't accidentally
 * intercept normal chat messages that happen to contain a button label.
 */
export function matchMenuButton(text: string): MenuAction | null {
  if (!text) return null;
  return getLabelIndex().get(text.trim()) ?? null;
}

/**
 * Reset the cached label index. Test-only helper — exported so unit tests
 * can re-seed the index after they remock the i18n layer.
 */
export function _resetMenuLabelIndex(): void {
  labelIndex = null;
}

function resolveLang(ctx: BotContext): string {
  return ctx.profile?.language_code || ctx.from?.language_code || "ru";
}

function buildPricingUrl(): { url: string | null; isWebApp: boolean } {
  let webAppUrl: string | undefined;
  try {
    webAppUrl = getEnv().WEBAPP_URL;
  } catch {
    webAppUrl = undefined;
  }
  if (!webAppUrl) {
    return { url: "https://symancy.ru/pricing", isWebApp: false };
  }
  const trimmed = webAppUrl.replace(/\/+$/, "");
  return { url: `${trimmed}/pricing`, isWebApp: true };
}

/**
 * Dispatch a recognised menu action to the appropriate command handler.
 * Kept private so the public API is just `handleMainMenuText`.
 */
async function dispatchMenuAction(
  ctx: BotContext,
  action: MenuAction,
): Promise<void> {
  const language = resolveLang(ctx);
  switch (action) {
    case "predict": {
      // No dedicated /predict command exists — just nudge the user to send a
      // photo. The actual analysis is triggered by `bot.on("message:photo")`.
      await ctx.reply(
        getBotMessage("menu.action.predictPrompt" as BotMessageKey, language),
      );
      return;
    }
    case "compare":
      await handleCompareCommand(ctx);
      return;
    case "cassandra":
      await handleCassandraCommand(ctx);
      return;
    case "history":
      await handleHistoryCommand(ctx);
      return;
    case "credits":
      await handleCreditsCommand(ctx);
      return;
    case "mood":
      await handleMoodCommand(ctx);
      return;
    case "help":
      await handleHelpCommand(ctx);
      return;
    case "buy": {
      // The WebApp variant is opened by Telegram itself when the user taps
      // the reply-keyboard's "🎁 Купить" button — we never see a text message
      // in that case. We only get here when WEBAPP_URL is NOT configured and
      // the button is a plain text fallback. Send a CTA with a regular URL.
      const { url, isWebApp } = buildPricingUrl();
      if (!url) {
        // Should not happen — buildPricingUrl always returns a URL — but be
        // defensive in case env construction changes later.
        await ctx.reply(
          getBotMessage("menu.action.buyPrompt" as BotMessageKey, language),
        );
        return;
      }
      if (isWebApp) {
        // Web-app aware client: inline keyboard with a web_app button.
        const kb = new InlineKeyboard().webApp(
          getBotMessage("menu.action.buyOpen" as BotMessageKey, language),
          url,
        );
        await ctx.reply(
          getBotMessage("menu.action.buyPrompt" as BotMessageKey, language),
          { reply_markup: kb },
        );
      } else {
        // Fallback: plain URL button. Works in any client.
        const kb = new InlineKeyboard().url(
          getBotMessage("menu.action.buyOpen" as BotMessageKey, language),
          url,
        );
        await ctx.reply(
          getBotMessage("menu.action.buyPrompt" as BotMessageKey, language),
          { reply_markup: kb },
        );
      }
      return;
    }
  }
}

/**
 * Try to handle the current text message as a main-menu button press.
 *
 * Returns:
 *  - `true`  → message was a menu button and has been fully handled.
 *              Caller MUST stop further text routing for this update.
 *  - `false` → message is plain chat / something else; caller should
 *              continue with its normal text-handling logic.
 *
 * Compare-session protection: if the user is mid-/compare, only the
 * `compare` and `help` buttons are dispatched; every other button is
 * intercepted with a gentle warning (still returns `true`).
 */
export async function handleMainMenuText(ctx: BotContext): Promise<boolean> {
  const text = ctx.message?.text;
  if (!text) return false;

  const action = matchMenuButton(text);
  if (!action) return false;

  const telegramUserId = ctx.from?.id;
  const language = resolveLang(ctx);

  // Compare-session conflict resolution.
  if (telegramUserId && !COMPARE_SAFE_ACTIONS.has(action)) {
    try {
      const active = await isCompareSessionActive(telegramUserId);
      if (active) {
        logger.info(
          { telegramUserId, action },
          "Menu button pressed during active compare session — warning user",
        );
        await ctx.reply(
          getBotMessage(
            "menu.compareSessionWarning" as BotMessageKey,
            language,
          ),
        );
        return true;
      }
    } catch (error) {
      // Don't strand the user if the lookup fails — log and fall through.
      logger.warn(
        { error, telegramUserId, action },
        "isCompareSessionActive check failed — proceeding with menu dispatch",
      );
    }
  }

  logger.info(
    { telegramUserId, action, lang: normalizeLang(language) },
    "Main menu action dispatched",
  );

  try {
    await dispatchMenuAction(ctx, action);
  } catch (error) {
    logger.error(
      { error, telegramUserId, action },
      "Main menu dispatch failed",
    );
    await ctx.reply(getBotMessage("error.generic", language));
  }

  return true;
}
