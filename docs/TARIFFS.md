# Symancy Tariffs & Credits System

> **Last Updated**: 2025-12-28
> **Status**: Active
> **Related Files**:
> - `symancy-backend/src/modules/credits/service.ts` - Credit operations
> - `symancy-backend/src/modules/onboarding/handler.ts` - Free tier grant
> - `specs/002-pre-mvp-payments/spec.md` - Original payment spec

## Overview

Symancy uses a **pay-per-use credit system** (no subscriptions). Users purchase credits which are consumed for coffee reading analyses.

## Credit Costs

| Persona | Credits per Analysis | Description |
|---------|---------------------|-------------|
| **Arina** | 1 credit | Friendly fortune teller, basic analysis |
| **Cassandra** | 3 credits | Mystical premium persona, deeper insights |

## Tariff Tiers

| Tariff | Price (RUB) | Credits | Product Type | Description |
|--------|-------------|---------|--------------|-------------|
| Базовый "Новичок" | 100₽ | 1 basic | `basic` | 1 basic reading, 5-10 min wait |
| Пакет "Любитель" | 300₽ | 5 basic | `pack5` | 5 readings, <2 min wait |
| Разовый "Внутренний мудрец" | 500₽ | 1 pro | `pro` | 1 PRO reading (6+ blocks), minimal wait |
| Предсказание "Кассандра" | 1000₽ | 1 cassandra | `cassandra` | Esoteric prediction by Cassandra |

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
