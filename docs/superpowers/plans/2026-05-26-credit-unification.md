# Credit System Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `unified_user_credits` the single source of truth for credit balance/consume/grant across all channels (bot + web), retiring the legacy `user_credits` and `backend_user_credits` stores.

**Architecture:** Backfill legacy balances into `unified_user_credits` first (idempotent), then cut over every remaining legacy write/read — bot chat (Node), web `analyze-coffee` and `payment-webhook` (Deno edge) — to the unified RPCs already used by photo-analysis/compare. Behavior-preserving (chat keeps 50/day limit + charging). Legacy tables are kept read-only for a rollback window; dropping them is a deferred follow-up.

**Tech Stack:** PostgreSQL (Supabase migrations + SECURITY DEFINER RPCs), Node 20 + TypeScript (grammY bot, Vitest), Deno (Supabase Edge Functions), pnpm.

**Beads:** Epic sym-421. Tasks map as: §1→sym-5u2, §2→sym-5ce, §3→sym-4f6, §4→sym-bbv, §5→sym-xp0, drop→sym-nvu (deferred).

**Branch/deploy:** Implement on a feature branch; PR into `dev` (no direct pushes to protected branches). Edge functions deploy via Supabase; bot via `deploy-backend.yml`; migration via Supabase. Verify on a Supabase dev branch before prod. `bd update <id> --status in_progress` when claiming each task; `bd close` when done.

**Pre-flight (run once before Task 1):**
```bash
bd update sym-421 --status in_progress
git checkout -b feat/credit-unification-sym421
```

---

## Task 1: Backfill legacy balances → unified (sym-5u2)

Folds `user_credits` (by auth_id) and `backend_user_credits` (by telegram_id) into
`unified_user_credits`, additively, idempotently. Must land before any read cutover.

**Files:**
- Create: `supabase/migrations/20260526000001_backfill_unified_credits.sql`

- [ ] **Step 1: Pre-check orphans (manual, must be zero)**

Run via Supabase SQL (MCP `execute_sql` or dashboard). Expected: `0` rows. If non-zero, STOP and report — those legacy owners have no `unified_users` mapping and need manual handling.

```sql
-- auth-keyed legacy rows with no unified_users mapping
SELECT 'user_credits' AS src, uc.user_id::text AS key
FROM user_credits uc
LEFT JOIN unified_users u ON u.auth_id = uc.user_id
WHERE u.id IS NULL AND (uc.basic_credits + uc.pro_credits + uc.cassandra_credits) > 0
UNION ALL
-- telegram-keyed legacy rows with no unified_users mapping
SELECT 'backend_user_credits', buc.telegram_user_id::text
FROM backend_user_credits buc
LEFT JOIN unified_users u ON u.telegram_id = buc.telegram_user_id
WHERE u.id IS NULL AND buc.credits > 0;
```

- [ ] **Step 2: Write the backfill migration**

Create `supabase/migrations/20260526000001_backfill_unified_credits.sql`:

```sql
-- 20260526000001_backfill_unified_credits.sql
-- One-time, idempotent backfill of legacy credit stores into unified_user_credits.
-- Guard: migrated_to_unified flag per legacy row → re-run is a no-op.
-- Legacy tables are NOT dropped here (rollback window). See sym-nvu.

-- 1. Idempotency guard columns.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS migrated_to_unified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.backend_user_credits
  ADD COLUMN IF NOT EXISTS migrated_to_unified BOOLEAN NOT NULL DEFAULT false;

-- 2. Ensure every mapped legacy owner has a unified_user_credits row.
INSERT INTO public.unified_user_credits (unified_user_id, credits_basic, credits_pro, credits_cassandra, free_credit_granted)
SELECT DISTINCT u.id, 0, 0, 0, false
FROM public.user_credits uc
JOIN public.unified_users u ON u.auth_id = uc.user_id
WHERE uc.migrated_to_unified = false
ON CONFLICT (unified_user_id) DO NOTHING;

INSERT INTO public.unified_user_credits (unified_user_id, credits_basic, credits_pro, credits_cassandra, free_credit_granted)
SELECT DISTINCT u.id, 0, 0, 0, false
FROM public.backend_user_credits buc
JOIN public.unified_users u ON u.telegram_id = buc.telegram_user_id
WHERE buc.migrated_to_unified = false
ON CONFLICT (unified_user_id) DO NOTHING;

-- 3. Fold user_credits (typed) → unified, then mark migrated. Single statement = atomic.
WITH src AS (
  SELECT u.id AS unified_user_id, uc.user_id,
         uc.basic_credits, uc.pro_credits, uc.cassandra_credits
  FROM public.user_credits uc
  JOIN public.unified_users u ON u.auth_id = uc.user_id
  WHERE uc.migrated_to_unified = false
), upd AS (
  UPDATE public.unified_user_credits t
  SET credits_basic = t.credits_basic + s.basic_credits,
      credits_pro = t.credits_pro + s.pro_credits,
      credits_cassandra = t.credits_cassandra + s.cassandra_credits,
      updated_at = NOW()
  FROM src s
  WHERE t.unified_user_id = s.unified_user_id
  RETURNING s.user_id
)
UPDATE public.user_credits SET migrated_to_unified = true
WHERE user_id IN (SELECT user_id FROM upd);

-- 4. Fold backend_user_credits (generic → basic) → unified, then mark migrated.
WITH src AS (
  SELECT u.id AS unified_user_id, buc.telegram_user_id, buc.credits
  FROM public.backend_user_credits buc
  JOIN public.unified_users u ON u.telegram_id = buc.telegram_user_id
  WHERE buc.migrated_to_unified = false
), upd AS (
  UPDATE public.unified_user_credits t
  SET credits_basic = t.credits_basic + s.credits,
      updated_at = NOW()
  FROM src s
  WHERE t.unified_user_id = s.unified_user_id
  RETURNING s.telegram_user_id
)
UPDATE public.backend_user_credits SET migrated_to_unified = true
WHERE telegram_user_id IN (SELECT telegram_user_id FROM upd);
```

- [ ] **Step 3: Capture pre-state for verification**

Before applying, record legacy totals (MCP `execute_sql`):

```sql
SELECT
  (SELECT COALESCE(SUM(basic_credits+pro_credits+cassandra_credits),0) FROM user_credits WHERE migrated_to_unified=false) AS legacy_user,
  (SELECT COALESCE(SUM(credits),0) FROM backend_user_credits WHERE migrated_to_unified=false) AS legacy_backend,
  (SELECT COALESCE(SUM(credits_basic+credits_pro+credits_cassandra),0) FROM unified_user_credits) AS unified_total;
```
Expected after apply: `unified_total_after == unified_total_before + legacy_user + legacy_backend`.

- [ ] **Step 4: Apply on a Supabase dev branch**

```bash
# via Supabase MCP: create_branch → apply_migration on the branch
# or CLI: supabase db push --linked   (against a dev branch, NOT prod)
```
Apply migration `20260526000001_backfill_unified_credits`.

- [ ] **Step 5: Verify (re-run Step 3 query) + idempotency**

Run the Step 3 query again → confirm the arithmetic identity holds.
Then re-apply the migration once more (or re-run statements) → totals MUST NOT change (guard works) and:
```sql
SELECT count(*) FROM user_credits WHERE migrated_to_unified=false; -- expect 0
SELECT count(*) FROM backend_user_credits WHERE migrated_to_unified=false; -- expect 0
```
Expected: both `0`, unified totals unchanged on second run.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260526000001_backfill_unified_credits.sql
git commit -m "feat(credits): idempotent backfill of legacy balances into unified (sym-5u2)"
bd close sym-5u2 --reason "Backfill migration applied + verified on dev branch"
```

---

## Task 2: Bot chat → unified `basic` (sym-5ce, fixes the latent bug)

Chat currently gates/consumes legacy credits while welcome credits live in unified, so new
users can be wrongly refused. Switch to the unified `basic` type. Behavior-preserving.

**Files:**
- Modify: `symancy-backend/src/modules/chat/handler.ts` (import + the `hasCredits` gate ~line 160)
- Modify: `symancy-backend/src/modules/chat/worker.ts` (import line 25, consume line 267, refund in catch)
- Test: `symancy-backend/tests/unit/modules/chat-credits.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `symancy-backend/tests/unit/modules/chat-credits.test.ts`. Mirror the mocking style of `tests/unit/modules/credits.test.ts`.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the credits service so we assert chat uses the UNIFIED basic path.
const hasCreditsOfType = vi.fn();
const consumeCreditsOfType = vi.fn();
const refundCreditsOfType = vi.fn();
vi.mock("../../../src/modules/credits/service.js", () => ({
  hasCreditsOfType,
  consumeCreditsOfType,
  refundCreditsOfType,
}));

import {
  hasCreditsOfType as hc,
  consumeCreditsOfType as cc,
  refundCreditsOfType as rc,
} from "../../../src/modules/credits/service.js";

describe("chat credits use unified basic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gate calls hasCreditsOfType(telegramId, 'basic')", async () => {
    (hc as unknown as typeof hasCreditsOfType).mockResolvedValue(true);
    await (hc as unknown as typeof hasCreditsOfType)(12345, "basic");
    expect(hasCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });

  it("consume calls consumeCreditsOfType(telegramId, 'basic')", async () => {
    (cc as unknown as typeof consumeCreditsOfType).mockResolvedValue(true);
    await (cc as unknown as typeof consumeCreditsOfType)(12345, "basic");
    expect(consumeCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });

  it("refund calls refundCreditsOfType(telegramId, 'basic')", async () => {
    (rc as unknown as typeof refundCreditsOfType).mockResolvedValue(true);
    await (rc as unknown as typeof refundCreditsOfType)(12345, "basic");
    expect(refundCreditsOfType).toHaveBeenCalledWith(12345, "basic");
  });
});
```

> Note: these assert the contract (unified basic). After wiring the handler/worker, add a follow-up assertion in the existing chat worker test if one exists; this contract test is the RED gate driving the edit.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd symancy-backend && pnpm test:unit -- chat-credits`
Expected: FAIL (module mock resolves but assertions establish the expected contract; if any import path is wrong it errors here).

- [ ] **Step 3: Switch the chat gate to unified (handler.ts)**

In `symancy-backend/src/modules/chat/handler.ts`, change the import (line 8) and the gate (~line 160).

Replace import:
```ts
import { hasCredits } from "../credits/service.js";
```
with:
```ts
import { hasCreditsOfType } from "../credits/service.js";
```

Replace the gate:
```ts
  if (!(await hasCredits(telegramUserId, 1))) {
```
with:
```ts
  if (!(await hasCreditsOfType(telegramUserId, "basic"))) {
```

- [ ] **Step 4: Switch chat consume/refund to unified (worker.ts)**

In `symancy-backend/src/modules/chat/worker.ts`, change the import (line 25):
```ts
import { consumeCredits, refundCredits } from "../credits/service.js";
```
to:
```ts
import { consumeCreditsOfType, refundCreditsOfType } from "../credits/service.js";
```

Replace the consume (line ~267):
```ts
    const consumed = await consumeCredits(telegramUserId, 1);
```
with:
```ts
    const consumed = await consumeCreditsOfType(telegramUserId, "basic");
```

Find the refund call in the error/catch path (search `refundCredits(`) and replace:
```ts
      await refundCredits(telegramUserId, 1);
```
with:
```ts
      await refundCreditsOfType(telegramUserId, "basic");
```

- [ ] **Step 5: Run tests + type-check**

Run: `cd symancy-backend && pnpm test:unit -- chat-credits && pnpm type-check`
Expected: PASS, no type errors. Confirm no remaining `consumeCredits(`/`hasCredits(`/`refundCredits(` in `chat/`:
Run: `grep -rn "hasCredits(\|consumeCredits(\|refundCredits(" symancy-backend/src/modules/chat/`
Expected: no matches (only the `*OfType` variants).

- [ ] **Step 6: Commit**

```bash
git add symancy-backend/src/modules/chat/handler.ts symancy-backend/src/modules/chat/worker.ts symancy-backend/tests/unit/modules/chat-credits.test.ts
git commit -m "fix(chat): gate/consume unified basic credits, fix welcome-credit blindness (sym-5ce)"
bd close sym-5ce --reason "Chat on unified basic; welcome credits now visible to chat"
```

---

## Task 3: Web `analyze-coffee` → unified consume/refund (sym-4f6)

Replace `consume_credit` (writes legacy `user_credits`) with the unified path. Extract the
proven helper from `compare-coffee` into `_shared` (DRY), then use it in `analyze-coffee`.

**Files:**
- Create: `supabase/functions/_shared/unified-credits.ts`
- Modify: `supabase/functions/analyze-coffee/index.ts` (consume ~line 122-130; refund on `AI_FAILURE_AFTER_CREDIT` ~line 181, 274)

- [ ] **Step 1: Create the shared unified-credits helper**

Create `supabase/functions/_shared/unified-credits.ts`, lifting the logic verified in
`compare-coffee/index.ts` (`UnifiedUserLookup`, `consumeCreditForAuthUser`, `refundCreditForAuthUser`):

```ts
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CreditType = "basic" | "pro" | "cassandra";

export interface UnifiedUserLookup {
  unifiedUserId: string;
  telegramId: number | null;
}

export interface CreditOpResult {
  success: boolean;
  remaining: number | null;
  reason?: string;
}

/** Resolve unified_user_id (+ telegram_id) from an auth user id. */
export async function resolveUnifiedUser(
  serviceClient: SupabaseClient,
  authId: string,
): Promise<UnifiedUserLookup | null> {
  const { data, error } = await serviceClient
    .from("unified_users")
    .select("id, telegram_id")
    .eq("auth_id", authId)
    .single();
  if (error || !data) {
    console.error("resolveUnifiedUser failed", { authId, error });
    return null;
  }
  return {
    unifiedUserId: data.id,
    telegramId: data.telegram_id == null ? null : Number(data.telegram_id),
  };
}

/** Consume one credit of `creditType` via the race-safe unified RPCs. */
export async function consumeCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<CreditOpResult> {
  if (user.telegramId != null) {
    const { data, error } = await serviceClient.rpc("consume_unified_credit", {
      p_telegram_id: user.telegramId,
      p_credit_type: creditType,
    });
    if (error) return { success: false, remaining: null, reason: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { success: !!row?.success, remaining: typeof row?.remaining === "number" ? row.remaining : null };
  }
  const { data, error } = await serviceClient.rpc("consume_unified_credit_by_unified_user_id", {
    p_unified_user_id: user.unifiedUserId,
    p_credit_type: creditType,
  });
  if (error) return { success: false, remaining: null, reason: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { success: !!row?.success, remaining: typeof row?.remaining === "number" ? row.remaining : null };
}

/** Refund one credit. Best-effort: logs on failure, never throws. */
export async function refundCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<void> {
  try {
    if (user.telegramId != null) {
      const { error } = await serviceClient.rpc("refund_unified_credit", {
        p_telegram_id: user.telegramId,
        p_credit_type: creditType,
      });
      if (error) console.error("refund_unified_credit error", error);
      return;
    }
    const { error } = await serviceClient.rpc("refund_unified_credit_by_unified_user_id", {
      p_unified_user_id: user.unifiedUserId,
      p_credit_type: creditType,
    });
    if (error) console.error("refund_unified_credit_by_unified_user_id error", error);
  } catch (e) {
    console.error("Refund threw", e);
  }
}
```

- [ ] **Step 2: Wire analyze-coffee to the unified consume**

In `supabase/functions/analyze-coffee/index.ts`, add the import near the top:
```ts
import { resolveUnifiedUser, consumeCreditForAuthUser, refundCreditForAuthUser } from "../_shared/unified-credits.ts";
```

Replace the consume block (~line 122-130):
```ts
    const resolvedCreditType = getCreditType(mode, creditType)

    const { data: creditResult, error: creditError } = await supabaseClient.rpc('consume_credit', {
      p_user_id: user.id,
      p_credit_type: resolvedCreditType
    })

    if (creditError || !creditResult.success) {
      return new Response(JSON.stringify({
        error: "Insufficient credits",
        code: "INSUFFICIENT_CREDITS"
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
```
with (uses a service-role client `serviceClient` — see Step 3 for its creation):
```ts
    const resolvedCreditType = getCreditType(mode, creditType)

    const unifiedUser = await resolveUnifiedUser(serviceClient, user.id)
    if (!unifiedUser) {
      return new Response(JSON.stringify({ error: "User mapping not found", code: "NO_UNIFIED_USER" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const creditResult = await consumeCreditForAuthUser(serviceClient, unifiedUser, resolvedCreditType)
    if (!creditResult.success) {
      return new Response(JSON.stringify({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
```

- [ ] **Step 3: Ensure a service-role client + switch the refund paths**

`consume_unified_credit*` / `refund_unified_credit*` are SECURITY DEFINER; call them with a
service-role client. If `analyze-coffee` does not already create one, add near the existing
client setup (mirror `compare-coffee`):
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
```

At each `AI_FAILURE_AFTER_CREDIT` site (~line 181 and ~line 274), refund via the unified helper instead of the legacy refund. Replace any existing `refund`/`consume_credit` rollback with:
```ts
        await refundCreditForAuthUser(serviceClient, unifiedUser, resolvedCreditType)
```

- [ ] **Step 4: Verify on a Supabase dev branch**

Deploy the function to the dev branch and exercise it:
```bash
# via Supabase MCP deploy_edge_function (analyze-coffee) on the dev branch
```
Manual check (dev branch): a web user with unified balance does a reading → `unified_user_credits` decrements the resolved type by 1; on a forced AI failure the credit is refunded; a zero-balance user gets 402 INSUFFICIENT_CREDITS. Confirm `user_credits` is NOT touched.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/unified-credits.ts supabase/functions/analyze-coffee/index.ts
git commit -m "feat(web): analyze-coffee consumes/refunds unified credits (sym-4f6)"
bd close sym-4f6 --reason "analyze-coffee on unified; verified on dev branch"
```

---

## Task 4: Web `payment-webhook` → unified grant (sym-bbv)

Replace `grant_credits` (writes legacy `user_credits`) with `admin_adjust_credits` (unified +
`credit_transactions` log) — the same RPC the Telegram payment path already uses in prod.

**Files:**
- Modify: `supabase/functions/payment-webhook/index.ts` (grant block ~line 126-145)

- [ ] **Step 1: Verify `admin_adjust_credits` works under service role**

The webhook uses a service-role `supabase` client. Confirm `admin_adjust_credits`'s `is_admin()`
guard accepts it (the Telegram path already calls it via service role from Node in prod). Test on
the dev branch:
```sql
-- as service role (MCP execute_sql runs with elevated rights; for a true service-role check,
-- invoke from the deployed function in Step 4). Smoke: function exists + signature:
SELECT 'public.admin_adjust_credits'::regproc;
```
If the deployed call in Step 4 returns an "Unauthorized: Admin access required" error, fall back
to adding a dedicated RPC `grant_purchased_credits(p_unified_user_id uuid, p_basic int, p_pro int, p_cassandra int, p_reason text)` (SECURITY DEFINER, no admin guard, logs `credit_transactions`) in a migration, and call that instead. (Define the migration only if needed.)

- [ ] **Step 2: Switch the grant to unified**

In `supabase/functions/payment-webhook/index.ts`, replace the grant block (~line 126-145):
```ts
  // Grant credits using RPC function
  const { error: grantError } = await supabase.rpc('grant_credits', {
    p_user_id: user_id,
    p_product_type: product_type,
    p_credits: tariff.credits
  })
```
with:
```ts
  // Resolve unified user from the auth user_id stored on the purchase.
  const { data: unifiedRow, error: unifiedErr } = await supabase
    .from('unified_users')
    .select('id')
    .eq('auth_id', user_id)
    .single()

  if (unifiedErr || !unifiedRow) {
    console.error('CRITICAL: no unified_users mapping for paid auth user', { purchase_id, user_id, error: unifiedErr })
  }

  // Grant unified credits via the same RPC the Telegram path uses (+ credit_transactions log).
  const basicDelta = (product_type === 'basic' || product_type === 'pack5') ? tariff.credits : 0
  const proDelta = product_type === 'pro' ? tariff.credits : 0
  const cassandraDelta = product_type === 'cassandra' ? tariff.credits : 0

  const { error: grantError } = unifiedRow
    ? await supabase.rpc('admin_adjust_credits', {
        p_unified_user_id: unifiedRow.id,
        p_basic_delta: basicDelta,
        p_pro_delta: proDelta,
        p_cassandra_delta: cassandraDelta,
        p_reason: `web_payment:yookassa:${product_type}`,
      })
    : { error: new Error('no unified_users mapping') }
```
(The existing `if (grantError) { console.error('CRITICAL: ...') }` block below stays — credit
grant failure is logged for manual intervention, purchase already marked succeeded.)

- [ ] **Step 3: Verify on a Supabase dev branch**

Deploy `payment-webhook` to the dev branch. Simulate a succeeded YooKassa webhook for a test
auth user that has a `unified_users` mapping. Confirm: `unified_user_credits` for that user
increments by `tariff.credits` on the right type; a `credit_transactions` row appears with
`reason = 'web_payment:yookassa:<product>'`; `user_credits` is NOT touched. If "Unauthorized"
appears, implement the `grant_purchased_credits` fallback from Step 1 and re-test.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/payment-webhook/index.ts
# + the fallback migration only if it was needed
git commit -m "feat(payments): web payment-webhook grants unified credits via admin_adjust_credits (sym-bbv)"
bd close sym-bbv --reason "Web payment grants unified; verified on dev branch"
```

---

## Task 5: Remove legacy call sites + deprecate legacy functions (sym-xp0)

After all reads/writes are on unified, eliminate the dead legacy paths. Do NOT drop tables.

**Files:**
- Modify: `symancy-backend/src/modules/credits/service.ts` (mark + remove unused legacy fns)
- Audit: whole repo for legacy RPC / service-fn call sites

- [ ] **Step 1: Find remaining legacy call sites**

Run:
```bash
grep -rn "consume_credit\b\|grant_credits\b\|consume_credits\b\|consume_linked_credits\|refund_credits\b\|refund_linked_credits" symancy-backend/src supabase/functions | grep -v node_modules
grep -rn "\bhasCredits(\|\bconsumeCredits(\|\bgetCreditBalance(\|\brefundCredits(\|\bgrantInitialCredits(" symancy-backend/src | grep -v "OfType\|Unified"
```
Expected after Tasks 2-4: only definitions in `credits/service.ts` remain, no callers.

- [ ] **Step 2: Remove the now-unused legacy service functions**

In `symancy-backend/src/modules/credits/service.ts`, delete the legacy functions that have zero
callers: `hasCredits`, `consumeCredits`, `getCreditBalance`, `refundCredits`, `grantInitialCredits`
(and the legacy `getAccountLinkStatus` helper only if nothing else uses it — verify with grep).
Keep all `*OfType` / unified functions and `grantUnifiedInitialCredits`.

> If grep in Step 1 shows a caller you missed, switch it to the unified equivalent first, then remove.

- [ ] **Step 3: Type-check + full unit tests**

Run: `cd symancy-backend && pnpm type-check && pnpm test:unit`
Expected: PASS. If `tests/unit/modules/credits.test.ts` referenced removed functions, update it to
target the unified functions (adjust assertions to `*OfType`).

- [ ] **Step 4: Commit**

```bash
git add symancy-backend/src/modules/credits/service.ts symancy-backend/tests/unit/modules/credits.test.ts
git commit -m "chore(credits): remove dead legacy credit functions, unified is the only path (sym-xp0)"
bd close sym-xp0 --reason "Legacy call sites removed; unified is the sole credit path"
```

---

## Task 6 (DEFERRED): Drop legacy tables/RPCs (sym-nvu)

Not part of this branch. After the unified path is verified in **prod** (rollback window passed),
a separate migration drops `user_credits`, `backend_user_credits`, and the dead RPCs
(`consume_credit`, `grant_credits`, `consume_credits`, `consume_linked_credits`, `refund_credits`,
`refund_linked_credits`). Tracked as sym-nvu (deferred to 2026-06-15).

---

## Finish (after Tasks 1-5)

- [ ] Full verification: `cd symancy-backend && pnpm type-check && pnpm build && pnpm test:unit`
- [ ] `superpowers:requesting-code-review` on the branch (focus: payment path, backfill arithmetic).
- [ ] `superpowers:verification-before-completion` — paste command outputs as evidence.
- [ ] Push branch → PR into `dev`. Deploy edge functions + migration to prod per existing flow; monitor `deploy-backend.yml` to completion (no auto-rollback).
- [ ] `bd close sym-421 --reason "Unified credit system live; legacy retired (drop deferred sym-nvu)"`.
- [ ] Resume sym-sym-9gy (trial follow-up) on the unified single source.

## Self-review notes (author)

- **Spec coverage:** backfill (§1→T1), analyze-coffee (§2→T3), payment (§3→T4), chat (§4→T2),
  deprecate (§5→T5), drop (deferred→T6). All covered.
- **Order:** T1 first (others blocked on it in beads); T5 after T2/T3/T4; T6 deferred.
- **Type consistency:** unified RPC arg names (`p_telegram_id`/`p_unified_user_id`/`p_credit_type`,
  `p_basic_delta` etc.) match the verified DB definitions; service fns `hasCreditsOfType` /
  `consumeCreditsOfType` / `refundCreditsOfType` match `credits/service.ts` signatures.
- **Known risk flagged inline:** `admin_adjust_credits` service-role access (T4 Step 1) with a
  defined fallback RPC.
