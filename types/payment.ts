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
