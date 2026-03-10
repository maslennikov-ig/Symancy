# Symancy Tariffs & Credits System

> **Last Updated**: 2026-03-10
> **Status**: Active
> **Related Files**:
> - `symancy-backend/src/modules/credits/service.ts` - Credit operations
> - `symancy-backend/src/modules/onboarding/handler.ts` - Free tier grant
> - `symancy-backend/src/config/constants.ts` - READING_TOPICS, TOPIC_FOCUS_INSTRUCTIONS
> - `symancy-backend/src/modules/photo-analysis/keyboards.ts` - Topic selection UI
> - `specs/002-pre-mvp-payments/spec.md` - Original payment spec

## Overview

Symancy uses a **dual credit system**: pay-per-use purchases AND recurring subscriptions. Both models coexist — subscribers can also buy additional credit packs. All credits go to a shared balance.

## Basic vs Pro Differentiation

The key difference between Basic and Pro tiers is **topic selection**:

| Tier | Topic Selection | Analysis Depth |
|------|-----------------|----------------|
| **Basic** (1 credit) | User selects **ONE topic** | Deep focused analysis on selected area |
| **Pro** (1 credit) | Automatic **ALL 6 topics** | Comprehensive analysis across all life areas |

### Reading Topics

After sending a photo, users see a topic selection keyboard:

| Topic | Emoji | Description |
|-------|-------|-------------|
| `love` | ❤️ | Love and relationships |
| `career` | 💼 | Career and work |
| `money` | 💰 | Finances and material wellbeing |
| `health` | 🏥 | Health and energy |
| `family` | 👨‍👩‍👧 | Family and loved ones |
| `spiritual` | 🌟 | Spiritual development |
| `all` | 💎 | All topics (PRO) |

**User Flow**:
1. User sends photo of coffee grounds
2. Bot shows topic selection keyboard (6 topics + "All topics PRO")
3. User selects topic
4. If single topic → consume 1 basic credit → focused analysis
5. If "all" → consume 1 pro credit → comprehensive analysis

## Credit Costs

| Persona | Credits per Analysis | Description |
|---------|---------------------|-------------|
| **Arina** | 1 credit | Friendly fortune teller, basic/pro analysis |
| **Cassandra** | 3 credits | Mystical premium persona, always full analysis |

## Tariff Tiers

| Tariff | Price (RUB) | Credits | Product Type | Description |
|--------|-------------|---------|--------------|-------------|
| Базовый "Новичок" | 100₽ | 1 basic | `basic` | 1 single-topic reading |
| Пакет "Любитель" | 300₽ | 5 basic | `pack5` | 5 single-topic readings |
| Разовый "Внутренний мудрец" | 500₽ | 1 pro | `pro` | 1 full analysis (all 6 topics) |
| Предсказание "Кассандра" | 1000₽ | 1 cassandra | `cassandra` | Esoteric prediction by Cassandra |

## Subscription Tiers (Recurring)

Subscriptions provide monthly credit grants via automatic recurring payments through YooKassa.

### Tiers

| Tier | Monthly Price | Basic Credits/month | Cassandra Credits/month | PRO Access |
|------|--------------|---------------------|------------------------|------------|
| Free | 0₽ | 4 | 0 | No |
| Базовый (Basic) | 299₽ | 21 | 0 | No |
| Продвинутый (Advanced) | 799₽ | 68 | 0 | Yes |
| Премиум (Premium) | 3333₽ | 121 | 7 | Yes |

### Billing Period Discounts

| Period | Discount |
|--------|----------|
| 1 month | 0% |
| 3 months | 15% |
| 6 months | 25% |
| 12 months | 50% |

### Subscription Lifecycle

1. **Initial payment**: User selects tier + billing period → YooKassa payment with `save_payment_method: true`
2. **Activation**: Webhook confirms payment → subscription activated, credits granted, payment method saved
3. **Renewal**: Cron function (`process-recurring-payments`) charges saved payment method before period end
4. **Failed renewal**: 3-day grace period, 3 retry attempts, then subscription expires
5. **Cancellation**: User cancels → access continues until current period end, then expires

### Key Architecture Decisions

- **Shared balance**: Subscription credits go to the same `user_credits` table as one-time purchases
- **Credits accumulate**: Unused credits carry over, they never expire
- **PRO access via tier**: Advanced/Premium tiers unlock PRO analyses without consuming `pro_credits`
- **One active subscription**: Partial unique index enforces max 1 active/pending subscription per user
- **Coexistence**: Subscribers can buy additional credit packs on top of their subscription

### Related Files

- `src/types/subscription.ts` — TypeScript types and tier configs
- `src/services/subscriptionService.ts` — Service layer
- `supabase/functions/create-subscription/` — Initial payment Edge Function
- `supabase/functions/cancel-subscription/` — Cancellation Edge Function
- `supabase/functions/process-recurring-payments/` — Cron renewal function
- `supabase/functions/payment-webhook/index.ts` — Handles both one-time and subscription webhooks
- `supabase/migrations/20260311000001-3_*` — Database schema

## Free Tier

New users receive **1 free credit** upon completing onboarding. This is a **one-time bonus**.

| Event | Credits Granted | Idempotent | Notes |
|-------|-----------------|------------|-------|
| Onboarding completed | 1 credit | Yes | Only granted once per user via `free_credit_granted` flag |

### Idempotency

The free tier grant is **idempotent** - calling `grantInitialCredits()` multiple times will only grant credits once. This prevents:
- Users restarting onboarding to get extra credits
- Race conditions from duplicate webhook calls
- Bugs in onboarding flow causing multiple grants

**Enforcement**: Database-level `free_credit_granted` boolean flag in `backend_user_credits` table.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| User restarts onboarding | No additional credits (idempotent) |
| User deletes and re-registers with same Telegram ID | Same user record, no additional credits |
| Concurrent onboarding completions | Atomic upsert ensures single grant |
| Database failure during grant | Logged to audit, can be manually resolved |

## Database Architecture

### Telegram Bot (Primary)

**Table**: `backend_user_credits`
| Column | Type | Description |
|--------|------|-------------|
| `telegram_user_id` | BIGINT PK | FK to profiles |
| `credits` | INTEGER | Current balance (CHECK >= 0) |
| `free_credit_granted` | BOOLEAN | Idempotency flag |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last modification |

**Functions**:
- `consume_credits(p_telegram_user_id, p_amount)` - Deduct credits atomically
- `refund_credits(p_telegram_user_id, p_amount)` - Refund credits on failure
- `grant_initial_credits(p_telegram_user_id, p_amount)` - Grant free credits (idempotent)

### Audit Trail

**Table**: `backend_credit_transactions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Transaction ID |
| `telegram_user_id` | BIGINT | FK to profiles |
| `transaction_type` | TEXT | `grant_initial`, `purchase`, `consume`, `refund`, `admin_adjustment` |
| `amount` | INTEGER | Credits changed |
| `balance_before` | INTEGER | Balance before transaction |
| `balance_after` | INTEGER | Balance after transaction |
| `metadata` | JSONB | Additional context (source, etc.) |
| `created_at` | TIMESTAMPTZ | Transaction timestamp |

### Web App (via Supabase Auth)

**Table**: `user_credits`
- **Key**: `user_id` (uuid, FK to auth.users)
- **Functions**: `grant_credits()`, `consume_credit()`

## Service Layer API

### grantInitialCredits()

```typescript
interface GrantCreditsResult {
  success: boolean;
  balance: number;
  alreadyGranted: boolean;
  error?: string;
}

async function grantInitialCredits(
  telegramUserId: number,
  amount = 1
): Promise<GrantCreditsResult>
```

**Input Validation**:
- `telegramUserId` must be positive integer
- `amount` must be 1-10 (enforced at service + DB level)

**Usage Example**:
```typescript
const result = await grantInitialCredits(12345);

if (!result.success) {
  logger.error({ error: result.error });
} else if (result.alreadyGranted) {
  logger.info("Idempotent call - credits already granted");
} else {
  logger.info({ balance: result.balance }, "Credits granted");
}
```

## Implementation Notes

1. **Credit Check**: Always verify credits before starting photo analysis
2. **Atomic Operations**: Use RPC functions for thread-safe credit operations
3. **Refunds**: Automatic refund on analysis failure
4. **No Negative Balance**: Database CHECK constraint prevents negative credits
5. **Idempotency**: Free tier grant is idempotent via `free_credit_granted` flag
6. **Audit Trail**: All credit operations logged to `backend_credit_transactions`

## Payment Provider

- **Provider**: YooKassa (ЮKassa/YooMoney)
- **Commission**: 2.4-2.8%
- **Methods**: Cards, SBP, Apple Pay, Google Pay
- **Compliance**: 54-FZ online cash register built-in

## Configuration

```typescript
// src/modules/credits/service.ts
export const FREE_TIER = {
  ONBOARDING_BONUS: 1,    // Credits granted on onboarding
  MAX_FREE_GRANT: 10,     // Maximum for any free grant
} as const;
```
