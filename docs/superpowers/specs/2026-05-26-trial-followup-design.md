# Trial Follow-up — Design Spec (sym-sym-9gy)

**Date:** 2026-05-26
**Epic:** BETA — Retention и монетизация (sym-sym-p4i)
**Status:** Design revised A→B (scheduled finder) → planning → implementation

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

## Architecture — Scheduled finder (approach B)

> **Revised from event-driven (approach A) on 2026-05-26.** Approach A enqueued the nudge from
> `consumeCredits` in Node at the moment the balance crossed a threshold. **Fatal flaw:** web
> credit consumption runs through **Supabase Edge functions, bypassing Node entirely** — a Node
> event-hook in `consumeCredits` would silently miss every web user. Approach B reads
> `unified_user_credits` (the single source of truth) on a schedule, independent of which channel
> drained the balance, so it catches Telegram *and* web users uniformly. Trade-off: up to ~1h
> latency. Mitigation: **hourly** cadence (same as `insight-dispatcher`), an acceptable balance
> between timing and full-channel coverage. (Daily would add up to 24h delay — rejected.)

This mirrors the proven `streak-at-risk` pattern: hourly cron → finder (reads current balance,
applies eligibility + dedup) → batch send via `ProactiveMessageService`.

### Data flow

```
hourly cron "trial-nudge"  (scheduler.ts)
  └─ worker processTrialNudge (engagement/worker.ts)
     └─ findTrialNudgeUsers()  (engagement/triggers/trial-nudge.ts)
          ├─ query unified_user_credits (free_credit_granted=true) ⨝ unified_users
          │     compute total = basic + pro + cassandra
          │     stage = total===0 ? "zero" : total===1 ? "low" : skip
          ├─ eligibility: is_telegram_linked, not banned, onboarding_completed,
          │     notification_settings.enabled !== false
          ├─ exclude purchased: NO credit_transactions row (transaction_type='purchase')
          └─ dedup (ALL-TIME): engagement_log has no prior row for
                (telegram_id, message_type = "trial-<stage>")   ← at most once per user, ever
     └─ sendBatchEngagementMessages(users, "trial-<stage>", generator,
             { replyMarkup: createTariffPickerKeyboard() })
          └─ per user: deliver + log to engagement_log
```

### Why all-time dedup (differs from streak-at-risk)

`streak-at-risk` dedups **per-day** (`gte sent_at today`) because it's a daily reminder. The trial
nudge must fire **at most once per stage per user, ever** — so the finder checks `engagement_log`
for *any* prior row of that `message_type` (no date filter). A user who jumps 4→0 between hourly
runs (never observed at total=1) receives only `trial-zero`; that's intended.

## Components

### 1. Database (single migration)

- **VIEW `trial_conversion_funnel`** (for admin analytics): single-row cohort funnel computed
  from source of truth (no event counters to drift):
  - `granted` = count(`unified_user_credits.free_credit_granted = true`)
  - `exhausted` = count(granted AND `credits_basic + credits_pro + credits_cassandra = 0`)
  - `purchased` = count(granted AND EXISTS `credit_transactions` row with
    `transaction_type='purchase'` for that `unified_user_id`)
  - `conversion_rate` = `purchased::numeric / NULLIF(granted, 0)`
- No schema change for dedup: `engagement_log.message_type` is free text; new values
  `trial-low`, `trial-zero`. (Verify `engagement_log` columns `telegram_id`, `message_type`,
  `sent_at` exist — used by existing triggers.)

### 2. Backend — scheduled finder

- **`engagement/triggers/trial-nudge.ts`** (new):
  - `findTrialNudgeUsers()` — mirrors `findStreakAtRiskUsers()`. Queries
    `unified_user_credits` (`free_credit_granted = true`) joined to `unified_users`, computes
    `total = credits_basic + credits_pro + credits_cassandra`, derives `stage`
    (`0 → zero`, `1 → low`, else skip). Filters eligibility (telegram-linked, not banned,
    onboarding completed, notifications not disabled), **excludes purchased** (no
    `credit_transactions` row with `transaction_type='purchase'` for that `unified_user_id`),
    and **excludes all-time-deduped** (`engagement_log` already has `trial-<stage>` for that
    `telegram_id`). Returns `{ user, stage }[]`.
  - `createTrialNudgeMessage(stage, name, lang)` — localized fallback for ru/en/zh + AI variant
    for ru only (cost), mirroring `streak-at-risk.ts`. Two tones: `low` = gentle "running low"
    warm-up; `zero` = clear "welcome credits used up — buy to continue" offer.
- **`core/queue.ts`**: add `QUEUE_TRIAL_NUDGE` constant **and append it to `queuesToCreate`** —
  **mandatory** (missing queue registration crashes the worker on startup; prior ~1h outage cause).
- **`engagement/scheduler.ts`**: add `"trial-nudge"` to `SCHEDULES` with hourly cron
  (`"0 * * * *"`, tz UTC — same cadence as `insight-dispatcher`).
- **`engagement/worker.ts`**: add `processTrialNudge(job)` (mirrors `processStreakAtRisk`) and
  register it in `registerEngagementWorkers()`. Calls `findTrialNudgeUsers()`, then for each
  stage group `sendBatchEngagementMessages(users, "trial-<stage>", generator, { replyMarkup })`
  where `replyMarkup = createTariffPickerKeyboard()` (reuse payments keyboard — global `buy:*`
  callback handler already wired).
- **`ProactiveMessageService.sendEngagementMessage` / `sendBatchEngagementMessages`** +
  **`DeliveryService.deliverToTelegram`**: thread an optional `replyMarkup` (grammY
  `InlineKeyboardMarkup`) through `TelegramSendOptions` to `bot.api.sendMessage`. Add
  `trial-low` / `trial-zero` to the `ProactiveMessageType` union.

### 3. Frontend — web banner

- **`LowCreditBanner.tsx`** (new, mirrors `components/features/home/CompareBanner.tsx`): shown
  on the Home dashboard when the total credit balance is **low (≤ 1)**; CTA → `/pricing`.
  Reuses `getUserCredits()` (`services/paymentService`) — the same source `BalanceCard` uses.
  **No purchase-exclusion on the frontend** (simplification): a low balance is itself the
  trigger, and a top-up nudge is appropriate even for a user who bought and spent down. Two
  tones by balance (`1` = low, `0` = zero). i18n ×3 (ru/en/zh in `src/lib/i18n.ts`), light/dark
  via CSS variables. Rendered in `Home.tsx` above `BalanceCard`. Lazyweb references
  (paywall / low-balance / upgrade prompts) consulted before markup.

### 4. Metric

- `trial_conversion_funnel` VIEW (from §1) surfaced in the admin panel
  (`src/components/.../admin` analytics).

## Anti-spam / idempotency

- Each stage (`trial-low`, `trial-zero`) fires **at most once per user, ever** — dedup via
  `engagement_log` keyed on `message_type` with **no date filter** (differs from
  `streak-at-risk`'s per-day dedup).
- Respect `notification_settings` (skip if `enabled === false`).
- Never nudge users who have already purchased (point-of-action reactive message covers them):
  excluded via `credit_transactions.transaction_type='purchase'`.
- Hourly finder is idempotent: re-running within the same hour finds the same users but the
  `engagement_log` dedup prevents a second send.

## Testing (TDD)

- **`findTrialNudgeUsers` — stage derivation**: total 1 → `low`; total 0 → `zero`; total ≥ 2 → not
  selected; `free_credit_granted=false` → not selected.
- **Eligibility filter**: purchased (`credit_transactions.transaction_type='purchase'`) excluded;
  `notification_settings.enabled=false` excluded; not telegram-linked / banned / onboarding
  incomplete excluded.
- **All-time dedup**: a prior `trial-low` row in `engagement_log` (any date) excludes the user
  from `low` again; `trial-zero` is independent (separate `message_type`).
- **Message generators**: AI failure falls back to localized text; ru/en/zh covered; `low` and
  `zero` tones distinct.
- **replyMarkup threading**: `deliverToTelegram` passes `reply_markup` to `api.sendMessage` when
  provided; omitted when not.
- **Funnel VIEW**: granted/exhausted/purchased counts correct on a seeded fixture.

## Open questions

None. (Purchase source of truth = `credit_transactions`; keyboard via extended
`replyMarkup` option — both resolved during design.)
