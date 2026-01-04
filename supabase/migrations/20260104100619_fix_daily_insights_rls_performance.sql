-- Migration: fix_daily_insights_rls_performance.sql
-- Purpose: Optimize RLS policies for daily_insights table to prevent per-row re-evaluation
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own insights" ON daily_insights;
DROP POLICY IF EXISTS "Service role full access" ON daily_insights;
DROP POLICY IF EXISTS "Telegram users can read own insights" ON daily_insights;

-- Policy 1: Users can read their own insights via auth.uid() (optimized)
-- Wrapping in (SELECT ...) prevents re-evaluation for each row
CREATE POLICY "Users can read own insights" ON daily_insights
  FOR SELECT USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE auth_id = (SELECT auth.uid())
    )
  );

-- Policy 2: Service role has full access for background jobs (optimized)
CREATE POLICY "Service role full access" ON daily_insights
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- Policy 3: Telegram JWT users can read their own insights (optimized)
CREATE POLICY "Telegram users can read own insights" ON daily_insights
  FOR SELECT USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE telegram_id = ((SELECT auth.jwt()) ->> 'telegram_user_id')::bigint
    )
  );
