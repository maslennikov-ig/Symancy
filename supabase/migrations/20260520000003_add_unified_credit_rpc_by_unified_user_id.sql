-- T10/P1: Атомарные consume/refund по unified_user_id (для web-only юзеров без telegram_id)
-- Закрывает TOCTOU race в Edge Function compare-coffee fallback path.
-- Применено на prod через mcp__supabase__apply_migration 2026-05-20.

CREATE OR REPLACE FUNCTION public.consume_unified_credit_by_unified_user_id(
  p_unified_user_id UUID,
  p_credit_type TEXT DEFAULT 'basic'
)
RETURNS TABLE(success BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  IF p_credit_type NOT IN ('basic', 'pro', 'cassandra') THEN
    RAISE EXCEPTION 'Invalid credit type: %. Must be basic, pro, or cassandra', p_credit_type;
  END IF;

  IF p_credit_type = 'basic' THEN
    UPDATE unified_user_credits
    SET credits_basic = credits_basic - 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
      AND credits_basic > 0
    RETURNING credits_basic INTO v_remaining;
  ELSIF p_credit_type = 'pro' THEN
    UPDATE unified_user_credits
    SET credits_pro = credits_pro - 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
      AND credits_pro > 0
    RETURNING credits_pro INTO v_remaining;
  ELSIF p_credit_type = 'cassandra' THEN
    UPDATE unified_user_credits
    SET credits_cassandra = credits_cassandra - 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
      AND credits_cassandra > 0
    RETURNING credits_cassandra INTO v_remaining;
  END IF;

  IF v_remaining IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_unified_credit_by_unified_user_id(
  p_unified_user_id UUID,
  p_credit_type TEXT DEFAULT 'basic'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_credit_type NOT IN ('basic', 'pro', 'cassandra') THEN
    RAISE EXCEPTION 'Invalid credit type: %. Must be basic, pro, or cassandra', p_credit_type;
  END IF;

  IF p_credit_type = 'basic' THEN
    UPDATE unified_user_credits
    SET credits_basic = credits_basic + 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
    RETURNING credits_basic INTO v_balance;
  ELSIF p_credit_type = 'pro' THEN
    UPDATE unified_user_credits
    SET credits_pro = credits_pro + 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
    RETURNING credits_pro INTO v_balance;
  ELSIF p_credit_type = 'cassandra' THEN
    UPDATE unified_user_credits
    SET credits_cassandra = credits_cassandra + 1, updated_at = NOW()
    WHERE unified_user_id = p_unified_user_id
    RETURNING credits_cassandra INTO v_balance;
  END IF;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_unified_credit_by_unified_user_id(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_unified_credit_by_unified_user_id(UUID, TEXT) TO service_role;
