-- 20260311000003_create_subscription_functions.sql
-- Subscription system: credit granting function + analytics event extension

-- Grant subscription credits to user_credits based on tier
CREATE OR REPLACE FUNCTION grant_subscription_credits(
  p_subscription_id UUID,
  p_user_id UUID,
  p_tier TEXT
)
RETURNS TABLE(basic_granted INTEGER, cassandra_granted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_basic INTEGER;
  v_cassandra INTEGER;
BEGIN
  -- Determine credits by tier
  CASE p_tier
    WHEN 'free' THEN
      v_basic := 4; v_cassandra := 0;
    WHEN 'basic' THEN
      v_basic := 21; v_cassandra := 0;
    WHEN 'advanced' THEN
      v_basic := 68; v_cassandra := 0;
    WHEN 'premium' THEN
      v_basic := 121; v_cassandra := 7;
    ELSE
      RAISE EXCEPTION 'Unknown subscription tier: %', p_tier;
  END CASE;

  -- Upsert user_credits (add to existing balance)
  INSERT INTO public.user_credits (user_id, basic_credits, cassandra_credits)
  VALUES (p_user_id, v_basic, v_cassandra)
  ON CONFLICT (user_id) DO UPDATE SET
    basic_credits = public.user_credits.basic_credits + v_basic,
    cassandra_credits = public.user_credits.cassandra_credits + v_cassandra,
    updated_at = NOW();

  -- Update subscription tracking
  UPDATE public.subscriptions SET
    last_credits_granted_at = NOW(),
    credits_granted_count = credits_granted_count + 1
  WHERE id = p_subscription_id;

  -- Update subscription_payments record (latest succeeded without credits)
  UPDATE public.subscription_payments SET
    basic_credits_granted = v_basic,
    cassandra_credits_granted = v_cassandra,
    credits_granted_at = NOW()
  WHERE id = (
    SELECT id FROM public.subscription_payments
    WHERE subscription_id = p_subscription_id
      AND status = 'succeeded'
      AND credits_granted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN QUERY SELECT v_basic, v_cassandra;
END;
$$;

-- Extend payment_analytics event CHECK to include subscription events
ALTER TABLE public.payment_analytics
  DROP CONSTRAINT IF EXISTS payment_analytics_event_check;

ALTER TABLE public.payment_analytics
  ADD CONSTRAINT payment_analytics_event_check
  CHECK (event IN (
    'tariff_view',
    'payment_started',
    'payment_succeeded',
    'payment_canceled',
    'subscription_started',
    'subscription_activated',
    'subscription_renewed',
    'subscription_renewal_failed',
    'subscription_canceled',
    'subscription_expired',
    'subscription_credits_granted'
  ));
