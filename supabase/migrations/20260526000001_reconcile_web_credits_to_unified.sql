-- 20260526000001_reconcile_web_credits_to_unified.sql
-- Reconcile web (user_credits, auth-keyed) balances into unified_user_credits via GREATEST.
--
-- Why GREATEST (not additive): the on_unified_user_created / on_unified_user_linked triggers
-- already GREATEST-copy legacy → unified at creation/link. Web purchases & grants
-- (grant_credits) made AFTER that landed only in user_credits, so some web users have credits
-- in user_credits not reflected in unified. GREATEST lifts unified to include them without
-- double-counting and never lowers a balance (safe if the user spent on the web/legacy path).
--
-- backend_user_credits is INTENTIONALLY SKIPPED. Per the 2026-05-26 reconciliation, those rows
-- are only: (a) the test/admin account (unified already ≥ legacy), or (b) the stranded
-- onboarding double-grant artifact (backend=1, fixed in sym-1xi) — not real spendable balance.
--
-- Idempotent: GREATEST + the "web is strictly higher" guard make re-runs a no-op.

UPDATE public.unified_user_credits t
SET credits_basic     = GREATEST(t.credits_basic, COALESCE(wc.basic_credits, 0)),
    credits_pro       = GREATEST(t.credits_pro, COALESCE(wc.pro_credits, 0)),
    credits_cassandra = GREATEST(t.credits_cassandra, COALESCE(wc.cassandra_credits, 0)),
    updated_at        = NOW()
FROM public.unified_users u
JOIN public.user_credits wc ON wc.user_id = u.auth_id
WHERE t.unified_user_id = u.id
  AND u.auth_id IS NOT NULL
  AND (
        wc.basic_credits     > t.credits_basic
     OR wc.pro_credits       > t.credits_pro
     OR wc.cassandra_credits > t.credits_cassandra
  );
