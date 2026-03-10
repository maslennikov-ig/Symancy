-- Remove 'free' from subscriptions.tier CHECK constraint
-- The free tier is not purchasable and should not exist in the subscriptions table.

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('basic', 'advanced', 'premium'));
