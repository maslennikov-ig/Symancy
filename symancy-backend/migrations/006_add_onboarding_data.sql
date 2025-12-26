-- Migration: 006_add_onboarding_data.sql
-- Purpose: Add onboarding_data column to user_states for temporary storage during onboarding flow
-- Date: 2025-12-26

-- Add JSONB column for temporary onboarding data (goal selections, etc.)
ALTER TABLE user_states
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN user_states.onboarding_data IS 'Temporary storage for onboarding flow state (selected goals, etc.). Cleared after onboarding completion.';

-- Index for efficient JSONB queries (optional, for future performance)
CREATE INDEX IF NOT EXISTS idx_user_states_onboarding_data
    ON user_states USING GIN (onboarding_data);
