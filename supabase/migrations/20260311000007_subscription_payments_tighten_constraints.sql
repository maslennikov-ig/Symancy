-- S-8/S-9: Tighten subscription_payments constraints
-- 1. Add NOT NULL to payment_type (all existing rows already backfilled)
-- 2. Recreate partial index with status='succeeded' filter for better selectivity

-- Make payment_type NOT NULL (all rows have been backfilled by migration 000005)
ALTER TABLE subscription_payments ALTER COLUMN payment_type SET NOT NULL;

-- Drop the overly broad index and recreate with tighter predicate
DROP INDEX IF EXISTS idx_subscription_payments_ungranted;

CREATE INDEX idx_subscription_payments_ungranted
  ON subscription_payments (subscription_id)
  WHERE status = 'succeeded' AND credits_granted_at IS NULL;
