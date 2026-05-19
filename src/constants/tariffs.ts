// src/constants/tariffs.ts
// Single source of truth for one-time purchase tariffs (Vite/React side).
//
// !!! KEEP IN SYNC with supabase/functions/_shared/tariffs-config.ts !!!
// Edge Functions (Deno) cannot import from `src/`, so the same pricing data
// is duplicated there. A unit test cross-checks both files match.
//
// Active promo: "Summer Time" -50%.
// `price` already reflects the discounted amount the user pays.
// `originalPrice` is shown in UI with strikethrough.

import type { ProductType, CreditType, Tariff } from '../types/payment';

export const PROMO = {
  active: true,
  name: 'summer-time' as const,
  discountPct: 50,
} as const;

export type PurchaseProductType = Exclude<ProductType, 'subscription'>;

export interface TariffPricing {
  price: number;
  originalPrice: number;
  credits: number;
  creditType: CreditType;
  // RU strings — used only on the Edge Functions side, mirrored here so
  // back/front numbers can be validated against the same record.
  ruName: string;
  ruDescription: string;
}

export const TARIFFS_PRICING: Record<PurchaseProductType, TariffPricing> = {
  basic: {
    price: 50,
    originalPrice: 100,
    credits: 1,
    creditType: 'basic',
    ruName: 'Новичок',
    ruDescription: '1 базовая расшифровка (3-4 блока)',
  },
  pack5: {
    price: 150,
    originalPrice: 300,
    credits: 5,
    creditType: 'basic',
    ruName: 'Любитель',
    ruDescription: '5 расшифровок (скидка 40%)',
  },
  pro: {
    price: 250,
    originalPrice: 500,
    credits: 1,
    creditType: 'pro',
    ruName: 'Внутренний мудрец',
    ruDescription: '1 PRO расшифровка (6+ блоков)',
  },
  cassandra: {
    price: 500,
    originalPrice: 1000,
    credits: 1,
    creditType: 'cassandra',
    ruName: 'Кассандра',
    ruDescription: 'Эзотерическое предсказание',
  },
};

const PURCHASE_PRODUCT_TYPES: PurchaseProductType[] = ['basic', 'pack5', 'pro', 'cassandra'];

// Frontend TARIFFS view — uses i18n keys for name/description, derived from TARIFFS_PRICING.
export const TARIFFS: Tariff[] = PURCHASE_PRODUCT_TYPES.map((type) => {
  const pricing = TARIFFS_PRICING[type];
  return {
    type,
    name: `pricing.tariff.${type}.name`,
    description: `pricing.tariff.${type}.description`,
    price: pricing.price,
    originalPrice: pricing.originalPrice,
    credits: pricing.credits,
    creditType: pricing.creditType,
    promoTag: PROMO.active ? PROMO.name : undefined,
  };
});

export function getTariff(type: ProductType): Tariff | undefined {
  return TARIFFS.find((t) => t.type === type);
}

export function getTariffPricing(type: PurchaseProductType): TariffPricing {
  return TARIFFS_PRICING[type];
}
