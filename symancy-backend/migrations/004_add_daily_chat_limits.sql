-- Migration: 004_add_daily_chat_limits.sql
-- Purpose: Add daily message tracking columns to user_states
-- Date: 2025-12-26

-- Add columns for daily chat limit tracking
ALTER TABLE user_states
ADD COLUMN IF NOT EXISTS daily_messages_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_message_date DATE;

COMMENT ON COLUMN user_states.daily_messages_count IS 'Number of messages sent today (resets daily)';
COMMENT ON COLUMN user_states.last_message_date IS 'Date of last message (used to reset daily count)';

-- Index for daily limit queries
CREATE INDEX IF NOT EXISTS idx_user_states_last_message_date
    ON user_states(last_message_date) WHERE last_message_date IS NOT NULL;

-- =============================================================================
-- Helper function: Increment daily message count
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_daily_messages(
    p_telegram_user_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Increment daily_messages_count for the user
    UPDATE user_states
    SET daily_messages_count = daily_messages_count + 1
    WHERE telegram_user_id = p_telegram_user_id;

    -- If no row was updated, create a new one
    IF NOT FOUND THEN
        INSERT INTO user_states (telegram_user_id, daily_messages_count, last_message_date)
        VALUES (p_telegram_user_id, 1, CURRENT_DATE)
        ON CONFLICT (telegram_user_id) DO UPDATE
        SET daily_messages_count = user_states.daily_messages_count + 1;
    END IF;
END;
$$;

COMMENT ON FUNCTION increment_daily_messages IS 'Increment daily message count for a user';
