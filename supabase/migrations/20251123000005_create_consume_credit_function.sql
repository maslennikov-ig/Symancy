-- 20251123000005_create_consume_credit_function.sql

CREATE OR REPLACE FUNCTION consume_credit(
  p_user_id UUID,
  p_credit_type TEXT DEFAULT 'basic'
)
RETURNS TABLE (
  success BOOLEAN,
  credit_type TEXT,
  remaining INTEGER
) AS $$
DECLARE
  v_basic INTEGER;
  v_pro INTEGER;
  v_cassandra INTEGER;
  v_consumed_type TEXT;
  v_remaining INTEGER;
BEGIN
  -- Get current credits with row lock
  SELECT basic_credits, pro_credits, cassandra_credits
  INTO v_basic, v_pro, v_cassandra
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no record exists, return failure
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Determine which credit to consume (priority: basic -> pro)
  IF p_credit_type = 'cassandra' THEN
    -- Cassandra credits only for cassandra readings
    IF v_cassandra > 0 THEN
      UPDATE user_credits
      SET cassandra_credits = cassandra_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'cassandra';
      v_remaining := v_cassandra - 1;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
      RETURN;
    END IF;
  ELSE
    -- Regular credits: try basic first, then pro
    IF v_basic > 0 THEN
      UPDATE user_credits
      SET basic_credits = basic_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'basic';
      v_remaining := v_basic - 1;
    ELSIF v_pro > 0 THEN
      UPDATE user_credits
      SET pro_credits = pro_credits - 1, updated_at = NOW()
      WHERE user_id = p_user_id;
      v_consumed_type := 'pro';
      v_remaining := v_pro - 1;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::TEXT, 0;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, v_consumed_type, v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
