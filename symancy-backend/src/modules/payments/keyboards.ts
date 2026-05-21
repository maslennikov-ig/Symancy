/**
 * Inline keyboards and callback parsing for the /buy flow.
 *
 * Two keyboards:
 *  - Tariff picker  → callback_data = `buy:<tariff>`
 *  - Payment method → callback_data = `pay:<method>:<tariff>`
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import {
  PRODUCT_TYPES,
  STARS_PRICES,
  TARIFFS,
  isPaymentMethod,
  isProductType,
  type PaymentMethod,
  type ProductType,
} from "./constants.js";

/**
 * Human-readable emoji for each tariff (for buttons / messages).
 */
const TARIFF_EMOJI: Record<ProductType, string> = {
  basic: "☕",
  pack5: "📦",
  pro: "🧘",
  cassandra: "🔮",
};

/**
 * Build a button label for the tariff picker, e.g. "☕ Новичок — 100₽".
 */
function tariffButtonLabel(product: ProductType): string {
  const tariff = TARIFFS[product];
  return `${TARIFF_EMOJI[product]} ${tariff.name} — ${tariff.price}₽`;
}

/**
 * Build the tariff picker (4 tariffs, one per row for readability).
 *
 * Callback data: `buy:<tariff>`.
 */
export function createTariffPickerKeyboard(): InlineKeyboardMarkup {
  const keyboard = new InlineKeyboard();

  PRODUCT_TYPES.forEach((product, index) => {
    keyboard.text(tariffButtonLabel(product), `buy:${product}`);
    if (index < PRODUCT_TYPES.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
}

/**
 * Build the payment method picker for a specific tariff.
 *
 * Callback data: `pay:yookassa:<tariff>` / `pay:stars:<tariff>`.
 */
export function createPaymentMethodKeyboard(
  product: ProductType
): InlineKeyboardMarkup {
  const tariff = TARIFFS[product];
  const stars = STARS_PRICES[product];

  return new InlineKeyboard()
    .text(`💳 Картой YooKassa — ${tariff.price}₽`, `pay:yookassa:${product}`)
    .row()
    .text(`⭐ Telegram Stars — ${stars} ⭐`, `pay:stars:${product}`)
    .row()
    .text("⬅️ Назад к тарифам", "buy:back");
}

/**
 * Discriminated parse result for `buy:*` / `pay:*` callbacks.
 */
export type PaymentCallback =
  | { kind: "tariff"; product: ProductType }
  | { kind: "back" }
  | { kind: "pay"; method: PaymentMethod; product: ProductType };

/**
 * Parse a callback_data string into a typed PaymentCallback or null.
 *
 * Accepted formats:
 *   - `buy:<tariff>`        → kind: "tariff"
 *   - `buy:back`            → kind: "back"
 *   - `pay:<method>:<tariff>` → kind: "pay"
 *
 * Unknown / malformed callbacks return null so the caller can answer
 * the callback query with an error.
 */
export function parsePaymentCallback(data: string): PaymentCallback | null {
  const parts = data.split(":");

  if (parts.length === 0) {
    return null;
  }

  if (parts[0] === "buy") {
    if (parts.length !== 2) {
      return null;
    }
    const value = parts[1];
    if (value === "back") {
      return { kind: "back" };
    }
    if (value !== undefined && isProductType(value)) {
      return { kind: "tariff", product: value };
    }
    return null;
  }

  if (parts[0] === "pay") {
    if (parts.length !== 3) {
      return null;
    }
    const method = parts[1];
    const product = parts[2];
    if (
      method !== undefined &&
      product !== undefined &&
      isPaymentMethod(method) &&
      isProductType(product)
    ) {
      return { kind: "pay", method, product };
    }
    return null;
  }

  return null;
}
