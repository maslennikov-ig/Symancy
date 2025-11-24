-- 20251123000003_create_grant_credits_function.sql

CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id UUID,
  p_product_type TEXT,
  p_credits INTEGER
)
RETURNS void AS $$
BEGIN
  -- Upsert user_credits row
  INSERT INTO user_credits (user_id, basic_credits, pro_credits, cassandra_credits)
  VALUES (
    p_user_id,
    CASE WHEN p_product_type IN ('basic', 'pack5') THEN p_credits ELSE 0 END,
    CASE WHEN p_product_type = 'pro' THEN p_credits ELSE 0 END,
    CASE WHEN p_product_type = 'cassandra' THEN p_credits ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    basic_credits = user_credits.basic_credits +
      CASE WHEN p_product_type IN ('basic', 'pack5') THEN p_credits ELSE 0 END,
    pro_credits = user_credits.pro_credits +
      CASE WHEN p_product_type = 'pro' THEN p_credits ELSE 0 END,
    cassandra_credits = user_credits.cassandra_credits +
      CASE WHEN p_product_type = 'cassandra' THEN p_credits ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
