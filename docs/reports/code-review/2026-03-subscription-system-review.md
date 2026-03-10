# Subscription System Code Review

**Date**: 2026-03-10
**Reviewer**: Code Reviewer (Claude Opus 4.6)
**Scope**: Full subscription system implementation (recurring payments via YooKassa)
**Status**: Review Complete

---

## Executive Summary

The subscription system is a well-structured addition that cleanly extends the existing one-time payment infrastructure. The implementation closely follows the plan document (`docs/plans/parallel-snacking-hoare.md`) and demonstrates solid architectural decisions: shared credit balance, single webhook routing, partial unique index, and proper RLS policies.

However, the review identified **2 critical bugs**, **6 important issues**, and **10 suggestions** that should be addressed before production deployment.

---

## 1. CRITICAL Issues (Must Fix)

### C-1: SQL Syntax Error in `grant_subscription_credits` -- UPDATE with ORDER BY / LIMIT

**File**: `supabase/migrations/20260311000003_create_subscription_functions.sql`, lines 48-56

```sql
UPDATE public.subscription_payments SET
  basic_credits_granted = v_basic,
  cassandra_credits_granted = v_cassandra,
  credits_granted_at = NOW()
WHERE subscription_id = p_subscription_id
  AND status = 'succeeded'
  AND credits_granted_at IS NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Problem**: PostgreSQL does not support `ORDER BY` and `LIMIT` in `UPDATE` statements. This migration will fail at apply time.

**Fix**: Use a subquery to identify the target row:

```sql
UPDATE public.subscription_payments SET
  basic_credits_granted = v_basic,
  cassandra_credits_granted = v_cassandra,
  credits_granted_at = NOW()
WHERE id = (
  SELECT id FROM public.subscription_payments
  WHERE subscription_id = p_subscription_id
    AND status = 'succeeded'
    AND credits_granted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
);
```

### C-2: Double `Deno.serve()` in payment-webhook

**File**: `supabase/functions/payment-webhook/index.ts`

The file contains two `Deno.serve()` calls:
- Line 586 (the main handler)
- A prior implicit call structure that defines handler functions

On closer inspection, the helper functions (`handlePaymentSucceeded`, etc.) are regular functions, and only the bottom `Deno.serve()` at line 586 is the actual entry point. **This is actually fine** -- the functions above are just function declarations, not a second `Deno.serve()`. Reclassifying this as **non-issue** after re-inspection.

**Revised C-2: Race condition in recurring payment retry count**

**File**: `supabase/functions/process-recurring-payments/index.ts`, lines 112-118

```typescript
// Increment retry count before attempting
await supabase
  .from('subscriptions')
  .update({ retry_count: sub.retry_count + 1 })
  .eq('id', sub.id)

await processRenewalPayment(sub, supabase, shopId, secretKey, true)
```

And in `payment-webhook/index.ts`, lines 465-479, the webhook handler for canceled subscription payments also increments `retry_count`:

```typescript
const newRetryCount = (currentSub?.retry_count || 0) + 1
// ... update retry_count: newRetryCount
```

**Problem**: `retry_count` is incremented in TWO places for the same failed renewal -- once in the cron function before the attempt, and once in the webhook when the payment fails. This means each failed retry increments the counter by 2, causing subscriptions to expire after only 2 retries instead of 3.

**Fix**: Choose one location for the increment. Since the webhook is the authoritative source of payment outcome, remove the pre-increment from `process-recurring-payments/index.ts` and keep only the webhook handler's increment.

---

## 2. IMPORTANT Issues (Should Fix)

### I-1: Missing receipt customer email in recurring payments

**File**: `supabase/functions/process-recurring-payments/index.ts`, lines 254-256

```typescript
receipt: {
  customer: {
    // For autopayments we may not have email readily
  },
```

**Problem**: Russian Federal Law 54-FZ requires a valid customer email or phone number in fiscal receipts. An empty `customer` object will cause YooKassa to reject the payment or issue a non-compliant receipt. The code attempts to fetch the email afterward (lines 286-293) but the cast `(yukassaPayload.receipt.customer as Record<string, string>).email = user.email` mutates the payload *after* it was already constructed. If the email fetch fails, the receipt has no customer identifier.

**Recommendation**: Build the payload after fetching the email, or make the email fetch non-optional for compliance. If the email truly cannot be obtained, the receipt must include a phone number instead.

### I-2: `getActiveSubscription` returns canceled subscriptions without expiry check

**File**: `src/services/subscriptionService.ts`, lines 111-117

```typescript
const { data, error } = await client
  .from('subscriptions')
  .select('*')
  .in('status', ['active', 'past_due', 'canceled'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

**Problem**: This returns canceled subscriptions even after their `expires_at` has passed. A subscription that was canceled a month ago and has expired will still be returned to the frontend, blocking the user from seeing the "no subscription" state and subscribing again. The query should filter: `status IN ('active', 'past_due') OR (status = 'canceled' AND expires_at > NOW())`.

**Additionally**: Since this uses `.limit(1).maybeSingle()`, if a user has both a canceled (expired) and no active subscription, the canceled one may be returned depending on `created_at` ordering.

### I-3: CORS wildcard `Access-Control-Allow-Origin: *`

**Files**: All Edge Functions

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
```

**Problem**: While the webhook endpoint needs to accept requests from YooKassa, the `create-subscription` and `cancel-subscription` endpoints are user-facing and should restrict the origin to known domains (`https://symancy.ru`, `http://localhost:5173`). A wildcard CORS policy means any website can make authenticated requests to these endpoints if it can obtain a user's JWT.

**Recommendation**: Use a configurable allowed-origin list for user-facing endpoints. The webhook can remain permissive since it uses API-level verification.

### I-4: Missing error feedback in Subscription page

**File**: `src/pages/Profile/Subscription.tsx`, lines 55-69

```typescript
const handleSelectSubscription = useCallback(async (...) => {
  setIsLoading(true);
  try {
    const result = await createSubscription(tier, period);
    // ...
  } catch (err) {
    console.error('Subscription creation failed:', err);
    // ERROR IS SILENTLY SWALLOWED - user sees nothing
  } finally {
    setIsLoading(false);
  }
}, []);
```

**Problem**: When subscription creation fails (e.g., user already has a subscription, payment service error), the error is only logged to console. The user receives no feedback -- the loading spinner disappears and nothing happens.

**Fix**: Add an error state and display it to the user, similar to how `SubscriptionManagement` handles errors.

### I-5: `payment_type` field missing from `subscription_payments` table

**Files**: `supabase/migrations/20260311000002_create_subscription_payments_table.sql`

The `payment_type` field (`subscription_initial` vs `subscription_renewal`) is only stored in YooKassa metadata, not in the database. This means:
- Distinguishing initial vs renewal payments requires joining with `is_initial` boolean
- If YooKassa metadata is lost, there's no recovery path

The `is_initial` boolean partially covers this, but adding an explicit `payment_type` column would improve auditability and querying.

### I-6: No mechanism to transition from `canceled` to `expired` after `expires_at`

**File**: `supabase/functions/process-recurring-payments/index.ts`

The cron function (Step 3) only checks `past_due` subscriptions for expiration. It does not handle the transition from `canceled` to `expired` when `expires_at` passes. A canceled subscription that has passed its `expires_at` date will remain in `canceled` status forever.

**Fix**: Add a Step 4 to the cron function:

```typescript
// STEP 4: Expire canceled subscriptions past their expires_at
const { data: expiredCanceled } = await supabase
  .from('subscriptions')
  .select('id, user_id, tier')
  .eq('status', 'canceled')
  .not('expires_at', 'is', null)
  .lte('expires_at', now)

for (const sub of expiredCanceled || []) {
  await supabase
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('id', sub.id)
}
```

This also relates to I-2 above -- without this transition, the frontend query returning canceled subscriptions will show stale data.

---

## 3. Suggestions (Nice to Have)

### S-1: Duplicated price/discount constants across 3+ files

**Files**:
- `src/types/subscription.ts` -- `SUBSCRIPTION_TIERS`, `BILLING_DISCOUNTS`
- `supabase/functions/create-subscription/index.ts` -- `TIER_PRICES`, `BILLING_DISCOUNTS`
- `supabase/functions/process-recurring-payments/index.ts` -- `TIER_PRICES`, `BILLING_DISCOUNTS`
- `supabase/migrations/20260311000003_create_subscription_functions.sql` -- hardcoded in CASE

Tier prices, discounts, and credit amounts are duplicated in 4 locations. If pricing changes, all 4 must be updated in sync. Consider:
1. For Edge Functions: use a shared module (Deno supports local imports in Supabase Edge Functions via `_shared/` directory)
2. For the database function: keep it authoritative and have Edge Functions call it, or store tier configs in a `subscription_tier_config` table

### S-2: `formatDate` does not respect user locale

**File**: `src/components/features/subscription/SubscriptionManagement.tsx`, line 27-30

```typescript
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}
```

`toLocaleDateString()` without arguments uses the browser's default locale, which may not match the app's selected language. Pass the current language: `toLocaleDateString(language === 'zh' ? 'zh-CN' : language)`.

### S-3: Hardcoded "Status" column header in payment history table

**File**: `src/components/features/subscription/SubscriptionManagement.tsx`, line 260

```html
<th>Status</th>
```

This English text should use a translation key. Similarly, payment status values on line 285 (`{payment.status}`) are rendered as raw English strings (`succeeded`, `canceled`, `pending`) rather than translated.

### S-4: No keyboard trap handling in modal dialogs

**Files**: `SubscriptionSelector.tsx`, `src/pages/Profile/Subscription.tsx` (payment widget modal)

The modal overlays created with `onClick` backdrop dismissal lack:
- Escape key handling to close
- Focus trapping within the modal
- Scroll lock on the body

Consider using a dialog primitive from Radix UI (already available via shadcn) for proper accessibility.

### S-5: `navigate(0)` for page refresh is a code smell

**File**: `src/pages/Profile/Subscription.tsx`, line 166

```typescript
onComplete={() => {
  setPaymentData(null);
  navigate(0); // refresh page
}}
```

Full page refresh is heavy-handed. Instead, trigger a re-fetch of subscription data by introducing a refresh trigger (e.g., a `key` prop on `SubscriptionManagement` or a callback).

### S-6: Missing index on `subscription_payments.credits_granted_at`

**File**: `supabase/migrations/20260311000003_create_subscription_functions.sql`

The `grant_subscription_credits` function queries `subscription_payments` with `credits_granted_at IS NULL`. If the table grows large, this would benefit from a partial index:

```sql
CREATE INDEX idx_subscription_payments_ungraneted
  ON subscription_payments (subscription_id)
  WHERE credits_granted_at IS NULL;
```

### S-7: `getCreditTypeConfig` recreates objects on every call

**File**: `src/components/features/payment/CreditBalance.tsx`, line 16

The function recreates JSX icon elements every time it's called. Since the icons are static, extract them as constants outside the function. The `t` parameter is not even used inside the function despite being passed.

### S-8: Consider adding `ON DELETE SET NULL` or cascade behavior for `subscription_payments.subscription_id`

**File**: `supabase/migrations/20260311000002_create_subscription_payments_table.sql`

Currently uses `ON DELETE CASCADE`. Deleting a subscription will cascade-delete all its payment records. For audit and financial compliance, payment records should typically be preserved even if the subscription is deleted. Consider `ON DELETE RESTRICT` or `ON DELETE SET NULL`.

### S-9: `return_url` parsing could throw on malformed URL

**File**: `supabase/functions/create-subscription/index.ts`, lines 229-232

```typescript
const origin = return_url
  ? new URL(return_url).origin
  : "https://symancy.ru"
```

If `return_url` is a malformed URL string, `new URL()` will throw. Wrap in try-catch or validate the URL.

### S-10: Subscription page uses inline styles instead of CSS classes

**File**: `src/pages/Profile/Subscription.tsx`, lines 72-120

The header section uses inline `style` attributes heavily (likely copied from Telegram WebApp patterns). While functional, this diverges from the Tailwind CSS patterns used in all other subscription components. Consider migrating to utility classes for consistency.

---

## 4. Plan Alignment Assessment

### Implemented as planned:
- [x] 3 database migrations with correct schema
- [x] Partial unique index for one-active-subscription constraint
- [x] TypeScript types with `SUBSCRIPTION_TIERS` and `calculateSubscriptionPrice`
- [x] `create-subscription` Edge Function with `save_payment_method: true`
- [x] Webhook routing by `metadata.payment_type`
- [x] `cancel-subscription` with access-until-period-end semantics
- [x] `process-recurring-payments` cron function with retry/grace/expire logic
- [x] `subscriptionService.ts` with all 4 planned functions
- [x] `hasProAccessViaSubscription()` in `creditService.ts`
- [x] All 4 subscription UI components
- [x] `CreditBalance.tsx` enhanced with subscription badge
- [x] Subscription page at `/profile/subscription`
- [x] i18n keys in all 3 locales (ru, en, zh)
- [x] `'subscription'` added to `ProductType`

### Deviations from plan:
1. **Tier names**: Plan specified Russian names (Iskatel/Provodnik/Kudesnik), but implementation uses generic English names (Basic/Advanced/Premium) with i18n keys. This is actually **a better approach** since tier identifiers should be locale-neutral.

2. **Missing `docs/TARIFFS.md` update**: The plan listed updating `docs/TARIFFS.md` with a subscription section. This appears not to have been done.

3. **No verification step**: Plan specified running `pnpm type-check` and `pnpm build`. It's unclear if this was done.

---

## 5. Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| JWT verification on user endpoints | PASS | Both `create-subscription` and `cancel-subscription` verify JWT |
| Ownership verification on cancel | PASS | Checks `subscription.user_id !== userId` |
| Service-role auth on cron function | PASS | Compares bearer token with service role key |
| RLS policies on tables | PASS | Users can only SELECT own rows; service_role has full access |
| API-level webhook verification | PASS | Verifies payment via YooKassa GET API call |
| Input validation | PASS | Tier, billing period validated with allowlists |
| SQL injection | PASS | Parameterized queries throughout |
| CORS | WARN | Wildcard origin (see I-3) |
| Idempotency on webhook | PASS | Checks existing payment status before processing |
| Privilege escalation | PASS | Users cannot modify subscription status directly (no INSERT/UPDATE RLS policies) |

---

## 6. Data Integrity Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Atomic operations | WARN | Subscription + payment creation not wrapped in transaction (compensating deletes used instead) |
| Idempotency keys | PASS | YooKassa calls use `crypto.randomUUID()` for idempotency |
| Double webhook handling | PASS | Checks `existingSubPayment.status` before processing |
| Unique constraint on active sub | PASS | Partial unique index enforces at DB level |
| Credit grant atomicity | PASS | `grant_subscription_credits` uses UPSERT with conflict handling |
| Retry count consistency | FAIL | Double-increment issue (see C-2) |
| Period date calculations | PASS | Uses `setMonth()` correctly for period advances |

---

## 7. YooKassa Integration Assessment

| Check | Status | Notes |
|-------|--------|-------|
| `save_payment_method: true` on initial | PASS | Correctly set |
| `payment_method_id` on recurring | PASS | Uses saved method for autopayments |
| Receipt 54-FZ compliance | WARN | Missing customer email in recurring (see I-1) |
| Embedded confirmation flow | PASS | Returns `confirmation_token` correctly |
| Amount format | PASS | Uses `.toFixed(2)` for decimal string |
| Idempotence-Key header | PASS | Present on all API calls |
| Status verification | PASS | Webhook verifies status via GET API |
| Error handling on API failure | PASS | Cleans up DB records on failure |

---

## 8. Files Reviewed

| File | Verdict |
|------|---------|
| `supabase/migrations/20260311000001_create_subscriptions_table.sql` | PASS |
| `supabase/migrations/20260311000002_create_subscription_payments_table.sql` | PASS (see S-8) |
| `supabase/migrations/20260311000003_create_subscription_functions.sql` | FAIL (C-1) |
| `src/types/subscription.ts` | PASS |
| `src/types/payment.ts` | PASS |
| `supabase/functions/create-subscription/index.ts` | PASS (see S-9) |
| `supabase/functions/cancel-subscription/index.ts` | PASS |
| `supabase/functions/process-recurring-payments/index.ts` | FAIL (C-2, I-1) |
| `supabase/functions/payment-webhook/index.ts` | PASS (see C-2) |
| `src/services/subscriptionService.ts` | WARN (I-2) |
| `src/services/creditService.ts` | PASS |
| `src/components/features/subscription/SubscriptionSelector.tsx` | PASS |
| `src/components/features/subscription/SubscriptionTierCard.tsx` | PASS |
| `src/components/features/subscription/BillingPeriodSelector.tsx` | PASS |
| `src/components/features/subscription/SubscriptionManagement.tsx` | WARN (S-2, S-3) |
| `src/components/features/payment/CreditBalance.tsx` | PASS (see S-7) |
| `src/pages/Profile/Subscription.tsx` | WARN (I-4) |
| `src/App.tsx` | PASS |
| `src/lib/i18n.ts` | PASS (all 3 locales present) |

---

## 9. Summary of Required Actions

### Before deploy (Critical):
1. Fix `UPDATE ... ORDER BY LIMIT` syntax in `grant_subscription_credits` (C-1)
2. Fix double retry_count increment across cron + webhook (C-2)

### Before production users (Important):
3. Add receipt customer email/phone for 54-FZ compliance in recurring payments (I-1)
4. Fix `getActiveSubscription` to exclude expired canceled subscriptions (I-2)
5. Add user-facing error feedback in Subscription page (I-4)
6. Add canceled-to-expired transition in cron function (I-6)

### Recommended follow-ups:
7. Restrict CORS on user-facing endpoints (I-3)
8. Add `payment_type` column to `subscription_payments` (I-5)
9. Consolidate duplicated price constants (S-1)
10. Update `docs/TARIFFS.md` per plan

---

## 10. What Was Done Well

1. **Clean routing in webhook**: The `isSubscriptionPayment()` check and branching pattern is clear and maintainable, avoiding the need for a separate webhook endpoint.

2. **Idempotency throughout**: Both one-time and subscription payment handlers check for already-processed status before taking action.

3. **Compensating transactions**: When payment record creation fails, the subscription is cleaned up. When YooKassa fails, both records are cleaned up.

4. **i18n completeness**: All subscription keys are present in all 3 locales with contextually appropriate translations.

5. **RLS design**: Properly restrictive -- users can only SELECT their own data, all writes go through service_role via Edge Functions.

6. **Type safety**: The TypeScript types mirror the database schema accurately, with proper nullable fields.

7. **UI/UX**: Loading states, cancel confirmation dialog, billing period selector with discount badges -- all present and well-designed.
