-- S-6: Partial index for grant_subscription_credits() performance
-- The function queries: WHERE subscription_id = ? AND status = 'succeeded' AND credits_granted_at IS NULL

CREATE INDEX idx_subscription_payments_ungranted
  ON subscription_payments (subscription_id)
  WHERE credits_granted_at IS NULL;
