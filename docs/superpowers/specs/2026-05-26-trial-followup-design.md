# Trial Follow-up — Design Spec (sym-sym-9gy)

**Date:** 2026-05-26
**Epic:** BETA — Retention и монетизация (sym-sym-p4i)
**Status:** Design approved → planning

## Problem

New users receive a one-time `WELCOME_GIFT` (3 basic + 1 pro credits, granted once via
`unified_user_credits.free_credit_granted`). There is **no time-based "7-day PRO trial"** in
code — the model is credit-based. When these welcome credits run out, there is no proactive
follow-up nudging the user to buy. We only show **reactive** "insufficient credits" messages
at the point of action (chat, compare, photo-analysis).

Goal: close the monetization funnel for the trial cohort with a proactive follow-up + clear
buy CTA, and measure trial→paid conversion.

## Scope (from sym-sym-9gy notes)

1. Low-balance / trial-ended notification (proactive).
2. "Buy credits" CTA (Telegram inline button + web banner).
3. trial→paid conversion metric.

Out of scope: changing the credit/tariff model (blocked: sym-vgc), new payment methods.

## Key facts grounding the design

- **Trial = welcome credits.** "Trial ended" = welcome credits exhausted. Two stages:
  - `low`  → total welcome balance crosses to **1**.
  - `zero` → total welcome balance crosses to **0**.
- **Purchase flow already exists** (reuse, do not rebuild): `payments` module with
  `pay:yookassa:<tariff>` / `pay:stars:<tariff>` callbacks + "🎁 Купить" WebApp button
  (`WEBAPP_URL/pricing`).
- **Source of truth for "ever purchased": `credit_transactions`** — the audit log of
  all credit grants across channels. A purchase = a row with a purchase-type `reason`
  (`yookassa:%` / `stars:%`), distinct from the welcome-grant reason. This is reliable for
  **Telegram-only** users (who have no `purchases` row — credits granted via
  `admin_adjust_credits`) as well as linked users.
- **Proactive infra exists** (`engagement` module): scheduler (pg-boss cron) → trigger
  (finder + message generator) → `ProactiveMessageService` (`sendEngagementMessage` /
  `sendBatchEngagementMessages`) → dedup via `engagement_log`. Reference: `streak-at-risk`.
- **Send path** currently passes only `{ parse_mode: "HTML" }` to `deliverToTelegram`. Needs a
  small, clean extension to carry an optional `replyMarkup` (inline keyboard) through to
  `bot.api.sendMessage`.

## Architecture — Event-driven (approach A)

The nudge fires at the exact moment the welcome balance crosses a threshold, immediately after
the reading that drained it (peak engagement). Daily-scheduler (approach B) was rejected: up to
24h delay degrades timing and therefore conversion.

### Data flow

```
consumeCredits (hot path)
  └─ after deduction: compute new total welcome balance
     └─ detect threshold crossing (→1 = low, →0 = zero)
        └─ if free_credit_granted = true AND never purchased
           └─ boss.send(QUEUE_TRIAL_NUDGE, { unifiedUserId, telegramId, stage, languageCode, displayName })
                                            (enqueue only — no engagement logic in hot path)

trial-nudge worker (engagement/worker.ts)
  └─ dedup: engagement_log has no prior row for (telegram_id, message_type=trial-<stage>)
     └─ eligibility re-check: notification_settings enabled, not banned, still no purchase
        └─ generate message (trial-nudge.ts) — localized + AI(ru) + fallback
           └─ ProactiveMessageService.sendEngagementMessage(user, "trial-<stage>", content, { replyMarkup: buyKeyboard })
              └─ log to engagement_log
```

## Components

### 1. Database (single migration)

- **VIEW `trial_conversion_funnel`** (for admin analytics): cohort funnel
  `granted` (free_credit_granted=true) → `exhausted` (welcome balance reached 0) →
  `purchased` (has purchase-type row in `credit_transactions`). Computed from source
  of truth — no event counters to drift.
- No schema change for dedup: `engagement_log.message_type` is free text; new values
  `trial-low`, `trial-zero`.

### 2. Backend — event-driven nudge

- **`consumeCredits`** (`credits/service.ts`): after successful deduction, compute new total
  welcome balance and detect crossing to 1 (`low`) or 0 (`zero`). Eligibility:
  `free_credit_granted = true` AND no purchase-type row in `credit_transactions`.
  On match: `boss.send(QUEUE_TRIAL_NUDGE, …)`. Enqueue only; no message logic in hot path.
  Enqueue failures are swallowed/logged (never break the consume path).
- **`core/queue.ts`**: add `QUEUE_TRIAL_NUDGE` to `queuesToCreate` — **mandatory** (missing
  queue registration crashes the worker on startup; prior ~1h outage cause).
  Add `sendTrialNudgeJob(data)` helper with a Zod schema, mirroring existing senders.
- **`engagement/triggers/trial-nudge.ts`** (new): `createTrialNudgeMessage(stage, name, lang)`
  — localized fallback for ru/en/zh + AI variant for ru only (cost), mirroring
  `streak-at-risk.ts`. Two tones: `low` = gentle warm-up; `zero` = clear buy offer.
- **`engagement/worker.ts`**: register `QUEUE_TRIAL_NUDGE` handler — dedup check, eligibility
  re-check, generate, send with inline "🎁 Купить" keyboard (reuse payments keyboard helper),
  log.
- **`ProactiveMessageService.sendEngagementMessage`** + **`DeliveryService.deliverToTelegram`**:
  extend options with optional `replyMarkup` threaded to `bot.api.sendMessage`. Add
  `trial-low` / `trial-zero` to the `ProactiveMessageType` union.

### 3. Frontend — web banner

- **`LowCreditBanner.tsx`** (new, mirrors `components/features/home/CompareBanner.tsx`): shown
  to a logged-in **web** user when welcome credits are low/zero and no purchase exists; CTA →
  `/pricing`. i18n ×3 (ru/en/zh in `src/lib/i18n.ts`), light/dark via CSS variables.
- Reuses existing credit-balance state (`CreditBalance`/`CreditBadge`). Lazyweb references
  (paywall / low-balance / upgrade prompts) consulted before markup.

### 4. Metric

- `trial_conversion_funnel` VIEW (from §1) surfaced in the admin panel
  (`src/components/.../admin` analytics).

## Anti-spam / idempotency

- Each stage (`trial-low`, `trial-zero`) fires **at most once per user** — dedup via
  `engagement_log` keyed on `message_type`.
- Respect `notification_settings` (skip if disabled).
- Never nudge users who have already purchased (point-of-action reactive message covers them).
- Event-driven enqueue tolerates concurrent `consumeCredits`; the worker's `engagement_log`
  dedup is the single guard against duplicates.

## Testing (TDD)

- **Threshold detector**: 4→3→2→1 (fires `low` once at 1), →0 (fires `zero` once); already-0
  re-consume does not refire; non-trial (purchased) users excluded.
- **Eligibility filter**: purchased (via `credit_transactions`) excluded;
  `notification_settings` disabled excluded; not-yet-granted excluded.
- **Dedup**: second crossing of same stage produces no second send.
- **Message generators**: AI failure falls back to localized text; ru/en/zh covered.
- **Funnel VIEW**: granted/exhausted/purchased counts correct on a seeded fixture.

## Open questions

None. (Purchase source of truth = `credit_transactions`; keyboard via extended
`replyMarkup` option — both resolved during design.)
