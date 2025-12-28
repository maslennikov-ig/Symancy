-- Migration: Add daily invalid image count tracking
-- Purpose: Track invalid image submissions per day for troll protection
-- Allows 2 free "mistakes" per day before limiting responses

ALTER TABLE user_states
ADD COLUMN IF NOT EXISTS daily_invalid_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_invalid_reset_at TIMESTAMPTZ;

COMMENT ON COLUMN user_states.daily_invalid_count IS 'Count of invalid images sent today (resets daily)';
COMMENT ON COLUMN user_states.daily_invalid_reset_at IS 'Timestamp when daily_invalid_count was last reset';
