// types/payment.ts
// TypeScript types for payment integration (Feature 002-pre-mvp-payments)

export type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra' | 'subscription';
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled';

export type CancellationReason =
  // Card issues
  | 'insufficient_funds'
  | 'card_expired'
  | 'invalid_card_number'
  | 'invalid_csc'
  | 'invalid_expiry_month'
  | 'invalid_expiry_year'
  // Security & fraud
  | 'fraud_suspected'
  | '3d_secure_failed'
  // Generic
  | 'general_decline'
  | 'processing_error'
  // Merchant/permission
  | 'canceled_by_merchant'
  | 'permission_revoked';

// Party that initiated the cancellation
export type CancellationParty = 'yoo_money' | 'payment_network' | 'merchant';

export interface Purchase {
  id: string;
  user_id: string;
  product_type: ProductType;
  amount_rub: number;
  yukassa_payment_id: string | null;
  status: PaymentStatus;
  credits_granted: number;
  created_at: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  cancellation_reason: CancellationReason | null;
  cancellation_party: CancellationParty | null;
}

export interface UserCredits {
  user_id: string;
  basic_credits: number;
  pro_credits: number;
  cassandra_credits: number;
  updated_at: string;
}

export type CreditType = 'basic' | 'pro' | 'cassandra';

export interface Tariff {
  type: ProductType;
  name: string;          // i18n key
  description: string;   // i18n key
  price: number;         // current price (after any active promo)
  originalPrice?: number; // pre-promo price; render strikethrough when present
  credits: number;
  creditType: CreditType;
  promoTag?: 'summer-time'; // active promo identifier
}

// TARIFFS is the single-source-of-truth pricing list.
// Definition lives in src/constants/tariffs.ts to keep it co-located with
// the Edge Function pricing module (supabase/functions/_shared/tariffs-config.ts).
export { TARIFFS, TARIFFS_PRICING, PROMO, getTariff } from '../constants/tariffs';

// Telegram Payments Types (Phase 10)

export interface TelegramInvoice {
  title: string;           // Product name (e.g., "1 анализ кофейной гущи")
  description: string;     // Product description
  payload: string;         // JSON string with: user_id, product_type, chat_id
  provider_token: string;  // YooKassa provider token from BotFather
  currency: 'RUB';         // Always RUB
  prices: Array<{
    label: string;
    amount: number;        // Price in kopecks (100 RUB = 10000)
  }>;
}

export interface PreCheckoutQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  currency: string;
  total_amount: number;    // In kopecks
  invoice_payload: string; // Our payload JSON
}

export interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string; // YooKassa payment ID
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    date: number;
    text?: string;
    successful_payment?: SuccessfulPayment;
  };
  pre_checkout_query?: PreCheckoutQuery;
}

export interface TelegramInvoicePayload {
  user_id: string;         // Supabase user ID (need to link Telegram user)
  product_type: ProductType;
  telegram_user_id: number;
  chat_id: number;
}
