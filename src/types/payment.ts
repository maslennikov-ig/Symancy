// types/payment.ts
// TypeScript types for payment integration (Feature 002-pre-mvp-payments)

export type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra';
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled';

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
}

export interface UserCredits {
  user_id: string;
  basic_credits: number;
  pro_credits: number;
  cassandra_credits: number;
  updated_at: string;
}

export interface Tariff {
  type: ProductType;
  name: string;
  price: number;
  credits: number;
  creditType: 'basic' | 'pro' | 'cassandra';
  description: string;
}

export const TARIFFS: Tariff[] = [
  {
    type: 'basic',
    name: 'pricing.tariff.basic.name',
    price: 100,
    credits: 1,
    creditType: 'basic',
    description: 'pricing.tariff.basic.description',
  },
  {
    type: 'pack5',
    name: 'pricing.tariff.pack5.name',
    price: 300,
    credits: 5,
    creditType: 'basic',
    description: 'pricing.tariff.pack5.description',
  },
  {
    type: 'pro',
    name: 'pricing.tariff.pro.name',
    price: 500,
    credits: 1,
    creditType: 'pro',
    description: 'pricing.tariff.pro.description',
  },
  {
    type: 'cassandra',
    name: 'pricing.tariff.cassandra.name',
    price: 1000,
    credits: 1,
    creditType: 'cassandra',
    description: 'pricing.tariff.cassandra.description',
  },
];

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
