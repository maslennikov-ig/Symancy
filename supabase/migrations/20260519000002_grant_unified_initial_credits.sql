-- 20260519000002_grant_unified_initial_credits.sql
-- New welcome-credits grant flow: atomic per-type grant against unified_user_credits,
-- idempotent via free_credit_granted flag.
--
-- Replaces previous "1 generic credit" model (grant_initial_credits → backend_user_credits)
-- with type-aware grant (e.g. 3 basic + 1 pro for new users post Summer 2026).
--
-- The legacy grant_initial_credits RPC is left intact — old code paths keep working.

CREATE OR REPLACE FUNCTION public.grant_unified_initial_credits(
  p_unified_user_id UUID,
  p_basic INTEGER DEFAULT 0,
  p_pro INTEGER DEFAULT 0,
  p_cassandra INTEGER DEFAULT 0
)
RETURNS TABLE(
  basic_granted INTEGER,
  pro_granted INTEGER,
  cassandra_granted INTEGER,
  already_granted BOOLEAN,
  new_basic INTEGER,
  new_pro INTEGER,
  new_cassandra INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_basic INTEGER;
  v_new_pro INTEGER;
  v_new_cassandra INTEGER;
BEGIN
  IF p_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'unified_user_id is required';
  END IF;

  IF p_basic < 0 OR p_pro < 0 OR p_cassandra < 0 THEN
    RAISE EXCEPTION 'Credit amounts must be non-negative';
  END IF;

  -- Free-tier safety cap (mirror of FREE_TIER.MAX_FREE_GRANT in backend code)
  IF p_basic > 10 OR p_pro > 10 OR p_cassandra > 10 THEN
    RAISE EXCEPTION 'Single grant cannot exceed 10 credits per type';
  END IF;

  -- Ensure a row exists for this user (the auth signup trigger normally
  -- creates one, but the Telegram-only flow may not have triggered it yet).
  INSERT INTO public.unified_user_credits (
    unified_user_id, credits_basic, credits_pro, credits_cassandra, free_credit_granted
  )
  VALUES (p_unified_user_id, 0, 0, 0, false)
  ON CONFLICT (unified_user_id) DO NOTHING;

  -- Atomic check-and-grant: only update if not yet granted.
  -- This single UPDATE handles concurrent calls safely thanks to row-level locks.
  UPDATE public.unified_user_credits
     SET credits_basic = credits_basic + p_basic,
         credits_pro = credits_pro + p_pro,
         credits_cassandra = credits_cassandra + p_cassandra,
         free_credit_granted = true,
         updated_at = NOW()
   WHERE unified_user_id = p_unified_user_id
     AND free_credit_granted = false
   RETURNING credits_basic, credits_pro, credits_cassandra
        INTO v_new_basic, v_new_pro, v_new_cassandra;

  IF NOT FOUND THEN
    -- Already granted before; return the current balances without adding.
    SELECT credits_basic, credits_pro, credits_cassandra
      INTO v_new_basic, v_new_pro, v_new_cassandra
      FROM public.unified_user_credits
     WHERE unified_user_id = p_unified_user_id;

    RETURN QUERY SELECT 0, 0, 0, TRUE, v_new_basic, v_new_pro, v_new_cassandra;
  ELSE
    RETURN QUERY SELECT p_basic, p_pro, p_cassandra, FALSE, v_new_basic, v_new_pro, v_new_cassandra;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_unified_initial_credits(UUID, INTEGER, INTEGER, INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.grant_unified_initial_credits(UUID, INTEGER, INTEGER, INTEGER) IS
  'Atomic, idempotent grant of welcome credits to unified_user_credits. Sets free_credit_granted=true on success. Returns granted amounts + new balances. Used by both Telegram onboarding and Web onboarding.';
