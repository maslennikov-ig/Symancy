-- Atomic account linking function
-- Handles the unique constraint on telegram_id by deleting telegram user first in a transaction
-- This function:
-- 1. Migrates analysis_history from telegram user to web user
-- 2. Migrates conversations from telegram user to web user
-- 3. Merges user_credits if both have auth_id
-- 4. Deletes the telegram user record (freeing up telegram_id)
-- 5. Updates web user with telegram_id
--
-- Used by: POST /api/auth/link (account linking endpoint)

CREATE OR REPLACE FUNCTION link_accounts(
  p_web_user_id UUID,
  p_telegram_user_id UUID
)
RETURNS TABLE (
  merged_user_id UUID,
  telegram_id BIGINT,
  credits_merged BOOLEAN,
  history_migrated INTEGER,
  conversations_migrated INTEGER
) AS $$
DECLARE
  v_telegram_id BIGINT;
  v_telegram_auth_id UUID;
  v_web_auth_id UUID;
  v_history_count INTEGER := 0;
  v_convo_count INTEGER := 0;
  v_credits_merged BOOLEAN := FALSE;
BEGIN
  -- Get telegram_id from telegram user
  SELECT u.telegram_id, u.auth_id INTO v_telegram_id, v_telegram_auth_id
  FROM unified_users u
  WHERE u.id = p_telegram_user_id;

  IF v_telegram_id IS NULL THEN
    RAISE EXCEPTION 'Telegram user not found or has no telegram_id';
  END IF;

  -- Get web user auth_id
  SELECT u.auth_id INTO v_web_auth_id
  FROM unified_users u
  WHERE u.id = p_web_user_id;

  -- Step 1: Migrate analysis_history
  UPDATE analysis_history
  SET unified_user_id = p_web_user_id
  WHERE unified_user_id = p_telegram_user_id;
  GET DIAGNOSTICS v_history_count = ROW_COUNT;

  -- Step 2: Migrate conversations
  UPDATE conversations
  SET unified_user_id = p_web_user_id
  WHERE unified_user_id = p_telegram_user_id;
  GET DIAGNOSTICS v_convo_count = ROW_COUNT;

  -- Step 3: Merge credits if both have auth_id
  IF v_telegram_auth_id IS NOT NULL AND v_web_auth_id IS NOT NULL THEN
    -- Sum credits from telegram user to web user
    UPDATE user_credits uc_target
    SET
      credits_basic = uc_target.credits_basic + COALESCE(uc_source.credits_basic, 0),
      credits_pro = uc_target.credits_pro + COALESCE(uc_source.credits_pro, 0),
      credits_cassandra = uc_target.credits_cassandra + COALESCE(uc_source.credits_cassandra, 0),
      updated_at = NOW()
    FROM user_credits uc_source
    WHERE uc_target.user_id = v_web_auth_id
      AND uc_source.user_id = v_telegram_auth_id;

    IF FOUND THEN
      -- Delete source credits after merge
      DELETE FROM user_credits WHERE user_id = v_telegram_auth_id;
      v_credits_merged := TRUE;
    END IF;
  END IF;

  -- Step 4: Delete the telegram user record (this frees up telegram_id)
  DELETE FROM unified_users WHERE id = p_telegram_user_id;

  -- Step 5: Update web user with telegram_id
  UPDATE unified_users
  SET
    telegram_id = v_telegram_id,
    is_telegram_linked = TRUE,
    updated_at = NOW()
  WHERE id = p_web_user_id;

  -- Return results
  RETURN QUERY SELECT
    p_web_user_id,
    v_telegram_id,
    v_credits_merged,
    v_history_count,
    v_convo_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION link_accounts IS 'Atomically links Telegram account to web account by merging data and updating telegram_id';
