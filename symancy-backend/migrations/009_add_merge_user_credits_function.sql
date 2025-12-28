-- Migration: 009_add_merge_user_credits_function.sql
-- Purpose: Create atomic credit merge function for account linking
--
-- This function atomically merges credits from a source user to a target user,
-- eliminating race conditions and N+1 query patterns in the account linking flow.
--
-- The function:
-- 1. Locks the source credits row to prevent concurrent modifications
-- 2. Adds source credits to target credits in a single atomic operation
-- 3. Deletes the source credits record
-- 4. Returns the merged totals for logging
--
-- Used by: POST /api/auth/link (account linking endpoint)

-- Create the atomic credit merge function
CREATE OR REPLACE FUNCTION merge_user_credits(
  source_user_id uuid,
  target_user_id uuid
)
RETURNS TABLE (
  merged_basic integer,
  merged_pro integer,
  merged_cassandra integer,
  source_deleted boolean
) AS $$
DECLARE
  source_credits record;
  target_exists boolean;
BEGIN
  -- Check if target user has a credits record
  SELECT EXISTS(
    SELECT 1 FROM user_credits WHERE user_id = target_user_id
  ) INTO target_exists;

  -- If target has no credits record, we can't merge (target should exist)
  IF NOT target_exists THEN
    -- Return zeros indicating no merge occurred
    RETURN QUERY SELECT 0::integer, 0::integer, 0::integer, false;
    RETURN;
  END IF;

  -- Lock and get source credits (FOR UPDATE prevents race conditions)
  SELECT basic_credits, pro_credits, cassandra_credits
  INTO source_credits
  FROM user_credits
  WHERE user_id = source_user_id
  FOR UPDATE;

  -- If source has no credits, return current target credits
  IF source_credits IS NULL THEN
    RETURN QUERY
    SELECT
      uc.basic_credits,
      uc.pro_credits,
      uc.cassandra_credits,
      false
    FROM user_credits uc
    WHERE uc.user_id = target_user_id;
    RETURN;
  END IF;

  -- Add source credits to target (atomic update)
  UPDATE user_credits
  SET
    basic_credits = basic_credits + source_credits.basic_credits,
    pro_credits = pro_credits + source_credits.pro_credits,
    cassandra_credits = cassandra_credits + source_credits.cassandra_credits,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Delete source credits record
  DELETE FROM user_credits WHERE user_id = source_user_id;

  -- Return the merged totals and success flag
  RETURN QUERY
  SELECT
    uc.basic_credits,
    uc.pro_credits,
    uc.cassandra_credits,
    true
  FROM user_credits uc
  WHERE uc.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Add comment for documentation
COMMENT ON FUNCTION merge_user_credits(uuid, uuid) IS
'Atomically merges credits from source user to target user during account linking.
Returns merged totals and whether source was deleted. Uses row-level locking to prevent race conditions.';

-- Grant execute permission to service role (used by backend)
GRANT EXECUTE ON FUNCTION merge_user_credits(uuid, uuid) TO service_role;

-- Grant execute permission to authenticated users (for RLS context)
GRANT EXECUTE ON FUNCTION merge_user_credits(uuid, uuid) TO authenticated;
