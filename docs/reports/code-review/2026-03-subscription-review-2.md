# Code Review: Subscription System — Second Review (Fix Verification)

**Date**: 2026-03-10
**Scope**: Full subscription system — DB migrations, Edge Functions, frontend components, services, CI/CD
**Files**: 20 | **Previous reviews**: 2 (CR-1 found 10 issues + 7 improvements; CR-2 verified and expanded)
**Purpose**: Verify all prior fixes are correct; surface any new issues

---

## Executive Summary

The previous 10 issues and 7 improvements have been applied. **9 of 10 items are correctly fixed**. One fix introduced a subtle new regression (webhook period drift for renewals, P3). Three new issues were found during this review — one high-severity bug in `hasProAccessViaSubscription` that silently denies PRO access to users in grace period (`past_due`), one medium data hygiene issue (orphaned pending payment records), and one low-priority cosmetic issue (free tier visible in paid subscription selector).

The codebase is in a deployable state. The P1 issue should be fixed before launch.

---

## Summary

|              | Critical | High | Medium | Low |
|-------------|----------|------|--------|-----|
| Issues       | 0        | 1    | 1      | 2   |
| Improvements | —        | 0    | 1      | 1   |

**Verdict**: NEEDS WORK (P1 issue before launch)

---

## Fix Verification — Previous Issues

### 1. Price formula alignment (P0 → PASS)

**Claim**: Both frontend `calculateSubscriptionPrice` and backend `calculatePrice` now round the total, not the monthly.

**Verified**: `src/types/subscription.ts:129-131` now matches `supabase/functions/_shared/subscription-config.ts:26-27` exactly — both compute `base = monthly * months`, then `total = Math.round(base * (1 - discount/100))`, then `monthly = Math.round(total / months)`. The previous discrepancy of up to 6 RUB is gone.

**Result**: PASS

---

### 2. 3DS return_url (P0 → PASS)

**Claim**: `return_url` now points to `/profile/subscription?from_payment=1`.

**Verified**: `supabase/functions/create-subscription/index.ts:216` builds `paymentReturnUrl = ${origin}/profile/subscription?from_payment=1&subscription_id=${subscriptionId}`. The route `/profile/subscription` is the correct registered route. The `from_payment=1` parameter is detected by `src/pages/Profile/Subscription.tsx:96-99` and triggers polling.

**Result**: PASS

---

### 3. Stuck pending subs — cancel allows pending + cron Step 0 expires stale (P1 → PASS)

**Claim**: `cancel-subscription` accepts `pending` status; cron Step 0 expires pending subs older than 2 hours.

**Verified**: `supabase/functions/cancel-subscription/index.ts:109` — `['active', 'past_due', 'pending'].includes(subscription.status)`. Step 0 at `process-recurring-payments/index.ts:61-73` uses `.eq('status', 'pending').lt('created_at', twoHoursAgo)`. Both are correct.

**Result**: PASS

---

### 4. Webhook returns 500 when creds missing (P1 → PASS)

**Claim**: Webhook returns HTTP 500 (not 200) when YooKassa credentials are absent.

**Verified**: `supabase/functions/payment-webhook/index.ts:604-608` — `{ status: 500 }` is returned when `!shopId || !secretKey`. This is outside the outer try/catch so it won't be swallowed.

**Result**: PASS

---

### 5. 54-FZ receipt — renewal blocked without email (P1 → PASS)

**Claim**: `process-recurring-payments` fetches the user email and throws (blocking the renewal) if email is missing, rather than sending a receipt without a customer contact.

**Verified**: `supabase/functions/process-recurring-payments/index.ts:280-295` — fetches email via `supabase.auth.admin.getUserById`, then `if (!customerEmail) { throw new Error('54-FZ: no customer email...') }`. The throw propagates out of `processRenewalPayment`, is caught by the caller, increments `summary.errors`, and the payment is NOT sent to YooKassa. The subscription_payments record created before the email check remains as `pending` status — this is the data hygiene issue described in new findings below.

**Result**: PASS (with a new minor side-effect noted in I-2)

---

### 6. Step 2/3 overlap — retriedIds tracked (P1 → PASS)

**Claim**: Subscriptions retried in Step 2 are tracked in `retriedIds` and skipped in Step 3.

**Verified**: `process-recurring-payments/index.ts:114` — `const retriedIds: Set<string> = new Set()`. On successful `processRenewalPayment` call, `retriedIds.add(sub.id)`. Step 3 at line 142: `if (retriedIds.has(sub.id)) continue`. Correct. Note: subscriptions that threw an error in Step 2 are NOT added to `retriedIds`, so Step 3 can still expire them if `retry_count >= 3` or grace period exhausted — this is correct behavior.

**Result**: PASS

---

### 7. Post-payment polling in Subscription.tsx (P2 → PASS)

**Claim**: Page polls for active subscription after `from_payment=1` redirect; shows banners for polling/success/timeout states.

**Verified**: `src/pages/Profile/Subscription.tsx:68-91` — `startPolling` sets a 2-second interval calling `getActiveSubscription()`, checks `sub.status === 'active'`, and stops on success with a 30-second timeout. Banners render at lines 160-189 for all three states. The `setRefreshKey(k => k+1)` call triggers `SubscriptionManagement` and `CreditBalance` re-fetch.

**Result**: PASS

---

### 8. CreditBalance refreshKey prop (P2 → PASS)

**Claim**: `CreditBalance` accepts a `refreshKey` prop and re-fetches when it changes.

**Verified**: `src/components/features/payment/CreditBalance.tsx:83` — `refreshKey?: number` in props interface. `useEffect` at line 91 depends on `[refreshKey]`. Re-fetch fires on every `refreshKey` increment. The `Subscription.tsx` page does not currently pass `refreshKey` to `CreditBalance` directly (it passes it to `SubscriptionManagement`), but `CreditBalance` is used elsewhere so the prop is correctly available.

**Result**: PASS

---

### 9. payment_type NOT NULL constraint (P2 → PASS)

**Claim**: Migration 000007 adds `NOT NULL` to `payment_type` after migration 000005 backfills all rows.

**Verified**: `supabase/migrations/20260311000007_subscription_payments_tighten_constraints.sql:6` — `ALTER TABLE subscription_payments ALTER COLUMN payment_type SET NOT NULL`. Migration 000005 backfills using `is_initial`. New rows in Edge Functions always supply `payment_type: 'subscription_initial'` or `'subscription_renewal'`.

**Result**: PASS

---

### 10. formatDate extracted to utils.ts (P3 → PASS)

**Claim**: `formatDate` is now in `src/lib/utils.ts` and used from there.

**Verified**: `src/lib/utils.ts:8-12` defines `formatDate(dateStr: string | null, locale?: string): string`. The function handles `null` by returning `'-'`. `SubscriptionManagement.tsx:12` imports `{ cn, formatDate }` from `'../../../lib/utils'`.

**Result**: PASS

---

## New Issues Found

### High (P1)

#### 1. `hasProAccessViaSubscription` incorrectly denies access to `past_due` subscribers

- **File**: `src/services/creditService.ts:96`
- **Problem**: The function returns `false` for any subscription with `status !== 'active'`. However, `past_due` subscriptions are in a 3-day grace period — the user's access should remain active during this window. The subscriptions table itself tracks `grace_period_end` precisely for this purpose.

  ```ts
  // Current — wrong:
  if (!subscription || subscription.status !== 'active') return false;

  // A past_due user with grace_period_end in the future loses PRO access immediately
  // even though they still have 3 days of paid service remaining.
  ```

- **Impact**: Users whose renewal payment failed (e.g. card expired) lose PRO access immediately, before the grace period retries have a chance to recover the subscription. This is both a UX regression and a breach of the service contract (paid users lose access before the grace window expires).
- **Fix**:
  ```ts
  export async function hasProAccessViaSubscription(): Promise<boolean> {
    const subscription = await getActiveSubscription();
    if (!subscription) return false;

    const isPastDueInGrace =
      subscription.status === 'past_due' &&
      subscription.grace_period_end != null &&
      new Date(subscription.grace_period_end) > new Date();

    if (subscription.status !== 'active' && !isPastDueInGrace) return false;
    return subscription.tier === 'advanced' || subscription.tier === 'premium';
  }
  ```
  Note: `getActiveSubscription()` already returns `past_due` subscriptions (line 115 in `subscriptionService.ts` queries `.in('status', ['active', 'past_due'])`), so no service-layer change is needed — only the check above.

---

### Medium (P2)

#### 2. Orphaned `pending` subscription_payments records after Step 0 stale-pending expiry and 54-FZ email guard

- **File**: `supabase/functions/process-recurring-payments/index.ts:61-73` (Step 0) and `:290-295` (54-FZ guard)
- **Problem**: Two code paths leave `subscription_payments` rows in `pending` status permanently:

  **Path A — Step 0**: When a subscription is expired as stale-pending, the corresponding `subscription_payments` record (created by `create-subscription`) remains `status='pending'` indefinitely. The subscription is gone but the orphaned payment record points to it (foreign key is now `ON DELETE RESTRICT`, so the subscription can't be deleted either — though expiry just changes status, not deletes, so the FK is still valid but the data is confusing).

  **Path B — 54-FZ email guard**: When `processRenewalPayment` throws because `customerEmail` is null, the payment record inserted at line 254-267 remains `status='pending'`. The function throws before it can update the record to `canceled`.

- **Impact**: Accumulates stale `pending` rows in `subscription_payments`. The `grant_subscription_credits` function's subquery (migration 000007) targets `status='succeeded' AND credits_granted_at IS NULL`, so these don't cause double-grants. But they pollute the payment history shown to the user in `SubscriptionManagement` and make audits harder.
- **Fix**:

  For Step 0, add a cleanup step that marks orphaned payments as `canceled`:
  ```ts
  if (stalePending?.length) {
    const expiredIds = stalePending.map(s => s.id)
    await supabase
      .from('subscription_payments')
      .update({ status: 'canceled', failure_reason: 'Subscription expired (stale pending)' })
      .in('subscription_id', expiredIds)
      .eq('status', 'pending')
  }
  ```

  For 54-FZ path, cancel the payment record before throwing:
  ```ts
  if (!customerEmail) {
    await supabase
      .from('subscription_payments')
      .update({ status: 'canceled', failure_reason: '54-FZ: no customer email' })
      .eq('id', subPayment.id)
    throw new Error(`54-FZ: no customer email for subscription ${sub.id}`)
  }
  ```

---

### Low (P3)

#### 3. Webhook renewal period uses `now()` instead of the subscription's `current_period_end`

- **File**: `supabase/functions/payment-webhook/index.ts:298-311`
- **Problem**: When a renewal payment succeeds, the webhook calculates the new subscription period using `const now = new Date()` as the start. The cron job creates the `subscription_payments` record with `period_start = sub.current_period_end` (the correct boundary), but the webhook ignores those dates and uses wall-clock time instead. If the webhook fires 4 hours after the period ended (e.g. due to YooKassa delivery delay), the new period starts 4 hours late and ends 4 hours late — accumulating drift over many billing cycles.
- **Impact**: Low — YooKassa webhooks are typically near-instant. But over a 12-month subscription with monthly renewals, drift could accumulate to a few hours. The subscription_payments record has correct dates; only the subscriptions table has slightly wrong ones.
- **Fix**: The webhook should read the `period_start` from the `subscription_payments` record rather than computing it from `now()`. Since `subscription_payment_id` is already known, fetch the record:
  ```ts
  const { data: paymentRecord } = await supabase
    .from('subscription_payments')
    .select('period_start, period_end')
    .eq('id', subscription_payment_id)
    .single()

  const periodStart = paymentRecord?.period_start ? new Date(paymentRecord.period_start) : now
  const periodEnd = paymentRecord?.period_end ? new Date(paymentRecord.period_end) : /* fallback */
  ```

#### 4. Subscriptions table `tier` check includes `'free'` but `VALID_TIERS` excludes it

- **File**: `supabase/migrations/20260311000001_create_subscriptions_table.sql:7` vs `supabase/functions/_shared/subscription-config.ts:18`
- **Problem**: The DB allows `tier = 'free'` but the Edge Function rejects it at validation. The `grant_subscription_credits` function (migration 000008) also no longer handles `'free'` (raises EXCEPTION). If any code path ever inserts a `free` tier subscription (e.g., future admin tooling), `grant_subscription_credits` will throw and leave the subscription in a broken state.
- **Impact**: Low currently — the constraint mismatch is only a future hazard. No current code path creates `free` subscriptions.
- **Fix**: Add a migration to remove `'free'` from the check constraint:
  ```sql
  ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_tier_check;
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('basic', 'advanced', 'premium'));
  ```

---

## Improvements

### Medium

#### I-1. Cron workflow does not alert on partial failures (`errors > 0`)

- **File**: `.github/workflows/cron-recurring-payments.yml:30-33`
- **Current**: The workflow only fails if the HTTP response is not 200. The response body contains `{"processed": N, "retried": N, "expired": N, "errors": N}` — but the `errors` field is never inspected. An individual subscription payment failure (e.g., YooKassa API down for one user) returns HTTP 200 with `errors: 1`.
- **Recommended**: Add a check on the `errors` field to send an alert (or fail the job) when `errors > 0`:
  ```bash
  ERRORS=$(echo "$BODY" | jq -r '.errors // 0')
  if [ "$ERRORS" -gt 0 ]; then
    echo "::warning::Recurring payment processing had $ERRORS error(s)"
    # Optionally exit 1 to trigger the notify job
  fi
  ```

### Low

#### I-2. Free tier card visible in subscription selector

- **File**: `src/components/features/subscription/SubscriptionSelector.tsx:77`
- **Current**: `SUBSCRIPTION_TIERS.map(...)` iterates all 4 tiers including `free`. The free tier card renders a disabled button — correct but confusing UX (user sees a plan they can't select in a payment flow).
- **Recommended**: Filter out `free` from the selector: `SUBSCRIPTION_TIERS.filter(t => t.tier !== 'free').map(...)`. This reduces the grid from 4 to 3 cards and removes the dead entry.

---

## Positive Patterns

1. **Idempotency is thorough**: Both `handleSubscriptionPaymentSucceeded` and `handleSubscriptionPaymentCanceled` check if the record is already in the target status before updating. This prevents double-credit grants if YooKassa delivers a webhook twice.

2. **Partial unique index design**: The `WHERE status IN ('active', 'past_due', 'pending')` partial unique index is exactly right — it prevents duplicate active subscriptions at the DB level (not just application level), handles the race condition correctly, and doesn't block historical expired/canceled rows.

3. **54-FZ compliance is first-class**: Blocking the renewal payment (rather than sending without a receipt) when email is unavailable is the correct regulatory stance. The error is logged with explicit "54-FZ VIOLATION" text for operator attention.

---

## Escalation

The following items require senior review:

- **Migration 000001 tier check constraint**: The `'free'` tier in the DB constraint vs its absence in application code (VALID_TIERS, grant_subscription_credits) is a schema-level inconsistency. A corrective migration should be reviewed before production.
- **Webhook period date calculation**: The decision to use `now()` vs. DB `period_start/period_end` in the webhook for renewal periods (Issue P3 #3) has billing implications — should be confirmed by the product owner.

---

## Files Reviewed

| File | Verdict | Notes |
|------|---------|-------|
| `supabase/functions/create-subscription/index.ts` | PASS | Price calc, return_url, cleanup correct |
| `supabase/functions/cancel-subscription/index.ts` | PASS | Accepts pending, correct expiry logic |
| `supabase/functions/process-recurring-payments/index.ts` | PASS with notes | retriedIds overlap fix correct; orphaned payment records (I-2 new) |
| `supabase/functions/payment-webhook/index.ts` | PASS with notes | Creds→500 fix correct; period drift minor issue |
| `supabase/functions/_shared/subscription-config.ts` | PASS | Prices and formula correct |
| `supabase/functions/_shared/cors.ts` | PASS | Webhook wildcard comment explains intent |
| `migrations/000001` | NOTE | tier check includes 'free', inconsistent with app code |
| `migrations/000002` | PASS | payment_type added in later migration |
| `migrations/000003` | PASS | UPDATE subquery fix correct |
| `migrations/000004` | PASS | ON DELETE RESTRICT correct for audit compliance |
| `migrations/000005` | PASS | payment_type column + backfill |
| `migrations/000006` | PASS | Partial index (superseded by 000007) |
| `migrations/000007` | PASS | NOT NULL + tighter index predicate |
| `migrations/000008` | PASS | Free tier removed from grant_subscription_credits |
| `src/types/subscription.ts` | PASS | Formula aligned with backend |
| `src/services/subscriptionService.ts` | PASS | Auth, polling trigger, query correct |
| `src/services/creditService.ts` | FAIL | P1: past_due denies access during grace period |
| `src/pages/Profile/Subscription.tsx` | PASS | Polling, banners, cleanup on unmount |
| `src/components/features/subscription/SubscriptionManagement.tsx` | PASS | refreshKey re-fetch, formatDate null-safe |
| `src/components/features/subscription/SubscriptionSelector.tsx` | NOTE | Free tier visible but disabled (I-2) |
| `src/components/features/subscription/SubscriptionTierCard.tsx` | PASS | Free tier handled, pricing display correct |
| `src/components/features/subscription/BillingPeriodSelector.tsx` | PASS | |
| `src/components/features/payment/CreditBalance.tsx` | PASS | refreshKey prop present and wired |
| `.github/workflows/cron-recurring-payments.yml` | NOTE | errors field not checked (I-1) |

---

## Validation

- **Type Check**: PASS (`pnpm type-check` — no errors)
- **Build**: PASS (`pnpm build` — compiled successfully in 8.09s, chunk size warning is pre-existing)
