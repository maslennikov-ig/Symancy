# Plan: Fix free credit not working for new users

## Context

Users report that the free credit doesn't work. Investigation of DB and code reveals a **table mismatch**: credits are granted to the legacy table, but the Mini App reads from the omnichannel table.

## Root Cause Analysis

### Two parallel credit systems exist:

| System | Table | Used by |
|--------|-------|---------|
| Legacy | `backend_user_credits` | Bot onboarding (`grantInitialCredits`), bot credit checks (`hasCredits`, `consumeCredits`) |
| Omnichannel | `unified_user_credits` | Mini App frontend (`getUserCredits` in paymentService.ts), unified credit ops (`hasCreditsOfType`, `consumeCreditsOfType`) |

### What happens for a new Telegram user:

1. User starts bot → onboarding LangGraph runs in bot chat
2. `complete.ts:35` → calls `grantInitialCredits(telegramUserId)` → writes 1 credit to **`backend_user_credits`** ✓
3. User opens Mini App → `webapp-auth.ts` calls `findOrCreateByTelegramId()` → creates **`unified_users`** + **`unified_user_credits`** (with 0 credits)
4. Mini App `getUserCredits()` (`paymentService.ts:97`) → queries **`unified_user_credits`** → finds 0 credits → user sees "no credits"

### DB evidence (2026-04-04):

| User | profiles | backend_user_credits | unified_users | unified_user_credits |
|------|----------|---------------------|---------------|---------------------|
| Helen (844694794) | ✓ onboarding done | ✓ credits=1, free_granted=true | ✗ NOT FOUND | ✗ NOT FOUND |
| Wider (5736707784) | ✓ onboarding done | ✓ credits=1, free_granted=true | ✗ NOT FOUND | ✗ NOT FOUND |

Credits ARE granted but to the wrong table. New users haven't opened the Mini App yet, so `unified_users` records don't exist. Even if they do, credits won't be there.

## Fix Strategy

Two-part fix:

### Part 1: Immediate — Data migration (SQL)

Create `unified_users` + `unified_user_credits` records for all Telegram users who exist in `profiles` + `backend_user_credits` but not in `unified_users`. Copy their credit balance.

**File**: New Supabase migration

```sql
-- For each profiles user missing from unified_users:
-- 1. Create unified_users record
-- 2. Create unified_user_credits with credits from backend_user_credits
```

### Part 2: Root cause — Fix onboarding to also grant to unified table

Modify `grantInitialCredits()` in `symancy-backend/src/modules/credits/service.ts` to ALSO:
1. Call `findOrCreateByTelegramId()` to ensure `unified_users` record exists
2. Grant credit to `unified_user_credits` (set `credits_basic += amount`, `free_credit_granted = true`)

**Files to modify**:
- `symancy-backend/src/modules/credits/service.ts` — `grantInitialCredits()` function (line 375)
- `symancy-backend/src/graphs/onboarding/nodes/complete.ts` — may need to also call `findOrCreateByTelegramId` before granting

### Key files:

| File | Role |
|------|------|
| `symancy-backend/src/modules/credits/service.ts` | Credit granting (`grantInitialCredits` line 375) |
| `symancy-backend/src/graphs/onboarding/nodes/complete.ts` | Onboarding completion node |
| `symancy-backend/src/services/user/UnifiedUserService.ts` | `findOrCreateByTelegramId()` — creates unified_users |
| `src/services/paymentService.ts` | Frontend `getUserCredits()` (line 86) — reads from unified_user_credits |
| `symancy-backend/src/modules/credits/service.ts:491` | `hasCreditsOfType()` — uses `has_unified_credit` RPC |

### Existing RPC functions to reuse:
- `find_or_create_user_by_telegram` — creates unified_users + unified_user_credits records
- `grant_initial_credits` — only writes to backend_user_credits (needs extension or new RPC)

## Verification

1. `pnpm type-check && pnpm build` in symancy-backend
2. Query DB: confirm Helen and Wider have `unified_user_credits` records with credits_basic >= 1
3. Open Mini App as a test user → BalanceCard shows 1 credit
4. New user onboarding → check both `backend_user_credits` AND `unified_user_credits` have the credit
