-- Migration: 20260525000010_admin_update_prompt_rpc.sql
-- Purpose: Create admin_update_prompt RPC for prompt management in admin panel.
-- Context: RLS on `prompts` table only allows writes from service_role.
--   Authenticated admins cannot do direct UPDATE → need SECURITY DEFINER RPC.
--
-- Follows the same pattern as is_admin() + SECURITY DEFINER used throughout
-- this codebase (see admin_adjust_credits, admin_toggle_ban, etc.).

CREATE OR REPLACE FUNCTION public.admin_update_prompt(
  p_key        text,
  p_content    text,
  p_is_active  boolean
)
RETURNS TABLE(
  id          uuid,
  key         text,
  content     text,
  description text,
  is_active   boolean,
  version     integer,
  updated_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Guard: only admins may call this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  -- Validate key
  IF p_key NOT IN ('vision', 'arina', 'cassandra') THEN
    RAISE EXCEPTION 'Invalid prompt key: %. Must be one of vision, arina, cassandra', p_key;
  END IF;

  -- Validate content is not empty
  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Content cannot be empty';
  END IF;

  -- Update the prompt row, incrementing version and refreshing updated_at
  RETURN QUERY
  UPDATE prompts
  SET
    content    = p_content,
    is_active  = p_is_active,
    version    = prompts.version + 1,
    updated_at = NOW()
  WHERE prompts.key = p_key
  RETURNING
    prompts.id,
    prompts.key,
    prompts.content,
    prompts.description,
    prompts.is_active,
    prompts.version,
    prompts.updated_at;

  -- If no row was updated, the key does not exist in the table
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt with key "%" not found', p_key;
  END IF;
END;
$$;

-- Only authenticated role needs EXECUTE; service_role has it implicitly.
-- Anon should never call admin functions.
GRANT EXECUTE ON FUNCTION public.admin_update_prompt(text, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_update_prompt(text, text, boolean) IS
  'Admin-only RPC to update a prompt by key. Checks is_admin(), increments version, updates updated_at. '
  'Bypasses RLS (SECURITY DEFINER) because the prompts table only allows service_role to write.';
