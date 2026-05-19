// supabase/functions/_shared/tariffs-config.ts
// Single source of truth for one-time purchase tariffs (Edge Functions side).
//
// !!! KEEP IN SYNC with src/constants/tariffs.ts (TARIFFS_PRICING) !!!
// Edge Functions run on Deno and cannot import from `src/` (Vite-bundled).
// A unit test cross-checks both files match (src/constants/__tests__/tariffs.sync.test.ts).
//
// Active promo: "Summer Time" -50% (sym-summer-2026).
// `price` already reflects the discounted amount the user pays.
// `originalPrice` is shown in UI with strikethrough.

export type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra'
export type CreditType = 'basic' | 'pro' | 'cassandra'

export interface TariffConfig {
  price: number
  originalPrice: number
  credits: number
  creditType: CreditType
  name: string         // RU human-readable name (used in YooKassa description, receipts, emails)
  description: string  // RU human-readable description
}

export const PROMO = {
  active: true,
  name: 'summer-time',
  discountPct: 50,
} as const

export const TARIFFS: Record<ProductType, TariffConfig> = {
  basic: {
    price: 50,
    originalPrice: 100,
    credits: 1,
    creditType: 'basic',
    name: 'Новичок',
    description: '1 базовая расшифровка (3-4 блока)',
  },
  pack5: {
    price: 150,
    originalPrice: 300,
    credits: 5,
    creditType: 'basic',
    name: 'Любитель',
    description: '5 расшифровок (скидка 40%)',
  },
  pro: {
    price: 250,
    originalPrice: 500,
    credits: 1,
    creditType: 'pro',
    name: 'Внутренний мудрец',
    description: '1 PRO расшифровка (6+ блоков)',
  },
  cassandra: {
    price: 500,
    originalPrice: 1000,
    credits: 1,
    creditType: 'cassandra',
    name: 'Кассандра',
    description: 'Эзотерическое предсказание',
  },
}

export const VALID_PRODUCT_TYPES: ProductType[] = ['basic', 'pack5', 'pro', 'cassandra']

export function isValidProductType(type: string): type is ProductType {
  return VALID_PRODUCT_TYPES.includes(type as ProductType)
}

export function getTariff(type: ProductType): TariffConfig {
  return TARIFFS[type]
}
