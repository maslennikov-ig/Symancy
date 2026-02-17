-- Migration: 20260217000002_mood_cr_fixes.sql
-- Purpose: Fix 3 code review issues for mood_entries table
-- CR-001: Add p_date parameter to upsert_mood_entry (timezone fix)
-- CR-002: Create STABLE helper function for RLS (performance fix)
-- CR-003: Add input validation to upsert_mood_entry RPC

-- ============================================================================
-- CR-002: STABLE helper function for RLS policy caching
-- Resolves current user's unified_user_id from auth context.
-- STABLE volatility + (SELECT ...) wrapper in policies ensures per-statement
-- caching instead of per-row re-evaluation.
-- ============================================================================

CREATE OR REPLACE FUNCTION current_unified_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try Supabase Auth first
  SELECT id INTO v_user_id
  FROM unified_users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- If not found, try Telegram JWT
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM unified_users
    WHERE telegram_id = ((auth.jwt() ->> 'telegram_user_id')::bigint)
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION current_unified_user_id IS 'Resolves current user unified_user_id from auth context (Supabase Auth or Telegram JWT). STABLE for RLS caching.';

-- ============================================================================
-- CR-002: Replace RLS policies with optimized versions using helper
-- Drop old per-auth-method policies, create single unified policy.
-- Service role policy remains unchanged (already optimal).
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can manage own mood entries" ON mood_entries;
DROP POLICY IF EXISTS "Telegram users can manage own mood entries" ON mood_entries;

-- New unified policy using helper function
-- (SELECT current_unified_user_id()) ensures the function is called once per statement
CREATE POLICY "Users can manage own mood entries" ON mood_entries
  FOR ALL
  TO authenticated
  USING (unified_user_id = (SELECT current_unified_user_id()))
  WITH CHECK (unified_user_id = (SELECT current_unified_user_id()));

-- Service role policy stays unchanged (already optimal, not touched)

-- ============================================================================
-- CR-001 + CR-003: Replace upsert_mood_entry with timezone fix + validation
-- CR-001: p_date DATE DEFAULT CURRENT_DATE as first parameter
-- CR-003: Input validation before INSERT
--
-- Must DROP old signature first because the parameter list changed
-- (old: SMALLINT, TEXT[], TEXT, TEXT vs new: DATE, SMALLINT, TEXT[], TEXT, TEXT).
-- CREATE OR REPLACE only works when the argument types match exactly;
-- otherwise PostgreSQL creates an overloaded function.
-- ============================================================================

DROP FUNCTION IF EXISTS upsert_mood_entry(SMALLINT, TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION upsert_mood_entry(
  p_date DATE DEFAULT CURRENT_DATE,
  p_score SMALLINT DEFAULT NULL,
  p_emotions TEXT[] DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'mini_app'
) RETURNS mood_entries AS $$
DECLARE
  v_unified_user_id UUID;
  v_result mood_entries;
  v_emotion TEXT;
BEGIN
  -- ========================================
  -- CR-003: Input validation
  -- ========================================

  -- Validate required params
  IF p_score IS NULL THEN
    RAISE EXCEPTION 'score is required';
  END IF;

  IF p_emotions IS NULL THEN
    RAISE EXCEPTION 'emotions is required';
  END IF;

  -- Validate score range
  IF p_score < 1 OR p_score > 10 THEN
    RAISE EXCEPTION 'Invalid score: must be between 1 and 10';
  END IF;

  -- Validate source
  IF p_source NOT IN ('telegram', 'web', 'mini_app') THEN
    RAISE EXCEPTION 'Invalid source: must be telegram, web, or mini_app';
  END IF;

  -- Validate emotions
  FOREACH v_emotion IN ARRAY p_emotions
  LOOP
    IF v_emotion NOT IN ('happy', 'calm', 'grateful', 'energetic', 'loved', 'hopeful',
                          'anxious', 'sad', 'angry', 'tired', 'stressed', 'lonely') THEN
      RAISE EXCEPTION 'Invalid emotion: %', v_emotion;
    END IF;
  END LOOP;

  -- Validate note length
  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
    RAISE EXCEPTION 'Note too long: max 500 characters';
  END IF;

  -- ========================================
  -- Resolve unified_user_id from auth context
  -- ========================================
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

  -- ========================================
  -- CR-001: Use p_date instead of CURRENT_DATE
  -- ========================================
  INSERT INTO mood_entries (unified_user_id, date, score, emotions, note, source)
  VALUES (v_unified_user_id, p_date, p_score, p_emotions, p_note, p_source)
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

COMMENT ON FUNCTION upsert_mood_entry IS 'Upsert daily mood entry. Resolves user from auth context. p_date allows frontend to pass client-local date (timezone fix). Validates all inputs before insert.';
