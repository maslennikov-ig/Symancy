-- Migration: 20260525000040_harden_rpc_execute_grants.sql
-- Purpose: Fix Supabase security advisor findings for the two new SECURITY DEFINER
-- RPCs. Postgres grants EXECUTE to PUBLIC by default, which exposed:
--   * admin_update_prompt — callable by anon (is_admin() guard still blocks it,
--     but anon should not have EXECUTE at all).
--   * increment_user_streak — callable by anon/authenticated with NO internal guard,
--     allowing arbitrary streak inflation for any unified_user_id via REST.
-- Lock both down to their intended callers only.

-- admin_update_prompt: only authenticated admins (guard is inside via is_admin()).
REVOKE EXECUTE ON FUNCTION public.admin_update_prompt(text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_prompt(text, text, boolean) FROM anon;

-- increment_user_streak: backend (service_role) only. No public REST exposure.
REVOKE EXECUTE ON FUNCTION public.increment_user_streak(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_user_streak(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_user_streak(uuid) FROM authenticated;
