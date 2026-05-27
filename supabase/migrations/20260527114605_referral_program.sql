-- 20260527114605_referral_program.sql
-- Referral program for Symancy.
--
-- WHY: A referrer shares a code; a new (referee) user redeems it on signup. Both sides get
-- +1 basic credit, gated by a two-step flow:
--   1. capture_referral        — code redeemed for a telegram_id BEFORE the unified_user exists.
--   2. attribute_referee_signup — referee account created → referee gets +1 basic (status -> referee_rewarded).
--   3. reward_referrer_on_activation — referee activates → referrer gets +1 basic (status -> rewarded),
--      subject to a rolling 30-day cap of 5 rewarded referrals per referrer.
--
-- All credit grants follow the grant_purchased_credits pattern exactly (upsert unified_user_credits,
-- then log credit_transactions). transaction_type='referral' is used for the referral channel
-- (NOT 'purchase'). The check constraint on credit_transactions.transaction_type is widened to allow it.
--
-- Write RPCs that mutate referral state are SECURITY DEFINER + restricted to service_role only
-- (trusted server-side callers). Read-only helpers (get_or_create_referral_code, get_referral_stats)
-- additionally allow authenticated callers but guard p_unified_user_id = current_unified_user_id().

-- ============================================================================
-- 1) referral_codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id uuid NOT NULL UNIQUE REFERENCES public.unified_users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Read: owner or admin. Writes happen only through RPC under service_role (bypasses RLS).
DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
CREATE POLICY "Users can view own referral code" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  );

-- ============================================================================
-- 2) referral_uses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_unified_user_id uuid NOT NULL REFERENCES public.unified_users(id) ON DELETE CASCADE,
  referee_telegram_id bigint NOT NULL UNIQUE,
  referee_unified_user_id uuid NULL REFERENCES public.unified_users(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'referee_rewarded', 'rewarded')),
  referee_rewarded_at timestamptz NULL,
  referrer_rewarded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer
  ON public.referral_uses(referrer_unified_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referee
  ON public.referral_uses(referee_unified_user_id);
-- Composite index supports the rolling 30-day referrer-reward cap count.
CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer_rewarded_at
  ON public.referral_uses(referrer_unified_user_id, referrer_rewarded_at);

ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

-- Read: referrer, referee, or admin. Writes happen only through RPC under service_role.
DROP POLICY IF EXISTS "Users can view own referral uses" ON public.referral_uses;
CREATE POLICY "Users can view own referral uses" ON public.referral_uses
  FOR SELECT TO authenticated
  USING (
    referrer_unified_user_id = (SELECT current_unified_user_id())
    OR referee_unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  );

-- ============================================================================
-- 3) Widen credit_transactions.transaction_type check to allow 'referral'
-- ============================================================================
-- Standard Supabase auto-generated constraint name is <table>_<column>_check.
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'grant_initial',
    'purchase',
    'consume',
    'refund',
    'admin_adjustment',
    'referral'
  ]));

-- ============================================================================
-- 4) get_or_create_referral_code(p_unified_user_id uuid) RETURNS text
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(
  p_unified_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_candidate text;
  i integer;
BEGIN
  IF p_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'unified_user_id is required';
  END IF;

  -- Guard: authenticated callers may only act on themselves; service_role is exempt.
  IF auth.role() <> 'service_role' AND p_unified_user_id <> current_unified_user_id() THEN
    RAISE EXCEPTION 'Forbidden: cannot generate a referral code for another user';
  END IF;

  -- Return existing code if present.
  SELECT code INTO v_code
    FROM referral_codes
   WHERE unified_user_id = p_unified_user_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate a unique 8-char code (unambiguous alphabet), retry on collision.
  LOOP
    v_candidate := '';
    FOR i IN 1..8 LOOP
      v_candidate := v_candidate || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    INSERT INTO referral_codes (unified_user_id, code)
    VALUES (p_unified_user_id, v_candidate)
    ON CONFLICT DO NOTHING
    RETURNING code INTO v_code;

    IF v_code IS NOT NULL THEN
      RETURN v_code;
    END IF;

    -- A concurrent call may have created this user's row (unified_user_id is UNIQUE);
    -- re-read and return it rather than looping forever.
    SELECT code INTO v_code
      FROM referral_codes
     WHERE unified_user_id = p_unified_user_id;
    IF v_code IS NOT NULL THEN
      RETURN v_code;
    END IF;
    -- Otherwise the conflict was on code uniqueness → loop again with a new candidate.
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_create_referral_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_referral_code(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_or_create_referral_code(uuid) IS
  'Returns the caller''s referral code, creating a unique 8-char code on first call. Authenticated callers are restricted to their own user; service_role is exempt.';

-- ============================================================================
-- 5) capture_referral(p_code text, p_referee_telegram_id bigint) RETURNS jsonb
-- ============================================================================
CREATE OR REPLACE FUNCTION public.capture_referral(
  p_code text,
  p_referee_telegram_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_unified_user_id uuid;
  v_referrer_telegram_id bigint;
  v_inserted_id uuid;
BEGIN
  IF p_code IS NULL OR p_referee_telegram_id IS NULL THEN
    RAISE EXCEPTION 'code and referee_telegram_id are required';
  END IF;

  -- Resolve referrer by code.
  SELECT unified_user_id INTO v_referrer_unified_user_id
    FROM referral_codes
   WHERE code = p_code;
  IF v_referrer_unified_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Self-referral guard.
  SELECT telegram_id INTO v_referrer_telegram_id
    FROM unified_users
   WHERE id = v_referrer_unified_user_id;
  IF v_referrer_telegram_id IS NOT NULL AND v_referrer_telegram_id = p_referee_telegram_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  -- Referee must be a new user (no existing unified_users row for this telegram_id).
  IF EXISTS (SELECT 1 FROM unified_users WHERE telegram_id = p_referee_telegram_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_new_user');
  END IF;

  -- Record the capture; UNIQUE(referee_telegram_id) prevents double attribution.
  INSERT INTO referral_uses (referrer_unified_user_id, referee_telegram_id, code, status)
  VALUES (v_referrer_unified_user_id, p_referee_telegram_id, p_code, 'pending')
  ON CONFLICT (referee_telegram_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_captured');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_referral(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_referral(text, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_referral(text, bigint) TO service_role;

COMMENT ON FUNCTION public.capture_referral(text, bigint) IS
  'Records a pending referral for a new (referee) telegram_id from a referral code. Rejects invalid codes, self-referral, existing users, and double captures. Service-role only.';

-- ============================================================================
-- 6) attribute_referee_signup(p_referee_telegram_id bigint, p_referee_unified_user_id uuid) RETURNS jsonb
-- ============================================================================
CREATE OR REPLACE FUNCTION public.attribute_referee_signup(
  p_referee_telegram_id bigint,
  p_referee_unified_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_use_id uuid;
  v_before RECORD;
  v_after RECORD;
BEGIN
  IF p_referee_telegram_id IS NULL OR p_referee_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'referee_telegram_id and referee_unified_user_id are required';
  END IF;

  -- Find the pending capture (idempotent: nothing to do if absent / already rewarded).
  SELECT id INTO v_use_id
    FROM referral_uses
   WHERE referee_telegram_id = p_referee_telegram_id
     AND status = 'pending'
     AND referee_rewarded_at IS NULL;
  IF v_use_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending');
  END IF;

  -- Mark the referee side rewarded and link the new unified user.
  UPDATE referral_uses
     SET referee_unified_user_id = p_referee_unified_user_id,
         status = 'referee_rewarded',
         referee_rewarded_at = now()
   WHERE id = v_use_id;

  -- Grant +1 basic to the referee (exact grant_purchased_credits pattern).
  SELECT credits_basic INTO v_before
    FROM unified_user_credits
   WHERE unified_user_id = p_referee_unified_user_id;

  IF v_before IS NULL THEN
    INSERT INTO unified_user_credits (unified_user_id, credits_basic, credits_pro, credits_cassandra)
    VALUES (p_referee_unified_user_id, 0, 0, 0);
    v_before.credits_basic := 0;
  END IF;

  UPDATE unified_user_credits
     SET credits_basic = credits_basic + 1,
         updated_at = now()
   WHERE unified_user_id = p_referee_unified_user_id
  RETURNING credits_basic INTO v_after;

  INSERT INTO credit_transactions (unified_user_id, transaction_type, credit_type, amount, balance_before, balance_after, reason)
  VALUES (p_referee_unified_user_id, 'referral', 'basic', 1, COALESCE(v_before.credits_basic, 0), v_after.credits_basic, 'referral_signup');

  RETURN jsonb_build_object('ok', true, 'credited', 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.attribute_referee_signup(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attribute_referee_signup(bigint, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_referee_signup(bigint, uuid) TO service_role;

COMMENT ON FUNCTION public.attribute_referee_signup(bigint, uuid) IS
  'On referee account creation, links the unified user to the pending referral and grants the referee +1 basic credit (transaction_type=referral). Idempotent. Service-role only.';

-- ============================================================================
-- 7) reward_referrer_on_activation(p_referee_telegram_id bigint) RETURNS jsonb
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reward_referrer_on_activation(
  p_referee_telegram_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_use_id uuid;
  v_referrer_unified_user_id uuid;
  v_count integer;
  v_before RECORD;
  v_after RECORD;
BEGIN
  IF p_referee_telegram_id IS NULL THEN
    RAISE EXCEPTION 'referee_telegram_id is required';
  END IF;

  -- Find a referee-rewarded use awaiting the referrer reward (idempotent otherwise).
  SELECT id, referrer_unified_user_id
    INTO v_use_id, v_referrer_unified_user_id
    FROM referral_uses
   WHERE referee_telegram_id = p_referee_telegram_id
     AND status = 'referee_rewarded'
     AND referrer_rewarded_at IS NULL;
  IF v_use_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_reward');
  END IF;

  -- Rolling 30-day cap: at most 5 rewarded referrals per referrer.
  SELECT count(*) INTO v_count
    FROM referral_uses
   WHERE referrer_unified_user_id = v_referrer_unified_user_id
     AND referrer_rewarded_at > now() - interval '30 days';
  IF v_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_limit');
  END IF;

  -- Grant +1 basic to the referrer (exact grant_purchased_credits pattern).
  SELECT credits_basic INTO v_before
    FROM unified_user_credits
   WHERE unified_user_id = v_referrer_unified_user_id;

  IF v_before IS NULL THEN
    INSERT INTO unified_user_credits (unified_user_id, credits_basic, credits_pro, credits_cassandra)
    VALUES (v_referrer_unified_user_id, 0, 0, 0);
    v_before.credits_basic := 0;
  END IF;

  UPDATE unified_user_credits
     SET credits_basic = credits_basic + 1,
         updated_at = now()
   WHERE unified_user_id = v_referrer_unified_user_id
  RETURNING credits_basic INTO v_after;

  INSERT INTO credit_transactions (unified_user_id, transaction_type, credit_type, amount, balance_before, balance_after, reason)
  VALUES (v_referrer_unified_user_id, 'referral', 'basic', 1, COALESCE(v_before.credits_basic, 0), v_after.credits_basic, 'referral_activation');

  UPDATE referral_uses
     SET status = 'rewarded',
         referrer_rewarded_at = now()
   WHERE id = v_use_id;

  RETURN jsonb_build_object('ok', true, 'credited', 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.reward_referrer_on_activation(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reward_referrer_on_activation(bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_referrer_on_activation(bigint) TO service_role;

COMMENT ON FUNCTION public.reward_referrer_on_activation(bigint) IS
  'On referee activation, grants the referrer +1 basic credit (transaction_type=referral) and marks the use rewarded, subject to a rolling 30-day cap of 5 rewards. Idempotent. Service-role only.';

-- ============================================================================
-- 8) get_referral_stats(p_unified_user_id uuid) RETURNS jsonb
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_referral_stats(
  p_unified_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_invited integer;
  v_activated integer;
  v_credits_earned integer;
  v_pending integer;
BEGIN
  IF p_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'unified_user_id is required';
  END IF;

  -- Guard: authenticated callers may only read their own stats; service_role is exempt.
  IF auth.role() <> 'service_role' AND p_unified_user_id <> current_unified_user_id() THEN
    RAISE EXCEPTION 'Forbidden: cannot read referral stats for another user';
  END IF;

  SELECT code INTO v_code
    FROM referral_codes
   WHERE unified_user_id = p_unified_user_id;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'rewarded'),
    count(*) FILTER (WHERE referrer_rewarded_at IS NOT NULL),
    count(*) FILTER (WHERE status IN ('pending', 'referee_rewarded'))
  INTO v_invited, v_activated, v_credits_earned, v_pending
  FROM referral_uses
  WHERE referrer_unified_user_id = p_unified_user_id;

  RETURN jsonb_build_object(
    'code', v_code,
    'invited', COALESCE(v_invited, 0),
    'activated', COALESCE(v_activated, 0),
    'credits_earned', COALESCE(v_credits_earned, 0),
    'pending', COALESCE(v_pending, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_referral_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_referral_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_referral_stats(uuid) IS
  'Returns referral stats for a user: code, invited, activated, credits_earned, pending. Authenticated callers are restricted to their own user; service_role is exempt.';
