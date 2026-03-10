// supabase/functions/_shared/subscription-config.ts
// Shared subscription constants for Edge Functions (create-subscription, process-recurring-payments)

// Subscription tier prices (monthly, in RUB)
export const TIER_PRICES: Record<string, number> = { basic: 299, advanced: 799, premium: 3333 }
export const BILLING_DISCOUNTS: Record<number, number> = { 1: 0, 3: 15, 6: 25, 12: 50 }

// Fiscal receipt configuration (54-FZ)
export const RECEIPT_TAX_SYSTEM_CODE = 2  // УСН (доходы)
export const RECEIPT_VAT_CODE = 1  // Без НДС

export const TIER_NAMES: Record<string, string> = {
  basic: 'Базовый',
  advanced: 'Продвинутый',
  premium: 'Премиум',
}

export const VALID_TIERS = ['basic', 'advanced', 'premium'] as const
export const VALID_BILLING_PERIODS = [1, 3, 6, 12] as const

export type SubscriptionTier = 'basic' | 'advanced' | 'premium'

export function calculatePrice(tier: string, billingPeriodMonths: number): { total: number; base: number; discount: number } {
  const monthlyPrice = TIER_PRICES[tier] || 0
  const discountPercent = BILLING_DISCOUNTS[billingPeriodMonths] || 0
  const base = monthlyPrice * billingPeriodMonths
  const total = Math.round(base * (1 - discountPercent / 100))
  return { total, base, discount: discountPercent }
}
