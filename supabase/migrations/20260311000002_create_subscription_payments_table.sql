-- 20260311000002_create_subscription_payments_table.sql
-- Subscription system: payment history table

CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_rub INTEGER NOT NULL CHECK (amount_rub >= 0),
  yukassa_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'canceled')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  is_initial BOOLEAN NOT NULL DEFAULT false,
  basic_credits_granted INTEGER NOT NULL DEFAULT 0,
  cassandra_credits_granted INTEGER NOT NULL DEFAULT 0,
  credits_granted_at TIMESTAMPTZ,
  failure_reason TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscription_payments_subscription_id ON subscription_payments (subscription_id);
CREATE INDEX idx_subscription_payments_user_id ON subscription_payments (user_id);
CREATE INDEX idx_subscription_payments_status ON subscription_payments (status);
CREATE INDEX idx_subscription_payments_yukassa ON subscription_payments (yukassa_payment_id);

-- Enable RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription payments
CREATE POLICY "Users can view own subscription payments"
  ON subscription_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all subscription payments
CREATE POLICY "Service role can manage subscription payments"
  ON subscription_payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
