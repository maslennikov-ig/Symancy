-- Migration: 20260221000001_fix_recent_activity_rls.sql
-- Purpose: Fix empty "Recent Activity" in Telegram Mini App by adding missing RLS policies
--          and fixing the current_unified_user_id() helper function for Telegram JWTs.

-- ============================================================================
-- 1. Fix current_unified_user_id() Helper Function
-- ============================================================================
-- The previous version looked for 'telegram_user_id' in the JWT, but JwtService
-- sets the claim as 'telegram_id'. It also didn't account for the fact that
-- auth.uid() directly contains the unifiedUserId for Telegram custom JWTs.

CREATE OR REPLACE FUNCTION current_unified_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_telegram_id BIGINT;
BEGIN
  -- First try: The user might be a Supabase Auth user (web login)
  -- In this case, auth.uid() is their Supabase Auth ID.
  SELECT id INTO v_user_id
  FROM unified_users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- Second try: The user might be a Telegram JWT user (custom token)
  -- The JwtService sets telegram_id, not telegram_user_id. We check both for safety.
  IF v_user_id IS NULL THEN
    v_telegram_id := COALESCE(
      (auth.jwt() ->> 'telegram_id'),
      (auth.jwt() ->> 'telegram_user_id')
    )::bigint;

    IF v_telegram_id IS NOT NULL THEN
      SELECT id INTO v_user_id
      FROM unified_users
      WHERE telegram_id = v_telegram_id
      LIMIT 1;
    END IF;
  END IF;

  -- Third try: The Telegram custom JWT sets `sub` (which becomes auth.uid()) to `unifiedUserId`.
  -- So auth.uid() might directly be the unified_users.id.
  IF v_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM unified_users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION current_unified_user_id IS 'Resolves current user unified_user_id from auth context (Supabase Auth or Telegram JWT). Fixed to support Telegram JWTs correctly. STABLE for RLS caching.';

-- ============================================================================
-- 2. Add Missing RLS Policies for analysis_history
-- ============================================================================
-- This policy allows authenticated users to read their own analysis history,
-- which fixes the "empty Recent Activity" issue in the Mini App.

-- Drop if exists just in case it was created manually with a different name
DROP POLICY IF EXISTS "Users can view own analysis history" ON analysis_history;
DROP POLICY IF EXISTS "Users can view own analysis" ON analysis_history;

-- Create the new SELECT policy
CREATE POLICY "Users can view own analysis history" ON analysis_history
  FOR SELECT
  TO authenticated
  USING (
    -- Match either by unified_user_id (new architecture)...
    unified_user_id = (SELECT current_unified_user_id())
    OR
    -- ...or fallback to telegram_user_id for unmigrated data
    telegram_user_id = COALESCE(
      (auth.jwt() ->> 'telegram_id'),
      (auth.jwt() ->> 'telegram_user_id')
    )::bigint
  );
