-- Migration: 20260217000001_create_mood_entries.sql
-- Purpose: Create mood_entries table for daily mood diary feature
-- Feature: Mood Diary (sym-tks) - enriches user data for personalized fortune-telling

-- ============================================================================
-- TABLE: mood_entries
-- Stores daily mood scores, emotion tags, and optional notes.
-- One record per user per day (UPSERT pattern).
-- ============================================================================

CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Mood score (1-10)
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),

  -- Emotion tags (array of predefined emotion keys)
  -- Valid values: happy, calm, grateful, energetic, loved, hopeful,
  --              anxious, sad, angry, tired, stressed, lonely
  emotions TEXT[] NOT NULL DEFAULT '{}',

  -- Optional text note (max 500 chars, enforced at DB level)
  note TEXT CHECK (char_length(note) <= 500),

  -- Source channel: where the mood was logged from
  source TEXT NOT NULL DEFAULT 'mini_app' CHECK (source IN ('telegram', 'web', 'mini_app')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One entry per user per day (enables UPSERT)
  UNIQUE(unified_user_id, date)
);

-- Add table and column comments
COMMENT ON TABLE mood_entries IS 'Daily mood diary entries: score 1-10, emotion tags, optional note. One per user per day.';
COMMENT ON COLUMN mood_entries.score IS 'Mood score from 1 (very bad) to 10 (excellent)';
COMMENT ON COLUMN mood_entries.emotions IS 'Array of emotion tag keys: happy, calm, grateful, energetic, loved, hopeful, anxious, sad, angry, tired, stressed, lonely';
COMMENT ON COLUMN mood_entries.note IS 'Optional free-text note, max 500 characters';
COMMENT ON COLUMN mood_entries.source IS 'Channel where mood was logged: telegram (bot), web (browser), mini_app (Telegram Mini App)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query: user's mood for a specific date or date range (calendar view)
-- DESC on date ensures recent entries are retrieved first
CREATE INDEX idx_mood_entries_user_date
  ON mood_entries(unified_user_id, date DESC);

-- Analytics: find entries by score range for AI correlation
CREATE INDEX idx_mood_entries_score
  ON mood_entries(score);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- Reuses existing update_updated_at_column() function from prior migrations
-- ============================================================================
CREATE TRIGGER update_mood_entries_updated_at
  BEFORE UPDATE ON mood_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- Enable row-level security for multi-tenant data isolation
-- ============================================================================
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

-- Policy 1: Supabase Auth users can CRUD their own entries
-- Note: Wrapping auth.uid() in (SELECT ...) prevents per-row re-evaluation
CREATE POLICY "Users can manage own mood entries" ON mood_entries
  FOR ALL USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE auth_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE auth_id = (SELECT auth.uid())
    )
  );

-- Policy 2: Service role has full access (backend operations, bot commands)
CREATE POLICY "Service role full access to mood entries" ON mood_entries
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- Policy 3: Telegram JWT users can CRUD their own entries
-- Custom JWTs issued for Telegram users contain telegram_user_id claim
-- Note: Wrapping auth.jwt() in (SELECT ...) prevents per-row re-evaluation
CREATE POLICY "Telegram users can manage own mood entries" ON mood_entries
  FOR ALL USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE telegram_id = ((SELECT auth.jwt()) ->> 'telegram_user_id')::bigint
    )
  )
  WITH CHECK (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE telegram_id = ((SELECT auth.jwt()) ->> 'telegram_user_id')::bigint
    )
  );

-- ============================================================================
-- RPC: upsert_mood_entry
-- Resolves unified_user_id internally from auth context, performs UPSERT.
-- Needed because frontend client doesn't know its own unified_user_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_mood_entry(
  p_score SMALLINT,
  p_emotions TEXT[],
  p_note TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'mini_app'
) RETURNS mood_entries AS $$
DECLARE
  v_unified_user_id UUID;
  v_result mood_entries;
BEGIN
  -- Resolve unified_user_id from auth context
  -- Try Supabase Auth first
  SELECT id INTO v_unified_user_id
  FROM unified_users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- If not found, try Telegram JWT
  IF v_unified_user_id IS NULL THEN
    SELECT id INTO v_unified_user_id
    FROM unified_users
    WHERE telegram_id = ((auth.jwt() ->> 'telegram_user_id')::bigint)
    LIMIT 1;
  END IF;

  IF v_unified_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found in unified_users';
  END IF;

  -- Upsert: insert or update today's entry
  INSERT INTO mood_entries (unified_user_id, date, score, emotions, note, source)
  VALUES (v_unified_user_id, CURRENT_DATE, p_score, p_emotions, p_note, p_source)
  ON CONFLICT (unified_user_id, date)
  DO UPDATE SET
    score = EXCLUDED.score,
    emotions = EXCLUDED.emotions,
    note = EXCLUDED.note,
    source = EXCLUDED.source,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upsert_mood_entry IS 'Upsert daily mood entry. Resolves user from auth context. One entry per day.';
