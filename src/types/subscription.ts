// types/subscription.ts
// TypeScript types for subscription system (recurring payments)

export type SubscriptionTier = 'free' | 'basic' | 'advanced' | 'premium';
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'expired';
export type BillingPeriod = 1 | 3 | 6 | 12;

export interface SubscriptionTierConfig {
  tier: SubscriptionTier;
  nameKey: string;
  priceMonthly: number;
  basicCreditsPerMonth: number;
  cassandraCreditsPerMonth: number;
  features: string[];
  highlighted?: boolean;
}

export const SUBSCRIPTION_TIERS: SubscriptionTierConfig[] = [
  {
    tier: 'free',
    nameKey: 'subscription.tier.free.name',
    priceMonthly: 0,
    basicCreditsPerMonth: 4,
    cassandraCreditsPerMonth: 0,
    features: [
      'subscription.tier.free.feature.1',
      'subscription.tier.free.feature.2',
    ],
  },
  {
    tier: 'basic',
    nameKey: 'subscription.tier.basic.name',
    priceMonthly: 299,
    basicCreditsPerMonth: 21,
    cassandraCreditsPerMonth: 0,
    features: [
      'subscription.tier.basic.feature.1',
      'subscription.tier.basic.feature.2',
      'subscription.tier.basic.feature.3',
    ],
  },
  {
    tier: 'advanced',
    nameKey: 'subscription.tier.advanced.name',
    priceMonthly: 799,
    basicCreditsPerMonth: 68,
    cassandraCreditsPerMonth: 0,
    highlighted: true,
    features: [
      'subscription.tier.advanced.feature.1',
      'subscription.tier.advanced.feature.2',
      'subscription.tier.advanced.feature.3',
      'subscription.tier.advanced.feature.4',
    ],
  },
  {
    tier: 'premium',
    nameKey: 'subscription.tier.premium.name',
    priceMonthly: 3333,
    basicCreditsPerMonth: 121,
    cassandraCreditsPerMonth: 7,
    features: [
      'subscription.tier.premium.feature.1',
      'subscription.tier.premium.feature.2',
      'subscription.tier.premium.feature.3',
      'subscription.tier.premium.feature.4',
    ],
  },
];

export const BILLING_DISCOUNTS: Record<BillingPeriod, number> = {
  1: 0,
  3: 15,
  6: 25,
  12: 50,
};

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_period_months: BillingPeriod;
  amount_rub: number;
  base_amount_rub: number;
  discount_percent: number;
  yukassa_payment_method_id: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  canceled_at: string | null;
  expires_at: string | null;
  last_credits_granted_at: string | null;
  credits_granted_count: number;
  grace_period_end: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  user_id: string;
  amount_rub: number;
  yukassa_payment_id: string | null;
  status: 'pending' | 'succeeded' | 'canceled';
  period_start: string;
  period_end: string;
  is_initial: boolean;
  basic_credits_granted: number;
  cassandra_credits_granted: number;
  credits_granted_at: string | null;
  failure_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

export function calculateSubscriptionPrice(
  tier: SubscriptionTier,
  billingPeriod: BillingPeriod
): { totalAmount: number; monthlyAmount: number; baseMonthly: number; discount: number } {
  const config = SUBSCRIPTION_TIERS.find((t) => t.tier === tier);
  if (!config) throw new Error(`Unknown tier: ${tier}`);

  const baseMonthly = config.priceMonthly;
  const discount = BILLING_DISCOUNTS[billingPeriod];
  const monthlyAmount = Math.round(baseMonthly * (1 - discount / 100));
  const totalAmount = monthlyAmount * billingPeriod;

  return { totalAmount, monthlyAmount, baseMonthly, discount };
}
