-- Migration: 20260219000001_fix_function_search_paths.sql
-- Purpose: Fix mutable search_path for all public schema functions
-- Resolves: Supabase Advisor WARN function_search_path_mutable
--
-- A mutable search_path on a function can allow an attacker to change the
-- behavior of the function by creating objects in a schema that appears
-- earlier in the search_path. Setting search_path = public explicitly
-- makes the function immune to search_path manipulation attacks.

-- 1. get_telegram_id_from_jwt()
ALTER FUNCTION public.get_telegram_id_from_jwt()
  SET search_path = public;

-- 2. admin_adjust_credits(uuid, integer, integer, integer, text)
ALTER FUNCTION public.admin_adjust_credits(p_unified_user_id uuid, p_basic_delta integer, p_pro_delta integer, p_cassandra_delta integer, p_reason text)
  SET search_path = public;

-- 3. get_current_admin_email()
ALTER FUNCTION public.get_current_admin_email()
  SET search_path = public;

-- 4. search_user_memories(bigint, text, integer)
ALTER FUNCTION public.search_user_memories(user_id bigint, query_embedding text, match_limit integer)
  SET search_path = public;

-- 5. find_or_create_user_by_auth_id(uuid, text, text)
ALTER FUNCTION public.find_or_create_user_by_auth_id(p_auth_id uuid, p_display_name text, p_language_code text)
  SET search_path = public;

-- 6. link_accounts(uuid, uuid)
ALTER FUNCTION public.link_accounts(p_web_user_id uuid, p_telegram_user_id uuid)
  SET search_path = public;

-- 7. current_unified_user_id()
ALTER FUNCTION public.current_unified_user_id()
  SET search_path = public;

-- 8. consume_linked_credits(uuid, integer)
ALTER FUNCTION public.consume_linked_credits(p_user_id uuid, p_amount integer)
  SET search_path = public;

-- 9. refund_linked_credits(uuid, integer)
ALTER FUNCTION public.refund_linked_credits(p_user_id uuid, p_amount integer)
  SET search_path = public;

-- 10. has_unified_credit(bigint, text)
ALTER FUNCTION public.has_unified_credit(p_telegram_id bigint, p_credit_type text)
  SET search_path = public;

-- 11. consume_unified_credit(bigint, text)
ALTER FUNCTION public.consume_unified_credit(p_telegram_id bigint, p_credit_type text)
  SET search_path = public;

-- 12. upsert_mood_entry(date, smallint, text[], text, text)
ALTER FUNCTION public.upsert_mood_entry(p_date date, p_score smallint, p_emotions text[], p_note text, p_source text)
  SET search_path = public;

-- 13. refund_unified_credit(bigint, text)
ALTER FUNCTION public.refund_unified_credit(p_telegram_id bigint, p_credit_type text)
  SET search_path = public;

-- 14. get_unified_credits(bigint)
ALTER FUNCTION public.get_unified_credits(p_telegram_id bigint)
  SET search_path = public;

-- 15. increment_invalid_count(bigint)
ALTER FUNCTION public.increment_invalid_count(p_telegram_user_id bigint)
  SET search_path = public;

-- 16. get_invalid_count(bigint)
ALTER FUNCTION public.get_invalid_count(p_telegram_user_id bigint)
  SET search_path = public;

-- 17. is_admin_by_auth_id(uuid)
ALTER FUNCTION public.is_admin_by_auth_id(p_auth_id uuid)
  SET search_path = public;

-- 18. update_updated_at_column()
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public;

-- 19. update_user_credits_updated_at()
ALTER FUNCTION public.update_user_credits_updated_at()
  SET search_path = public;

-- 20. grant_credits(uuid, text, integer)
ALTER FUNCTION public.grant_credits(p_user_id uuid, p_product_type text, p_credits integer)
  SET search_path = public;

-- 21. is_admin()
ALTER FUNCTION public.is_admin()
  SET search_path = public;

-- 22. consume_credit(uuid, text)
ALTER FUNCTION public.consume_credit(p_user_id uuid, p_credit_type text)
  SET search_path = public;

-- 23. handle_auth_user_created() - trigger function
ALTER FUNCTION public.handle_auth_user_created()
  SET search_path = public;

-- 24. handle_unified_user_created() - trigger function
ALTER FUNCTION public.handle_unified_user_created()
  SET search_path = public;

-- 25. handle_unified_user_linked() - trigger function
ALTER FUNCTION public.handle_unified_user_linked()
  SET search_path = public;

-- 26. merge_user_credits(uuid, uuid)
ALTER FUNCTION public.merge_user_credits(source_user_id uuid, target_user_id uuid)
  SET search_path = public;
