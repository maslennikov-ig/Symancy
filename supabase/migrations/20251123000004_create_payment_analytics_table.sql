-- 20251123000004_create_payment_analytics_table.sql

CREATE TABLE payment_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL CHECK (event IN ('tariff_view', 'payment_started', 'payment_succeeded', 'payment_canceled')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_type TEXT,
  amount_rub INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_analytics_event ON payment_analytics(event);
CREATE INDEX idx_payment_analytics_created_at ON payment_analytics(created_at);

-- Enable RLS
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can insert analytics"
  ON payment_analytics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can read analytics"
  ON payment_analytics FOR SELECT
  TO service_role
  USING (true);

-- Conversion rate view
CREATE VIEW payment_conversion AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) FILTER (WHERE event = 'tariff_view') as views,
  COUNT(*) FILTER (WHERE event = 'payment_started') as started,
  COUNT(*) FILTER (WHERE event = 'payment_succeeded') as succeeded,
  COUNT(*) FILTER (WHERE event = 'payment_canceled') as canceled,
  ROUND(
    COUNT(*) FILTER (WHERE event = 'payment_succeeded') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE event = 'tariff_view'), 0), 2
  ) as conversion_rate
FROM payment_analytics
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
