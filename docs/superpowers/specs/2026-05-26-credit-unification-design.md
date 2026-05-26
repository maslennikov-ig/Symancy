# Credit System Unification — Design Spec (sym-421)

**Date:** 2026-05-26
**Epic:** sym-421 (discovered-from sym-sym-9gy, BETA Retention sym-sym-p4i)
**Status:** Design approved → planning
**Blocks resumption of:** sym-sym-9gy (trial follow-up needs a single balance source of truth)
**Fixes:** sym-5ce (chat reads legacy while welcome credits are unified)

## Problem

An incomplete migration left **three** credit stores in production. The same user can
hold credits in more than one, and the same product action drains different stores
depending on channel. This causes a latent bug (welcome credits invisible to chat) and
makes a correct trial→paid funnel impossible.

| Store | Key | Typed? | Written by |
|---|---|---|---|
| `unified_user_credits` ✅ **target** | `unified_user_id` | basic/pro/cassandra | bot photo/compare/retopic, welcome grant, web compare |
| `user_credits` (legacy) | `auth.users.id` | basic/pro/cassandra | web `analyze-coffee` (`consume_credit`), web payment (`grant_credits`), bot chat (linked, `consume_linked_credits`) |
| `backend_user_credits` (legacy) | `telegram_user_id` | single generic `credits` | bot chat (unlinked, `consume_credits`) |

`unified_users` already maps both `auth_id` (web) and `telegram_id` (Telegram) to a single
`unified_user_id`. Data is tiny (≤14 legacy rows total, BETA) — the ideal window for a clean
backfill before launch scales it.

Note: the *mechanics* of unification are NOT blocked by the tariff-model decision (sym-vgc) —
that gates pricing numbers, not which table stores credits.

## Goal

`unified_user_credits` becomes the **single source of truth** for balance / consume / grant
across all channels. Legacy stores stop being written; they are kept read-only for a rollback
window and dropped in a separate follow-up task after verification.

**Behavior-preserving:** chat keeps its 50/day free limit and current charging model. Redesign
of chat monetization (message packs) is tracked separately in sym-922 (blocked by sym-vgc) and
is explicitly OUT of scope here — do not conflate a refactor with a product change.

## Existing building blocks (reuse, do not rebuild)

- `consume_unified_credit(p_telegram_id, p_credit_type)` → unified, by telegram_id.
- `consume_unified_credit_by_unified_user_id(p_unified_user_id, p_credit_type)` → unified, by
  unified id. Already used by web `compare-coffee` — the reference pattern for web.
- `refund_unified_credit(p_telegram_id, p_credit_type)` + (by-unified-id variant if present).
- `has_unified_credit(p_telegram_id, p_credit_type)` → unified gate.
- `admin_adjust_credits(p_unified_user_id, p_basic_delta, p_pro_delta, p_cassandra_delta,
  p_reason)` → unified grant + logs `credit_transactions`. Already used by the Telegram payment
  path in prod.
- Backend service wrappers (unified): `hasCreditsOfType`, `consumeCreditsOfType`,
  `refundCreditsOfType` in `symancy-backend/src/modules/credits/service.ts`.

## Components

### 1. Backfill migration (one-time, idempotent)

A single migration that folds legacy balances into `unified_user_credits`, additively, mapped
through `unified_users`:

- from `user_credits` (join `unified_users.auth_id = user_credits.user_id`):
  `basic_credits → credits_basic`, `pro_credits → credits_pro`,
  `cassandra_credits → credits_cassandra`.
- from `backend_user_credits` (join `unified_users.telegram_id = backend_user_credits.telegram_user_id`):
  `credits → credits_basic`.

A linked user with both an `auth_id` and a `telegram_id` resolves to one `unified_user_id` and
receives the **sum** of both legacy contributions.

- **Idempotency guard:** a per-source migration marker (e.g. boolean columns
  `migrated_to_unified` on each legacy row, or a `credit_backfill_log` table) so a re-run is a
  no-op. Chosen mechanism: add `migrated_to_unified BOOLEAN DEFAULT false` to each legacy table;
  only fold rows where `migrated_to_unified = false`, then set it true in the same statement.
- **Pre-check:** assert every legacy row's owner has a `unified_users` row. Orphans (legacy
  balance with no unified mapping) are logged; the migration creates the missing
  `unified_user_credits` row via the existing mapping if a `unified_users` row exists, otherwise
  reports them for manual handling (must be zero on the tiny BETA dataset — verify before apply).

### 2. Web `analyze-coffee` edge function → unified

Replace `consume_credit(p_user_id, p_credit_type)` (writes `user_credits`) with the unified path,
mirroring `compare-coffee`:

- Resolve `unified_user_id` from the authenticated `user.id` (`unified_users.auth_id`).
- `consume_unified_credit_by_unified_user_id(unified_user_id, resolvedCreditType)`.
- On AI failure after consumption (`AI_FAILURE_AFTER_CREDIT`): refund via the unified refund RPC
  (by-unified-id variant), matching the compare-coffee error path.
- `getCreditType(mode, creditType)` resolution (basic / pro / cassandra; esoteric→cassandra) is
  unchanged — tier selection is preserved.

### 3. Web payment `payment-webhook` edge function → unified

Replace `grant_credits(p_user_id, p_product_type, p_credits)` (writes `user_credits`) with the
same grant RPC the Telegram path already uses:

- Resolve `unified_user_id` from `purchase.user_id` (auth_id) via `unified_users`.
- `admin_adjust_credits(unified_user_id, basicDelta, proDelta, cassandraDelta, reason)` with
  `reason = 'web_payment:yookassa:<product_type>'` and deltas derived from product_type
  (basic/pack5→basic, pro→pro, cassandra→cassandra), mirroring the Telegram handler.
- **Verify in plan:** `admin_adjust_credits` succeeds under the edge function's service-role
  context (its `is_admin()` guard). The Telegram path already calls it via a service-role client
  in prod, so this is expected to work; confirm explicitly before deploy. If the guard rejects
  service role, add a dedicated SECURITY DEFINER `grant_purchased_credits(unified_user_id, …)`
  RPC instead (same effect + `credit_transactions` log).

### 4. Backend chat → unified (fixes sym-5ce)

In `symancy-backend/src/modules/chat/`:

- `handler.ts`: `hasCredits(telegramUserId, 1)` → `hasCreditsOfType(telegramUserId, "basic")`.
- `worker.ts`: `consumeCredits(telegramUserId, 1)` → `consumeCreditsOfType(telegramUserId, "basic")`;
  `refundCredits(telegramUserId, 1)` → `refundCreditsOfType(telegramUserId, "basic")`.
- `checkDailyLimit` / `DAILY_CHAT_LIMIT = 50` unchanged. Behavior-preserving.

### 5. Deprecate legacy

- Remove all remaining call sites of `consume_credit`, `grant_credits`, `consume_credits`,
  `consume_linked_credits`, `refund_credits`, `refund_linked_credits`.
- Mark the legacy service functions in `credits/service.ts` (`consumeCredits`, `hasCredits`,
  `getCreditBalance`, `refundCredits`, `grantInitialCredits`) `@deprecated`; remove once no
  callers remain (verify via grep + type-check).
- **Do NOT drop legacy tables/RPCs in this epic.** Keep them as a rollback window. A separate
  follow-up task drops `user_credits`, `backend_user_credits`, and the dead RPCs after the
  unified path is verified in prod.

## Risks & mitigation

- **Payment path (highest stakes):** route both Telegram and web payments through the single
  `admin_adjust_credits` RPC; verify service-role access; never block credit grant on a logging
  failure (existing pattern).
- **Edge functions (separate Deno deploy):** mirror the already-working `compare-coffee` unified
  pattern; deploy via Supabase; verify in staging before prod.
- **Backfill correctness:** idempotent guard + tiny dataset + legacy tables retained for rollback.

## Testing (TDD)

- **Chat (Node units):** consumes `basic` from unified on send; refunds `basic` on generation
  failure; 50/day limit still gates first; insufficient-balance path unchanged.
- **RPC (SQL tests on a seeded fixture):** `consume_unified_credit_by_unified_user_id` decrements
  the right type and refuses at zero; `admin_adjust_credits` adds deltas + writes
  `credit_transactions`.
- **Backfill (SQL test on fixture):** auth-only, telegram-only, and linked (auth+telegram) users;
  additivity; second run is a no-op (guard); orphan detection.
- **Edge functions:** integration check that analyze-coffee consumes/refunds unified and
  payment-webhook grants unified.

## Decomposition (sub-tasks under sym-421)

1. Backfill migration + idempotency guard + pre-check (DB).
2. Chat → unified basic (Node) — closes sym-5ce.
3. `analyze-coffee` → unified consume/refund (edge).
4. `payment-webhook` → unified grant via `admin_adjust_credits` (edge) + service-role verify.
5. Remove legacy call sites + deprecate legacy service functions (Node).
6. Follow-up (separate, deferred): drop legacy tables/RPCs after prod verification.

## Open questions

None blocking. (`admin_adjust_credits` service-role access is the one item to confirm during
implementation; fallback RPC defined above.)

## After this epic

Resume sym-sym-9gy (trial follow-up) on the unified single source. Correction for that spec:
the purchase-audit table is `credit_transactions` (not `backend_credit_transactions`); with a
single unified store, "ever purchased" = a `credit_transactions` row with a purchase-type
`reason` (`telegram_payment:%` / `web_payment:%`).
