-- Migration: 20260221000002_fix_db_lints.sql
-- Purpose: Fix security and performance lints reported by Supabase Advisors

-- 1. Unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_credit_transactions_unified_user_id ON public.credit_transactions(unified_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_analytics_user_id ON public.payment_analytics(user_id);

-- 2. Function Search Path Mutable
ALTER FUNCTION public.current_unified_user_id() SET search_path = public;

-- 3. RLS Policy Always True (Security fixes)
-- admin_audit_log
DROP POLICY IF EXISTS "admin_audit_log_write" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_write" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- payment_analytics
DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON public.payment_analytics;
CREATE POLICY "Authenticated users can insert analytics" ON public.payment_analytics
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 4. Auth RLS Initplan & Multiple Permissive Policies (Performance fixes)
-- For purchases
DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.purchases;
CREATE POLICY "Users can view own purchases" ON public.purchases
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_admin()
  );

-- For user_credits (deprecated table)
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- For admin_emails
DROP POLICY IF EXISTS "Service role full access" ON public.admin_emails;
CREATE POLICY "Service role full access" ON public.admin_emails
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- For analysis_history (Consolidate overlapping policies)
DROP POLICY IF EXISTS "Users can view own analyses via telegram_id" ON public.analysis_history;
DROP POLICY IF EXISTS "Users can view own analyses via unified_user_id" ON public.analysis_history;
DROP POLICY IF EXISTS "Telegram users can view own analyses via unified_user" ON public.analysis_history;
DROP POLICY IF EXISTS "Users can view own analysis history" ON public.analysis_history;
DROP POLICY IF EXISTS "No anon access to analysis_history" ON public.analysis_history;

CREATE POLICY "Users can view own analysis history" ON public.analysis_history
  FOR SELECT TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
    OR telegram_user_id = COALESCE(
      ((SELECT auth.jwt()) ->> 'telegram_id'),
      ((SELECT auth.jwt()) ->> 'telegram_user_id')
    )::bigint
  );

-- For unified_user_credits
DROP POLICY IF EXISTS "Users can view their own credits" ON public.unified_user_credits;
DROP POLICY IF EXISTS "Telegram users can view own credits" ON public.unified_user_credits;
DROP POLICY IF EXISTS "admin_select_unified_user_credits" ON public.unified_user_credits;

CREATE POLICY "Users can view their own credits" ON public.unified_user_credits
  FOR SELECT TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  );

-- For credit_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Admins can view all credit transactions" ON public.credit_transactions;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  );

-- For conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
DROP POLICY IF EXISTS "admin_select_conversations" ON public.conversations;

CREATE POLICY "Users can manage own conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  )
  WITH CHECK (
    unified_user_id = (SELECT current_unified_user_id())
    OR is_admin()
  );

-- For messages
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "admin_select_messages" ON public.messages;

CREATE POLICY "Users can manage own messages" ON public.messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.unified_user_id = (SELECT current_unified_user_id()) OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.unified_user_id = (SELECT current_unified_user_id()) OR is_admin())
    )
  );

-- For daily_insights
DROP POLICY IF EXISTS "Users can read own insights" ON public.daily_insights;
DROP POLICY IF EXISTS "Telegram users can read own insights" ON public.daily_insights;

CREATE POLICY "Users can read own insights" ON public.daily_insights
  FOR SELECT TO authenticated
  USING (
    unified_user_id = (SELECT current_unified_user_id())
  );

-- For unified_users
DROP POLICY IF EXISTS "Users can view their own unified_users record" ON public.unified_users;
DROP POLICY IF EXISTS "Telegram users can view own unified_users record" ON public.unified_users;
DROP POLICY IF EXISTS "Users can update their own unified_users record" ON public.unified_users;
DROP POLICY IF EXISTS "admin_select_unified_users" ON public.unified_users;

CREATE POLICY "Users can view their own unified_users record" ON public.unified_users
  FOR SELECT TO authenticated
  USING (
    id = (SELECT current_unified_user_id())
    OR is_admin()
  );

CREATE POLICY "Users can update their own unified_users record" ON public.unified_users
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT current_unified_user_id())
    OR is_admin()
  )
  WITH CHECK (
    id = (SELECT current_unified_user_id())
    OR is_admin()
  );
