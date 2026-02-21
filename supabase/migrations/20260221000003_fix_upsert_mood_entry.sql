-- Migration: 20260221000003_fix_upsert_mood_entry.sql
-- Purpose: Fix "User not found in unified_users" bug by updating upsert_mood_entry to use the corrected current_unified_user_id() function instead of broken inline logic.

DROP FUNCTION IF EXISTS upsert_mood_entry(SMALLINT, TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS upsert_mood_entry(DATE, SMALLINT, TEXT[], TEXT, TEXT);

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
  IF p_score IS NULL THEN RAISE EXCEPTION 'score is required'; END IF;
  IF p_emotions IS NULL THEN RAISE EXCEPTION 'emotions is required'; END IF;
  IF p_score < 1 OR p_score > 10 THEN RAISE EXCEPTION 'Invalid score: must be between 1 and 10'; END IF;
  IF p_source NOT IN ('telegram', 'web', 'mini_app') THEN RAISE EXCEPTION 'Invalid source: must be telegram, web, or mini_app'; END IF;

  FOREACH v_emotion IN ARRAY p_emotions
  LOOP
    IF v_emotion NOT IN ('happy', 'calm', 'grateful', 'energetic', 'loved', 'hopeful',
                          'anxious', 'sad', 'angry', 'tired', 'stressed', 'lonely') THEN
      RAISE EXCEPTION 'Invalid emotion: %', v_emotion;
    END IF;
  END LOOP;

  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
    RAISE EXCEPTION 'Note too long: max 500 characters';
  END IF;

  -- ========================================
  -- Resolve unified_user_id from auth context using the FIXED helper function
  -- ========================================
  v_unified_user_id := current_unified_user_id();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION upsert_mood_entry IS 'Upsert daily mood entry. Resolves user from auth context using current_unified_user_id(). p_date allows frontend to pass client-local date (timezone fix). Validates all inputs before insert.';
