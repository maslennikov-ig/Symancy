/**
 * Inline keyboards for the compare-photos flow.
 *
 * Currently only exposes a "Cancel comparison" button shown under the
 * intro/first-received messages so the user has a one-click way out.
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { getBotMessage } from "../../services/i18n/index.js";

/**
 * Callback data for the cancel-compare button.
 * Kept short to stay well within Telegram's 64-byte callback_data limit.
 */
export const COMPARE_CANCEL_CALLBACK = "cmp:cancel";

/**
 * Build a keyboard with a single "Cancel comparison" inline button.
 *
 * @param language - User language code (ru, en, zh)
 */
export function createCancelCompareKeyboard(language: string = "ru"): InlineKeyboardMarkup {
  const label = getBotMessage("compare.cancelButton", language);
  return new InlineKeyboard().text(label, COMPARE_CANCEL_CALLBACK);
}

/**
 * Check whether a callback_data string belongs to the compare module.
 */
export function isCompareCallback(data: string): boolean {
  return data.startsWith("cmp:");
}
