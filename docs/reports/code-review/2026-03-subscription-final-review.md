# Code Review: Subscription System (Recurring Payments via YooKassa)

**Date**: 2026-03-10
**Reviewer**: Code Reviewer Worker (claude-sonnet-4-6)
**Scope**: Full subscription system — DB migrations, Edge Functions, frontend components, services, CI/CD
**Files**: 20 | **Commits reviewed**: 5 (4dfa9ca → 5a14698)

---

## Executive Summary

The subscription system is architecturally sound and well-structured. The YooKassa integration follows the correct pattern (API verification rather than HMAC, idempotency checks, save_payment_method for recurring). RLS policies, partial unique index for one-active-per-user, and grace period/retry logic are all present.

However, there are **two critical bugs** that will cause real money/UX failures in production:

1. **Price mismatch between frontend display and actual charge**: The frontend and backend use different discount formulas, producing amounts that differ by up to 6 RUB. Users will see one price, be charged another.
2. **3D Secure redirect lands on a 404**: The `return_url` in the YooKassa payment points to `/subscription/result` which has no registered route. Any 3DS challenge (e.g. on first card payment) leaves the user on a blank page with no feedback.

There are also several medium and low severity issues around 54-FZ receipt compliance, stuck-pending subscription handling, and frontend UX gaps.

---

## Summary

|              | Critical | High | Medium | Low |
|-------------|----------|------|--------|-----|
| Issues       | 2        | 1    | 4      | 3   |
| Improvements | —        | 2    | 3      | 2   |

**Verdict**: NEEDS WORK

---

## Issues

### Critical (P0)

#### 1. Price mismatch: frontend displays different amount than backend charges

- **File**: `src/types/subscription.ts:129` vs `supabase/functions/_shared/subscription-config.ts:27`
- **Problem**: The two price calculation functions apply the discount at different stages, producing different results due to integer rounding.

  Frontend (`calculateSubscriptionPrice`):
  ```ts
  const monthlyAmount = Math.round(baseMonthly * (1 - discount / 100));
  const totalAmount = monthlyAmount * billingPeriod;   // rounds monthly first, then multiplies
  ```

  Backend (`calculatePrice`):
  ```ts
  const base = monthlyPrice * billingPeriodMonths;
  const total = Math.round(base * (1 - discountPercent / 100));  // multiplies first, then rounds
  ```

  Confirmed discrepancies (verified with Node.js):
  | Tier | Period | Frontend shows | Backend charges | Delta |
  |------|--------|---------------|----------------|-------|
  | basic | 6 mo | 1344 ₽ | 1346 ₽ | −2 ₽ |
  | basic | 12 mo | 1800 ₽ | 1794 ₽ | +6 ₽ |
  | advanced | 6 mo | 3594 ₽ | 3596 ₽ | −2 ₽ |
  | advanced | 12 mo | 4800 ₽ | 4794 ₽ | +6 ₽ |
  | premium | 6 mo | 15000 ₽ | 14999 ₽ | +1 ₽ |
  | premium | 12 mo | 20004 ₽ | 19998 ₽ | +6 ₽ |

- **Impact**: Users will see an incorrect price on the subscription selector card and be charged a different amount. This is a legal and trust issue. The receipt amount (from backend) will also not match the UI-displayed total.
- **Fix**: Align both to the same formula. The backend formula (round the total, not the monthly) is the more standard approach and avoids cumulative rounding error. Update `calculateSubscriptionPrice` in `src/types/subscription.ts`:
  ```ts
  export function calculateSubscriptionPrice(tier, billingPeriod) {
    const config = SUBSCRIPTION_TIERS.find(t => t.tier === tier);
    const baseMonthly = config.priceMonthly;
    const discount = BILLING_DISCOUNTS[billingPeriod];
    const base = baseMonthly * billingPeriod;
    const totalAmount = Math.round(base * (1 - discount / 100));
    const monthlyAmount = Math.round(totalAmount / billingPeriod);
    return { totalAmount, monthlyAmount, baseMonthly, discount };
  }
  ```

---

#### 2. 3D Secure return_url points to a non-existent route

- **File**: `supabase/functions/create-subscription/index.ts:209`
- **Problem**: The `return_url` for 3DS challenge redirect is constructed as:
  ```ts
  const paymentReturnUrl = `${origin}/subscription/result?subscription_id=${subscriptionId}`
  ```
  There is no `/subscription/result` route in the React app. The router only registers `/profile/subscription` (confirmed by `src/App.tsx:633`). After a 3DS redirect, the user lands on a 404/blank page with no indication their payment may have succeeded.
- **Impact**: Any card that requires 3DS authentication (common in Russia) will leave the user stranded. The payment may succeed (YooKassa webhook will fire), but the user has no feedback and cannot see their updated subscription. High likelihood of support tickets and duplicate subscription attempts.
- **Fix**: Either create a `/subscription/result` route that polls for subscription activation, or change the return URL to the existing page:
  ```ts
  const paymentReturnUrl = `${origin}/profile/subscription?from_payment=1&subscription_id=${subscriptionId}`
  ```
  Then in `Subscription.tsx`, read the `from_payment` query param and show a "payment processing" banner while polling `getActiveSubscription`.

---

### High (P1)

#### 3. Stuck pending subscriptions block new subscriptions indefinitely

- **File**: `supabase/functions/cancel-subscription/index.ts:109` and `supabase/migrations/20260311000001_create_subscriptions_table.sql:29`
- **Problem**: The partial unique index prevents creating a new subscription while one exists with status `pending`, `active`, or `past_due`. The cancel endpoint only allows cancelling `active` or `past_due` subscriptions:
  ```ts
  if (!['active', 'past_due'].includes(subscription.status)) {
    return ... "Cannot cancel subscription with status: pending"
  }
  ```
  If a user starts checkout but never completes payment (abandons the YooKassa widget, network drops, browser closes), the subscription stays `pending` forever. There is no cleanup job for stale pending subscriptions. The user cannot cancel it and cannot create a new one.
- **Impact**: A real scenario: user opens subscription selector, clicks subscribe, closes the browser before paying. They are now locked out of subscribing until a developer manually deletes the pending record.
- **Fix**: Either (a) allow cancellation of `pending` subscriptions in `cancel-subscription`, or (b) add a cleanup step in `process-recurring-payments` that expires pending subscriptions older than e.g. 2 hours:
  ```ts
  // STEP 0: Expire stale pending subscriptions (no payment within 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', twoHoursAgo)
  ```

---

### Medium (P2)

#### 4. 54-FZ receipt sent without customer contact when email is unavailable

- **File**: `supabase/functions/process-recurring-payments/index.ts:272`
- **Problem**: When fetching the user email for the fiscal receipt fails (line 263–265), the code falls through and sends a YooKassa payment with an empty `customer` object:
  ```ts
  const receiptCustomer: Record<string, string> = customerEmail ? { email: customerEmail } : {}
  // receipt: { customer: receiptCustomer, ... }
  ```
  Under 54-FZ, a fiscal receipt must include customer contact information (email or phone). YooKassa may accept the request but fail to generate a valid receipt, which is a regulatory violation.
- **Impact**: Russian fiscal law violation on recurring renewals when the email lookup fails. The failure is logged as `console.warn` (non-critical), but is actually a compliance issue.
- **Fix**: Treat missing customer email as a blocking error for autopayments. Either: fail the payment attempt and log it for manual review, or require phone number as fallback. At minimum, upgrade from `console.warn` to `console.error` and consider alerting.

---

#### 5. Race condition window between duplicate-check and subscription insert

- **File**: `supabase/functions/create-subscription/index.ts:118–133`
- **Problem**: The check for existing subscriptions and the subsequent insert are two separate operations with no transaction or lock:
  ```ts
  // Check for existing active/pending subscription
  const { data: existingSub } = await supabaseAdmin
    .from('subscriptions')
    .select(...)
    .in('status', ['active', 'past_due', 'pending'])
    .maybeSingle()

  // ... later ...
  await supabaseAdmin.from('subscriptions').insert(...)
  ```
  Two simultaneous requests from the same user could both pass the check before either inserts.
- **Impact**: Could theoretically create duplicate pending subscriptions, blocking the user. In practice, the partial unique index on `(user_id) WHERE status IN ('active', 'past_due', 'pending')` at the DB level will catch this and return a 500 from Supabase — but the error response back to the user will be generic ("Failed to create subscription") rather than informative. The actual data integrity is protected; the UX on race is not graceful.
- **Fix**: Catch the unique constraint violation specifically and return a `409 EXISTING_SUBSCRIPTION` response:
  ```ts
  if (subError?.code === '23505') { // unique_violation
    return new Response(
      JSON.stringify({ error: 'Subscription already exists', code: 'EXISTING_SUBSCRIPTION' }),
      { status: 409, ... }
    )
  }
  ```

---

#### 6. Concurrent retry and expiry in process-recurring-payments (Step 2 vs Step 3)

- **File**: `supabase/functions/process-recurring-payments/index.ts:84–160`
- **Problem**: Steps 2 and 3 both operate on `past_due` subscriptions in the same run without coordination. Step 2 queries `past_due AND retry_count < 3 AND grace_period_end > now`. Step 3 queries all `past_due` subscriptions and computes `shouldExpire = retry_count >= 3 OR grace_period_end <= now`. A subscription with `retry_count = 2` and `grace_period_end` within the same second as `now` could be processed for retry in Step 2 (creating a new payment) AND expired in Step 3 in the same cron run.
- **Impact**: The subscription gets expired and a renewal payment is issued simultaneously. The webhook will try to activate an expired subscription if the payment succeeds. Low probability with daily cron, but real.
- **Fix**: In Step 3, exclude subscriptions that were processed in Step 2 (e.g. by tracking their IDs), or add a small buffer to the grace period comparison:
  ```ts
  const shouldExpire = sub.retry_count >= 3 ||
    (sub.grace_period_end && new Date(sub.grace_period_end) < new Date(Date.now() - 60_000))
  ```

---

#### 7. Webhook silently drops all events when YooKassa credentials are missing

- **File**: `supabase/functions/payment-webhook/index.ts:603–609`
- **Problem**: When `YUKASSA_SHOP_ID` or `YUKASSA_SECRET_KEY` env vars are not set, the webhook handler returns `{ ok: true }` with HTTP 200 — silently acknowledging and dropping the payment event:
  ```ts
  if (!shopId || !secretKey) {
    console.error('YooKassa credentials not configured')
    return new Response(JSON.stringify({ ok: true }), { status: 200, ... })
  }
  ```
- **Impact**: In a misconfigured environment (e.g. new deployment where secrets haven't been added yet), every payment event is silently acknowledged and lost. Payments succeed in YooKassa, but no credits are granted and no subscriptions are activated. The `console.error` is the only signal.
- **Fix**: Return HTTP 500 so YooKassa retries the event later:
  ```ts
  return new Response(
    JSON.stringify({ error: 'Payment service not configured' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  )
  ```

---

### Low (P3)

#### 8. payment_type column allows NULL — new rows from external sources could slip through

- **File**: `supabase/migrations/20260311000005_add_payment_type_to_subscription_payments.sql:6`
- **Problem**: The column is added without `NOT NULL`:
  ```sql
  ADD COLUMN payment_type TEXT CHECK (payment_type IN ('subscription_initial', 'subscription_renewal'));
  ```
  The backfill runs only for existing rows. New rows inserted without `payment_type` (if `process-recurring-payments` ever has a code path that omits it) will silently have NULL.
- **Impact**: Low — all current insert paths in the codebase explicitly set `payment_type`. But missing NOT NULL is a schema contract violation.
- **Fix**: After backfill, add `NOT NULL` via a follow-up migration:
  ```sql
  ALTER TABLE subscription_payments ALTER COLUMN payment_type SET NOT NULL;
  ```

---

#### 9. Partial ungranted index does not filter by status='succeeded'

- **File**: `supabase/migrations/20260311000006_add_subscription_payments_ungranted_index.sql:4`
- **Problem**: The index predicate is only `WHERE credits_granted_at IS NULL`, but the query it supports also filters `AND status = 'succeeded'`. The index will include `pending` and `canceled` rows with no `credits_granted_at`, slightly bloating the index for no benefit.
- **Impact**: Minor — no correctness issue, small extra index size.
- **Fix**: Tighten the predicate:
  ```sql
  CREATE INDEX idx_subscription_payments_ungranted
    ON subscription_payments (subscription_id)
    WHERE status = 'succeeded' AND credits_granted_at IS NULL;
  ```

---

#### 10. CreditBalance.tsx has empty useEffect dependency array — stale after payment

- **File**: `src/components/features/payment/CreditBalance.tsx:109`
- **Problem**: `useEffect(() => { fetchData() }, [])` — the component fetches data once on mount and never again. After a subscription payment completes, if `CreditBalance` is rendered (e.g. on the Profile page), it will show the old credit balance until page reload.
- **Impact**: User completes subscription, navigates to profile, sees old credit count. Confusing UX.
- **Fix**: Add a `refreshKey` prop (same pattern as `SubscriptionManagement`) and include it in the dependency array. Or expose a refresh callback ref.

---

## Improvements

### High

#### I-1. `free` tier in `SubscriptionTierConfig` creates untested codepath in `grant_subscription_credits`

- **File**: `supabase/migrations/20260311000003_create_subscription_functions.sql:21`
- **Current**: The SQL function handles `'free'` tier (grants 4 basic credits), but `VALID_TIERS` in the Edge Functions config excludes `'free'`. The `free` tier path in the function is reachable only if a service-role call manually sets `tier='free'` on a subscription — which nothing currently does.
- **Recommended**: Either remove the `'free'` case from `grant_subscription_credits` to keep it consistent with the API contract, or document explicitly why it's there. Unreachable code in financial logic is a maintenance hazard.

#### I-2. subscriptionService.ts hardcodes the Supabase project URL

- **File**: `src/services/subscriptionService.ts:14`
- **Current**: `const EDGE_FUNCTION_URL = 'https://johspxgvkbrysxhilmbg.supabase.co/functions/v1'`
- **Recommended**: Use the env var: `const EDGE_FUNCTION_URL = \`${import.meta.env.VITE_SUPABASE_URL}/functions/v1\`` — consistent with how other services derive URLs and prevents breakage if the project is migrated.

---

### Medium

#### I-3. Subscription page refreshes immediately after payment widget signals completion

- **File**: `src/pages/Profile/Subscription.tsx:162–165`
- **Current**: On `onComplete`, the page closes the widget and increments `refreshKey` immediately. But subscription activation is async — it happens when the YooKassa webhook fires (typically 1–10 seconds after widget completion). The re-fetched subscription will still show `pending`.
- **Recommended**: After closing the widget, show a "Processing payment..." banner and poll `getActiveSubscription` with a 2-second interval for up to 30 seconds, then show the result. This matches the UX of virtually all payment flows.

#### I-4. `formatDate` in SubscriptionManagement is defined locally, duplicated elsewhere

- **File**: `src/components/features/subscription/SubscriptionManagement.tsx:29`
- **Current**: Standalone `formatDate` function. Other components likely have similar helpers.
- **Recommended**: Move to `src/lib/utils.ts` or a date utility module.

#### I-5. `SubscriptionTierCard` shows total cost only when `billingPeriod > 1`, not the billing cadence

- **File**: `src/components/features/subscription/SubscriptionTierCard.tsx:71–75`
- **Current**: For multi-month plans, shows "Total: X₽" but doesn't clarify that billing happens once at the start of the period (not monthly). Users may assume they'll be charged monthly at the discounted rate.
- **Recommended**: Add a clarifying line: "Charged once per period" or "Списывается раз в N месяцев".

---

### Low

#### I-6. `webhookCorsHeaders` uses `Access-Control-Allow-Origin: *`

- **File**: `supabase/functions/_shared/cors.ts:15`
- **Current**: `webhookCorsHeaders` sets wildcard CORS origin. This is used by `payment-webhook`.
- **Recommended**: Webhooks are server-to-server calls from YooKassa. CORS headers on webhooks are meaningless (YooKassa doesn't send an `Origin` header). The wildcard is harmless but suggests a misunderstanding of webhook vs browser calls. Remove `webhookCorsHeaders` from the webhook response or leave a comment explaining why it's there.

#### I-7. Analytics event `subscription_renewal_failed` is used for both initial and renewal failures

- **File**: `supabase/functions/payment-webhook/index.ts:484`
- **Current**: `handleSubscriptionPaymentCanceled` always emits `subscription_renewal_failed` regardless of `isInitial`.
- **Recommended**: Use `subscription_initial_failed` vs `subscription_renewal_failed` for cleaner analytics segmentation.

---

## Positive Patterns

1. **API-based webhook verification**: The webhook verifies payment status by calling the YooKassa API (`verifyPaymentWithApi`) rather than trusting the webhook payload alone. This is the correct pattern per YooKassa docs and prevents replay attacks.

2. **Idempotency throughout**: Both `handleSubscriptionPaymentSucceeded` and `handleSubscriptionPaymentCanceled` check whether the payment has already been processed before acting. The `grant_subscription_credits` function uses `INSERT ... ON CONFLICT DO UPDATE` ensuring credits are added atomically. These are solid idempotency implementations.

3. **SECURITY DEFINER + SET search_path = ''**: The `grant_subscription_credits` function correctly uses `SET search_path = ''` on the `SECURITY DEFINER` function, preventing search path injection attacks — a common omission in PostgreSQL functions.

4. **Partial unique index for one-active-per-user**: The DB-level enforcement via `CREATE UNIQUE INDEX ... WHERE status IN ('active', 'past_due', 'pending')` is the right approach — business rules enforced at the data layer, not just application logic.

---

## Security Assessment

| Area | Finding | Severity |
|------|---------|----------|
| Webhook auth | Correct: API verification not HMAC | OK |
| Cron auth | `x-cron-key` header with dedicated secret | OK |
| RLS | Both tables have RLS enabled; users SELECT only; all writes go through service_role | OK |
| JWT verification | Uses `supabase.auth.getUser(jwt)` (server-side validation, not decode-only) | OK |
| CORS | Origin whitelist for user-facing functions; wildcard only on webhook (harmless) | OK |
| Input validation | `VALID_TIERS` and `VALID_BILLING_PERIODS` checked before any DB/API calls | OK |
| SECURITY DEFINER | `SET search_path = ''` present on all new functions | OK |
| Missing cred handling | Webhook returns 200 OK when creds are missing — silent data loss | Medium (Issue #7) |
| Ownership check | `cancel-subscription` verifies `subscription.user_id === userId` | OK |

No critical security vulnerabilities found. The codebase avoids SQL injection (parameterized queries via Supabase client), uses server-side JWT validation, and has proper ownership checks.

---

## Escalation

The following items require senior/product review before production:

- **Issue #1** (price mismatch): Which formula is canonical — frontend or backend? The backend formula (round total) is mathematically cleaner. But any change to frontend display must be cross-checked with marketing copy and pricing documentation.
- **Issue #2** (3DS return URL): Requires creating a new route or deciding on redirect behavior. Product decision needed on UX for 3DS payment flow.
- **Issue #4** (54-FZ empty receipt): Legal compliance question — is sending a receipt without customer contact acceptable in any case, or must the payment be blocked?

---

## Files Reviewed

| File | Verdict | Notes |
|------|---------|-------|
| `supabase/migrations/20260311000001_create_subscriptions_table.sql` | PASS | Schema solid; partial index correct |
| `supabase/migrations/20260311000002_create_subscription_payments_table.sql` | PASS | Good audit columns |
| `supabase/migrations/20260311000003_create_subscription_functions.sql` | PASS | Good SECURITY DEFINER usage; `free` tier dead path |
| `supabase/migrations/20260311000004_alter_subscription_payments_fk_restrict.sql` | PASS | Correct 54-FZ rationale |
| `supabase/migrations/20260311000005_add_payment_type_to_subscription_payments.sql` | WARN | Missing NOT NULL constraint |
| `supabase/migrations/20260311000006_add_subscription_payments_ungranted_index.sql` | WARN | Index predicate too broad |
| `supabase/functions/_shared/subscription-config.ts` | PASS | Clear, concise config |
| `supabase/functions/_shared/cors.ts` | PASS | Minor: wildcard on webhook is harmless |
| `supabase/functions/create-subscription/index.ts` | FAIL | 3DS return URL bug (P0) |
| `supabase/functions/cancel-subscription/index.ts` | WARN | Pending subs can't be cancelled (P1) |
| `supabase/functions/process-recurring-payments/index.ts` | WARN | Step 2/3 overlap; 54-FZ receipt concern |
| `supabase/functions/payment-webhook/index.ts` | WARN | Silent drop on missing creds; wrong analytics event for initial failure |
| `src/types/subscription.ts` | FAIL | `calculateSubscriptionPrice` formula mismatch (P0) |
| `src/services/subscriptionService.ts` | WARN | Hardcoded project URL |
| `src/services/creditService.ts` | PASS | Clear, correct PRO access check |
| `src/components/features/subscription/SubscriptionSelector.tsx` | PASS | Good keyboard/scroll-lock handling |
| `src/components/features/subscription/SubscriptionTierCard.tsx` | PASS | Minor UX clarity gap |
| `src/components/features/subscription/BillingPeriodSelector.tsx` | PASS | Clean |
| `src/components/features/subscription/SubscriptionManagement.tsx` | PASS | Good error/loading states |
| `src/components/features/payment/CreditBalance.tsx` | WARN | Stale after payment (empty deps) |
| `src/pages/Profile/Subscription.tsx` | WARN | No post-payment polling |
| `.github/workflows/cron-recurring-payments.yml` | PASS | Correct CRON_SECRET header auth; Telegram failure alert present |

---

## Validation

- **Type Check**: PASS (`pnpm type-check` — no errors)
- **Build**: PASS (`pnpm build` — clean build, 8.85s)
