-- Migration: 20260525000020_create_user_streaks.sql
-- Purpose: Create user_streaks table for the daily-usage streak tracker (gamification)
-- Feature: Streak tracker (sym-tb3) - rewards consecutive days of activity (photo analysis)
--
-- Style reference: mood_entries (20260217000001) for omnichannel RLS + SECURITY DEFINER RPC,
-- prompts (20260119000001) for the updated_at trigger pattern.

-- ============================================================================
-- TABLE: user_streaks
-- One row per user. Tracks current consecutive-day streak, all-time best,
-- and the last date the user was active (used to decide increment/reset).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,

  -- Current consecutive-day streak (>= 0)
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),

  -- All-time longest streak achieved (>= 0)
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),

  -- Last calendar date the user performed a streak-counting activity
  last_activity_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One streak row per user (enables UPSERT and 1:1 lookup)
  UNIQUE(unified_user_id)
);

COMMENT ON TABLE user_streaks IS 'Daily-usage streak tracker: current consecutive-day streak, all-time best, last activity date. One row per user.';
COMMENT ON COLUMN user_streaks.current_streak IS 'Current number of consecutive active days';
COMMENT ON COLUMN user_streaks.longest_streak IS 'All-time longest consecutive-day streak';
COMMENT ON COLUMN user_streaks.last_activity_date IS 'Last calendar date (server tz) a streak-counting activity occurred';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup by user
CREATE INDEX idx_user_streaks_unified_user_id
  ON user_streaks(unified_user_id);

-- Used by the "streak-at-risk" engagement trigger to find active streaks
-- that have not yet been extended today.
CREATE INDEX idx_user_streaks_last_activity_date
  ON user_streaks(last_activity_date);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- Reuses existing update_updated_at_column() function from prior migrations
-- ============================================================================
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- Multi-tenant isolation: users read their own row; service_role full access.
-- ============================================================================
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Policy 1: Supabase Auth (web) users can read their own streak.
-- Wrapping auth.uid() in (SELECT ...) prevents per-row re-evaluation.
CREATE POLICY "Users can read own streak" ON user_streaks
  FOR SELECT USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE auth_id = (SELECT auth.uid())
    )
  );

-- Policy 2: Telegram JWT users can read their own streak.
-- Custom JWTs issued for Telegram users contain a telegram_user_id claim.
CREATE POLICY "Telegram users can read own streak" ON user_streaks
  FOR SELECT USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE telegram_id = ((SELECT auth.jwt()) ->> 'telegram_user_id')::bigint
    )
  );

-- Policy 3: Service role has full access (backend increments via RPC / direct writes)
CREATE POLICY "Service role full access to streaks" ON user_streaks
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- RPC: increment_user_streak(p_unified_user_id uuid)
-- SECURITY DEFINER. Called by the backend (service_role) after a successful
-- photo analysis. Idempotent per day.
--
-- Logic:
--   * No row yet            -> create row, current = 1, longest = 1
--   * last_activity = today -> no change (already counted today)
--   * last_activity = yesterday -> current += 1
--   * otherwise (gap)       -> reset current to 1
-- longest_streak is bumped to max(longest_streak, current_streak).
-- Returns the resulting row.
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_user_streak(
  p_unified_user_id UUID
) RETURNS user_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_row user_streaks;
  v_new_current INTEGER;
BEGIN
  IF p_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'p_unified_user_id must not be null';
  END IF;

  -- Lock the existing row (if any) to avoid concurrent double-increment
  SELECT * INTO v_row
  FROM user_streaks
  WHERE unified_user_id = p_unified_user_id
  FOR UPDATE;

  -- No row yet: first ever activity
  IF NOT FOUND THEN
    INSERT INTO user_streaks (unified_user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_unified_user_id, 1, 1, v_today)
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- Already counted today: no change
  IF v_row.last_activity_date = v_today THEN
    RETURN v_row;
  END IF;

  -- Consecutive day: extend streak. Otherwise (gap or null): reset to 1.
  IF v_row.last_activity_date = v_today - INTERVAL '1 day' THEN
    v_new_current := v_row.current_streak + 1;
  ELSE
    v_new_current := 1;
  END IF;

  UPDATE user_streaks
  SET current_streak = v_new_current,
      longest_streak = GREATEST(longest_streak, v_new_current),
      last_activity_date = v_today,
      updated_at = NOW()
  WHERE unified_user_id = p_unified_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION increment_user_streak IS 'Increment/extend/reset a user daily-usage streak. Idempotent per calendar day. Called by backend after a successful photo analysis.';

-- Backend uses the service_role key; expose explicitly to service_role.
GRANT EXECUTE ON FUNCTION increment_user_streak(UUID) TO service_role;
