-- 20260526000002_grant_purchased_credits_rpc.sql
-- Service-role-safe purchase grant for unified credits.
--
-- WHY: admin_adjust_credits() guards on is_admin() = (auth.jwt()->>'email' IN admin_emails).
-- Server-side payment code (Node + Edge) calls Supabase with the SERVICE_ROLE key, whose JWT
-- carries no email → is_admin() = false → admin_adjust_credits RAISES 'Unauthorized'. So routing
-- payment grants through admin_adjust_credits silently fails to credit paid users (latent P0;
-- undetected only because no real purchases happened yet — credit_transactions is empty).
--
-- This RPC grants purchased credits to unified_user_credits and logs to credit_transactions
-- (transaction_type='purchase'), WITHOUT an admin guard. It is non-negative-only (purchases add)
-- and is restricted to service_role (never anon/authenticated), so it is safe to call only from
-- trusted server-side payment handlers.

CREATE OR REPLACE FUNCTION public.grant_purchased_credits(
  p_unified_user_id uuid,
  p_basic integer DEFAULT 0,
  p_pro integer DEFAULT 0,
  p_cassandra integer DEFAULT 0,
  p_reason text DEFAULT NULL
)
RETURNS public.unified_user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result public.unified_user_credits;
  v_before RECORD;
BEGIN
  IF p_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'unified_user_id is required';
  END IF;
  IF p_basic < 0 OR p_pro < 0 OR p_cassandra < 0 THEN
    RAISE EXCEPTION 'Purchase deltas must be non-negative';
  END IF;

  SELECT credits_basic, credits_pro, credits_cassandra
    INTO v_before
    FROM unified_user_credits
   WHERE unified_user_id = p_unified_user_id;

  IF v_before IS NULL THEN
    INSERT INTO unified_user_credits (unified_user_id, credits_basic, credits_pro, credits_cassandra)
    VALUES (p_unified_user_id, 0, 0, 0);
    v_before.credits_basic := 0;
    v_before.credits_pro := 0;
    v_before.credits_cassandra := 0;
  END IF;

  UPDATE unified_user_credits
     SET credits_basic = credits_basic + p_basic,
         credits_pro = credits_pro + p_pro,
         credits_cassandra = credits_cassandra + p_cassandra,
         updated_at = now()
   WHERE unified_user_id = p_unified_user_id
  RETURNING * INTO v_result;

  IF p_basic <> 0 THEN
    INSERT INTO credit_transactions (unified_user_id, transaction_type, credit_type, amount, balance_before, balance_after, reason)
    VALUES (p_unified_user_id, 'purchase', 'basic', p_basic, COALESCE(v_before.credits_basic,0), v_result.credits_basic, p_reason);
  END IF;
  IF p_pro <> 0 THEN
    INSERT INTO credit_transactions (unified_user_id, transaction_type, credit_type, amount, balance_before, balance_after, reason)
    VALUES (p_unified_user_id, 'purchase', 'pro', p_pro, COALESCE(v_before.credits_pro,0), v_result.credits_pro, p_reason);
  END IF;
  IF p_cassandra <> 0 THEN
    INSERT INTO credit_transactions (unified_user_id, transaction_type, credit_type, amount, balance_before, balance_after, reason)
    VALUES (p_unified_user_id, 'purchase', 'cassandra', p_cassandra, COALESCE(v_before.credits_cassandra,0), v_result.credits_cassandra, p_reason);
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_purchased_credits(uuid, integer, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_purchased_credits(uuid, integer, integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_purchased_credits(uuid, integer, integer, integer, text) TO service_role;

COMMENT ON FUNCTION public.grant_purchased_credits(uuid, integer, integer, integer, text) IS
  'Service-role-safe purchase credit grant to unified_user_credits + credit_transactions log. Replaces admin_adjust_credits for server-side payment handlers (is_admin guard rejects service role).';
