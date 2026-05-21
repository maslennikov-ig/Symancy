/**
 * Payment tariff and method constants for Telegram-native payments.
 *
 * Two payment methods are supported:
 * - YooKassa via Telegram Bot Payments (RUB) — requires a provider token from BotFather.
 * - Telegram Stars (XTR) — provider-less; no token required.
 *
 * Tariff prices stay in sync with `docs/TARIFFS.md` and the YooKassa Web flow
 * (`supabase/functions/payment-webhook/index.ts`). Star prices are taken from
 * the product spec and reflect a roughly 1.5x discount vs RUB.
 */

/**
 * Product types available for purchase. Matches `purchases_product_type_check`.
 */
export const PRODUCT_TYPES = ["basic", "pack5", "pro", "cassandra"] as const;

/**
 * Discriminating union of product types.
 */
export type ProductType = (typeof PRODUCT_TYPES)[number];

/**
 * Credit bucket affected by a tariff.
 */
export type CreditType = "basic" | "pro" | "cassandra";

/**
 * Supported payment methods inside the Telegram bot.
 */
export type PaymentMethod = "yookassa" | "stars";

/**
 * Tariff descriptor.
 */
export interface Tariff {
  /** RUB price. Must match `purchases.amount_rub` CHECK constraint. */
  price: number;
  /** Number of credits granted on successful payment. */
  credits: number;
  /** Credit bucket affected. */
  creditType: CreditType;
  /** Display name shown in keyboards and invoices. */
  name: string;
  /** Short description for the invoice. */
  description: string;
}

/**
 * Tariff registry (RUB / credits).
 *
 * NOTE: `amount_rub` is constrained to ARRAY[50, 100, 150, 250, 300, 500, 1000].
 * Stars amounts are tracked separately in `STARS_PRICES` and do not have to
 * satisfy the RUB constraint.
 */
export const TARIFFS = {
  basic: {
    price: 100,
    credits: 1,
    creditType: "basic" as const,
    name: "Новичок",
    description: "1 базовое гадание Symancy",
  },
  pack5: {
    price: 300,
    credits: 5,
    creditType: "basic" as const,
    name: "Любитель",
    description: "5 базовых гаданий Symancy",
  },
  pro: {
    price: 500,
    credits: 1,
    creditType: "pro" as const,
    name: "Внутренний мудрец",
    description: "1 расширенное гадание (Внутренний мудрец)",
  },
  cassandra: {
    price: 1000,
    credits: 1,
    creditType: "cassandra" as const,
    name: "Кассандра",
    description: "1 премиум-гадание от Кассандры",
  },
} as const satisfies Record<ProductType, Tariff>;

/**
 * Telegram Stars prices (XTR). Stars are integer amounts (no `* 100`).
 */
export const STARS_PRICES: Record<ProductType, number> = {
  basic: 75,
  pack5: 225,
  pro: 375,
  cassandra: 750,
};

/**
 * Telegram-Bot-Payments invoice payload sent with every invoice.
 * Echoed back inside `successful_payment.invoice_payload`.
 */
export interface InvoicePayload {
  /** Unified user id (uuid) - the canonical Symancy user identifier. */
  user_id: string;
  /** Tariff id. */
  product_type: ProductType;
  /** Original Telegram user id (numeric). */
  telegram_user_id: number;
  /** Chat id where the invoice was sent. */
  chat_id: number;
  /** Payment method chosen by the user. */
  payment_method: PaymentMethod;
}

/**
 * Type guard for ProductType.
 */
export function isProductType(value: string): value is ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value);
}

/**
 * Type guard for PaymentMethod.
 */
export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "yookassa" || value === "stars";
}
