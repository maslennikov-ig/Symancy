-- Migration: 005_add_onboarding_columns.sql
-- Purpose: Add onboarding-related columns to profiles table
-- Date: 2025-12-26

-- Add columns for onboarding flow
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Moscow',
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bonus_credit_granted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN profiles.name IS 'User preferred name (collected during onboarding)';
COMMENT ON COLUMN profiles.goals IS 'User interests/goals: career, relationships, health, finances, spiritual';
COMMENT ON COLUMN profiles.timezone IS 'User timezone for scheduled messages';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed onboarding flow';
COMMENT ON COLUMN profiles.bonus_credit_granted IS 'Whether onboarding bonus credit was granted';

-- Index for completed onboarding queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
    ON profiles(onboarding_completed) WHERE onboarding_completed = TRUE;
