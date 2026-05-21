/**
 * Main menu (persistent reply keyboard) for the Symancy Telegram bot.
 *
 * Goal: replace the hidden command set (/compare, /credits, /history, /mood …)
 * with an always-visible 4×2 grid of buttons under the user's input field.
 *
 * Layout:
 *
 *   ┌──────────────────────┬──────────────────────┐
 *   │ 📷 Гадание           │ 📊 Сравнить          │
 *   ├──────────────────────┼──────────────────────┤
 *   │ 🔮 Кассандра         │ 📜 История           │
 *   ├──────────────────────┼──────────────────────┤
 *   │ 💰 Баланс            │ 🎁 Купить (WebApp)   │
 *   ├──────────────────────┼──────────────────────┤
 *   │ 🌙 Настроение        │ ℹ️ Помощь            │
 *   └──────────────────────┴──────────────────────┘
 *
 * Notes:
 *  - We use `Keyboard.persistent()` (Bot API 6.4+) so the menu survives between
 *    messages — Telegram remembers it once attached.
 *  - The "🎁 Купить" button opens a Telegram Mini App (`WEBAPP_URL/pricing`)
 *    when WEBAPP_URL is configured. Otherwise we fall back to a regular text
 *    button — the handler will then send a plain CTA message with a URL.
 *  - All button labels are localized; the handler matches the user's reply by
 *    looking up the label across all three locales.
 */
import { Keyboard } from "grammy";
import { getBotMessage } from "../../services/i18n/index.js";
import { getEnv } from "../../config/env.js";

/**
 * Set of supported menu actions. Returned by the handler's matcher.
 */
export type MenuAction =
  | "predict"
  | "compare"
  | "cassandra"
  | "history"
  | "credits"
  | "buy"
  | "mood"
  | "help";

/**
 * All menu actions in the order they appear on the keyboard (left-to-right,
 * top-to-bottom). Useful for iteration in tests and label lookups.
 */
export const MENU_ACTIONS: readonly MenuAction[] = [
  "predict",
  "compare",
  "cassandra",
  "history",
  "credits",
  "buy",
  "mood",
  "help",
] as const;

/**
 * Map MenuAction → i18n key for the button label.
 * Kept in one place so both `createMainMenuKeyboard` and the handler's
 * matcher stay in sync.
 */
export const MENU_BUTTON_KEYS: Record<
  MenuAction,
  | "menu.button.predict"
  | "menu.button.compare"
  | "menu.button.cassandra"
  | "menu.button.history"
  | "menu.button.credits"
  | "menu.button.buy"
  | "menu.button.mood"
  | "menu.button.help"
> = {
  predict: "menu.button.predict",
  compare: "menu.button.compare",
  cassandra: "menu.button.cassandra",
  history: "menu.button.history",
  credits: "menu.button.credits",
  buy: "menu.button.buy",
  mood: "menu.button.mood",
  help: "menu.button.help",
};

/**
 * Build the URL the WebApp button should open.
 * Returns null if WEBAPP_URL is not configured — caller should then render the
 * button as a plain text button.
 */
function buildPricingWebAppUrl(): string | null {
  let webAppUrl: string | undefined;
  try {
    webAppUrl = getEnv().WEBAPP_URL;
  } catch {
    // getEnv may throw at module load time during tests if env is not parsed.
    // Treat that as "not configured" and use the fallback.
    return null;
  }
  if (!webAppUrl) return null;
  // Normalize trailing slash so we always get one slash before "/pricing".
  const trimmed = webAppUrl.replace(/\/+$/, "");
  return `${trimmed}/pricing`;
}

/**
 * Build the persistent main-menu reply keyboard for the given language.
 *
 * If WEBAPP_URL is set, the "🎁 Купить" button is rendered as a
 * `Keyboard.webApp(label, url)` which opens the pricing page as a Telegram
 * Mini App. Otherwise it's a plain text button — the menu handler will then
 * respond with a CTA message containing a regular URL.
 */
export function createMainMenuKeyboard(languageCode?: string): Keyboard {
  const t = (action: MenuAction): string =>
    getBotMessage(MENU_BUTTON_KEYS[action], languageCode);

  const keyboard = new Keyboard()
    .text(t("predict")).text(t("compare")).row()
    .text(t("cassandra")).text(t("history")).row()
    .text(t("credits"));

  // "🎁 Купить" — WebApp button if WEBAPP_URL is configured, otherwise plain text.
  const pricingUrl = buildPricingWebAppUrl();
  if (pricingUrl) {
    keyboard.webApp(t("buy"), pricingUrl);
  } else {
    keyboard.text(t("buy"));
  }

  keyboard
    .row()
    .text(t("mood")).text(t("help"));

  return keyboard
    .resized()
    .persistent()
    .placeholder(getBotMessage("menu.placeholder", languageCode));
}
