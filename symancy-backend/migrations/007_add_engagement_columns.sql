-- Migration: 007_add_engagement_columns.sql
-- Purpose: Add engagement tracking columns and table
-- Date: 2025-12-26

-- =============================================================================
-- Add engagement columns to profiles
-- =============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.last_interaction_at IS 'Last time user interacted with bot (for inactive reminders)';
COMMENT ON COLUMN profiles.notifications_enabled IS 'Whether user wants to receive engagement messages';

-- Index for inactive user queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_interaction
    ON profiles(last_interaction_at) WHERE notifications_enabled = TRUE;

-- =============================================================================
-- Create engagement_log table
-- =============================================================================
-- Track sent engagement messages to prevent duplicates

CREATE TABLE IF NOT EXISTS engagement_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL REFERENCES profiles(telegram_user_id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('inactive-reminder', 'weekly-checkin', 'daily-fortune')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent sending same message type to same user on same day
    UNIQUE(telegram_user_id, message_type, DATE(sent_at))
);

COMMENT ON TABLE engagement_log IS 'Track sent engagement messages to prevent duplicates';
COMMENT ON COLUMN engagement_log.message_type IS 'Type: inactive-reminder, weekly-checkin, daily-fortune';

-- Index for checking recent messages
CREATE INDEX IF NOT EXISTS idx_engagement_log_user_type
    ON engagement_log(telegram_user_id, message_type, sent_at DESC);

-- RLS
ALTER TABLE engagement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to engagement_log"
    ON engagement_log FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "No anon access to engagement_log"
    ON engagement_log FOR SELECT TO anon
    USING (false);
