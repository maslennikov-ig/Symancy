-- Migration 010: Add atomic function for invalid image counter
-- Fixes race condition in daily counter reset logic
-- Uses UTC date comparison and atomic increment

-- Add constraint to prevent negative counts (data integrity)
ALTER TABLE user_states
DROP CONSTRAINT IF EXISTS check_daily_invalid_count_positive;

ALTER TABLE user_states
ADD CONSTRAINT check_daily_invalid_count_positive
CHECK (daily_invalid_count >= 0);

-- Create atomic function for incrementing invalid counter
-- Handles:
-- 1. Day boundary reset (UTC-based)
-- 2. Atomic increment (no race conditions)
-- 3. UPSERT without overwriting other columns
CREATE OR REPLACE FUNCTION increment_invalid_count(
  p_telegram_user_id BIGINT
) RETURNS TABLE(
  new_count INTEGER,
  was_reset BOOLEAN
) AS $$
DECLARE
  v_new_count INTEGER;
  v_was_reset BOOLEAN;
BEGIN
  -- Atomic upsert with day reset logic
  INSERT INTO user_states (
    telegram_user_id,
    daily_invalid_count,
    daily_invalid_reset_at,
    onboarding_step,
    onboarding_data
  )
  VALUES (
    p_telegram_user_id,
    1,
    NOW(),
    NULL,
    '{}'::jsonb
  )
  ON CONFLICT (telegram_user_id) DO UPDATE SET
    daily_invalid_count = CASE
      -- If reset_at is NULL or different day (UTC), reset to 1
      WHEN user_states.daily_invalid_reset_at IS NULL
           OR DATE(user_states.daily_invalid_reset_at AT TIME ZONE 'UTC') != CURRENT_DATE AT TIME ZONE 'UTC'
      THEN 1
      -- Same day: increment
      ELSE user_states.daily_invalid_count + 1
    END,
    daily_invalid_reset_at = CASE
      -- If reset_at is NULL or different day, set to NOW()
      WHEN user_states.daily_invalid_reset_at IS NULL
           OR DATE(user_states.daily_invalid_reset_at AT TIME ZONE 'UTC') != CURRENT_DATE AT TIME ZONE 'UTC'
      THEN NOW()
      -- Same day: keep existing value
      ELSE user_states.daily_invalid_reset_at
    END
  RETURNING
    user_states.daily_invalid_count,
    (user_states.daily_invalid_reset_at = NOW()) -- True if we just reset
  INTO v_new_count, v_was_reset;

  -- Return result
  RETURN QUERY SELECT v_new_count, v_was_reset;
END;
$$ LANGUAGE plpgsql;

-- Create function to get current invalid count (for checking limit before incrementing)
CREATE OR REPLACE FUNCTION get_invalid_count(
  p_telegram_user_id BIGINT
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT
    CASE
      -- If reset_at is NULL or different day (UTC), count is effectively 0
      WHEN daily_invalid_reset_at IS NULL
           OR DATE(daily_invalid_reset_at AT TIME ZONE 'UTC') != CURRENT_DATE AT TIME ZONE 'UTC'
      THEN 0
      -- Same day: return current count
      ELSE daily_invalid_count
    END
  INTO v_count
  FROM user_states
  WHERE telegram_user_id = p_telegram_user_id;

  -- If user not found, return 0
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_invalid_count IS
  'Atomically increment invalid image counter with day boundary reset (UTC). Returns new count and whether counter was reset.';

COMMENT ON FUNCTION get_invalid_count IS
  'Get current invalid count, accounting for day boundary reset (UTC). Returns 0 if user not found or new day.';
