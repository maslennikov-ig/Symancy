-- 20260526000001_backfill_unified_credits.sql
-- One-time, idempotent backfill of legacy credit stores into unified_user_credits.
-- Guard: migrated_to_unified flag per legacy row → re-run is a no-op.
-- Legacy tables are NOT dropped here (rollback window). See sym-nvu.
--
-- Mapping:
--   user_credits         (auth_id key, typed)   → unified_user_credits.{basic,pro,cassandra}
--   backend_user_credits (telegram_id key, generic) → unified_user_credits.credits_basic
-- Additive: a linked user (auth_id + telegram_id) resolves to one unified row and gets both.

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

-- 3. Fold user_credits (typed) → unified, then mark migrated. Single CTE = atomic.
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
