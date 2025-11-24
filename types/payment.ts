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
    name: 'Новичок',
    price: 100,
    credits: 1,
    creditType: 'basic',
    description: '1 базовая расшифровка (3-4 блока)',
  },
  {
    type: 'pack5',
    name: 'Любитель',
    price: 300,
    credits: 5,
    creditType: 'basic',
    description: '5 расшифровок (скидка 40%)',
  },
  {
    type: 'pro',
    name: 'Внутренний мудрец',
    price: 500,
    credits: 1,
    creditType: 'pro',
    description: '1 PRO расшифровка (6+ блоков)',
  },
  {
    type: 'cassandra',
    name: 'Кассандра',
    price: 1000,
    credits: 1,
    creditType: 'cassandra',
    description: 'Эзотерическое предсказание',
  },
];
