# Plan: Fix PaymentResult to show cancellation reasons

## Problem

Our detailed cancellation reason messages (implemented in commit df21207) are **effectively dead code** — they never reach the user.

### Flow Analysis

1. **PaymentWidget.tsx:42-44** — `return_url` hardcoded with `status=success`:
   ```
   /payment/result?status=success&purchase_id=${purchaseId}
   ```
   This URL is only used by the widget on **successful** payments. On failure, the widget shows YooKassa's built-in error and does NOT redirect.

2. **create-payment edge function:164** — return_url for YooKassa API (3D Secure) has NO status:
   ```
   /payment/result?purchase_id=${purchaseId}
   ```

3. **PaymentResult.tsx:52-88** — checks `status` URL param:
   - `status=success` → shows success
   - `status=canceled` → fetches cancellation_reason from DB (**NEVER REACHED**)
   - no status → shows "unknown"

4. **YooWidget `onFail`** (YooWidget.tsx:21) — fires only if YooKassa's built-in error handling is disabled. By default it's enabled, meaning the widget handles failures internally and lets user retry. This is the intended UX — we should NOT disable it.

### Result
- **Inline failure**: Widget shows YooKassa's generic error → user retries or closes widget → goes back to pricing page. PaymentResult never shown.
- **3D Secure failure**: YooKassa redirects to `/payment/result?purchase_id=XXX` (no status) → shows "unknown" instead of specific cancellation reason.
- Our i18n cancellation messages are never displayed.

## Solution

### Step 1: Fix PaymentResult.tsx — auto-detect status from DB when missing

When `purchase_id` is present but `status` is missing, fetch the actual payment status from the `purchases` table.

**File**: `src/pages/PaymentResult.tsx` (lines 51-88)

Replace the `useEffect` logic. New behavior:

```
if (statusParam === 'success') → show success immediately (keep as-is)
if (statusParam === 'canceled') → fetch cancellation_reason from DB (keep as-is)
if (no status) AND purchase_id exists → NEW: fetch purchase from DB:
  - purchases.status = 'succeeded' → show success
  - purchases.status = 'canceled' → show canceled + cancellation_reason
  - purchases.status = 'pending' → show pending state, poll every 3s (max 30s)
```

Key changes in `PaymentResult.tsx`:
- Add `'pending'` to the `PaymentStatus` type (line 8)
- Add `STATUS_CONFIGS.pending` entry (lines 21-37)
- In the `useEffect`, add an `else if (!statusParam && purchaseIdParam)` branch that:
  1. Sets `loading(true)`
  2. Fetches `SELECT status, cancellation_reason FROM purchases WHERE id = purchaseIdParam`
  3. Maps DB status to component status
  4. If `pending` — starts polling interval (3s, max 10 attempts)
- Use `getCancellationI18nKey()` (already imported, line 6) for canceled status

### Step 2: Add i18n keys for pending state

**File**: `src/lib/i18n.ts`

Add 3 translation keys in all 3 languages (en ~line 166, ru ~line 934, zh ~line 1702):

| Key | EN | RU | ZH |
|-----|----|----|-----|
| `payment.result.pending.title` | Processing payment... | Обработка платежа... | 正在处理付款... |
| `payment.result.pending.subtitle` | Please wait, we are verifying your payment | Подождите, мы проверяем ваш платёж | 请稍候，我们正在验证您的付款 |

### Step 3: Update tests

**File**: `src/pages/__tests__/PaymentResult.test.tsx`

Add test cases:
- `purchase_id` without `status` → fetches from DB, shows correct status
- DB returns `canceled` with `fraud_suspected` → shows "Платёж отклонён по соображениям безопасности"
- DB returns `canceled` with `general_decline` → shows "Платёж отклонён вашим банком"
- DB returns `pending` → shows pending state
- DB returns `succeeded` → shows success

## NOT doing (and why)

- **Not switching to `success`/`fail` events in PaymentWidget**: Per [YooKassa docs](https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/additional-settings/behaviour): events only fire when `return_url` is NOT in widget config. Removing `return_url` would require us to handle all redirects manually. Additionally, `fail` for card declines only fires if we disable built-in error handling — which would break the retry UX (users couldn't try a different card inside the widget).
- **Not changing YooKassa widget messages**: Those are YooKassa's built-in strings, we have no control over them.

## What this fixes in practice

- **3D Secure failures**: User redirected to `/payment/result?purchase_id=XXX` (no status) → now auto-detects from DB → shows specific cancellation reason
- **Direct link / bookmark**: If user returns to payment result page later → shows correct status from DB
- **Race condition**: If webhook hasn't processed yet → shows "Processing..." with polling instead of "Unknown error"

## Critical Files

| File | Change |
|------|--------|
| `src/pages/PaymentResult.tsx` | Auto-detect status from DB when URL param missing; add pending state with polling |
| `src/lib/i18n.ts` | Add pending state translations (3 languages, 2 keys each) |
| `src/pages/__tests__/PaymentResult.test.tsx` | Add tests for DB auto-detection and pending state |

## Reuse existing code
- `getCancellationI18nKey()` from `src/constants/payment.ts:39` — already imported in PaymentResult
- `supabase` client from `src/lib/supabaseClient.ts` — already imported in PaymentResult
- `STATUS_CONFIGS` pattern in `PaymentResult.tsx:21-37` — extend with `pending` entry

## Verification

1. `pnpm type-check` — no TypeScript errors
2. `pnpm build` — build succeeds
3. `pnpm test src/pages/__tests__/PaymentResult.test.tsx` — all tests pass
4. Manual test: open `/payment/result?purchase_id=<canceled_purchase_id>` (no status param) → should show cancellation reason from DB
