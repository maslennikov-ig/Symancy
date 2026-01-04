-- Migration: 20260104_rls_and_index_fixes.sql
-- Purpose: Add RLS verification documentation and composite index for daily_insights idempotency
-- Code Review Issues: F3 (RLS Policy Verification), F8 (Composite Index for daily_insights)

-- ============================================================================
-- F3: RLS Policy Verification for unified_users
-- ============================================================================
--
-- VERIFICATION COMPLETE: unified_users table already has RLS properly configured.
--
-- Existing policies (verified 2026-01-04):
-- 1. "Service role has full access to unified_users" - ALL operations for service_role
-- 2. "Telegram users can view own unified_users record" - SELECT for authenticated (telegram_id match)
-- 3. "Users can update their own unified_users record" - UPDATE for authenticated (auth_id match)
-- 4. "Users can view their own unified_users record" - SELECT for authenticated (auth_id match)
-- 5. "admin_select_unified_users" - SELECT for authenticated admins (is_admin())
--
-- Security Model:
-- - Backend API uses service_role key which bypasses RLS for internal operations
-- - Web users authenticated via Supabase Auth can only access their own records via auth_id
-- - Telegram users with custom JWT can access their records via telegram_id
-- - notification_settings and timezone columns are protected by these policies
--
-- No changes needed - documenting for audit trail.

-- Add/update documentation comment on unified_users table
COMMENT ON TABLE unified_users IS
'Central identity hub unifying all channel identities (Telegram, Web, WhatsApp, WeChat).
RLS enabled with policies for service_role (full access), authenticated users (own record via auth_id),
Telegram users (own record via telegram_id from JWT), and admins (read access via is_admin()).
Backend API uses service_role key for internal operations, bypassing RLS.';

-- ============================================================================
-- F8: Composite Index for daily_insights Idempotency Checks
-- ============================================================================
--
-- VERIFICATION: Existing indexes on daily_insights:
-- 1. daily_insights_pkey - PRIMARY KEY on (id)
-- 2. daily_insights_unified_user_id_date_key - UNIQUE on (unified_user_id, date)
-- 3. idx_daily_insights_user_date - INDEX on (unified_user_id, date DESC)
--
-- The unique constraint already serves as an efficient index for idempotency checks.
-- Adding a partial index for checking if morning insight was already sent.

-- Partial index for checking if morning insight was already sent
-- Query pattern: SELECT id FROM daily_insights WHERE unified_user_id = ? AND date = ? AND morning_sent_at IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_daily_insights_morning_sent
ON daily_insights(unified_user_id, date)
WHERE morning_sent_at IS NOT NULL;

COMMENT ON INDEX idx_daily_insights_morning_sent IS
'Partial index for efficient check if morning insight was already sent for a specific user and date.
Used by morning-insight-single worker for idempotency: WHERE unified_user_id = ? AND date = ? AND morning_sent_at IS NOT NULL';

-- Partial index for checking if evening insight was already sent
-- Query pattern: SELECT id FROM daily_insights WHERE unified_user_id = ? AND date = ? AND evening_sent_at IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_daily_insights_evening_sent
ON daily_insights(unified_user_id, date)
WHERE evening_sent_at IS NOT NULL;

COMMENT ON INDEX idx_daily_insights_evening_sent IS
'Partial index for efficient check if evening insight was already sent for a specific user and date.
Used by evening-insight-single worker for idempotency: WHERE unified_user_id = ? AND date = ? AND evening_sent_at IS NOT NULL';

-- ============================================================================
-- Summary of Changes
-- ============================================================================
--
-- F3 (RLS Policy Verification):
-- - Verified: RLS is enabled on unified_users with 5 comprehensive policies
-- - Added: Updated table comment documenting security model
-- - Status: NO SCHEMA CHANGES - documentation only
--
-- F8 (Composite Index for daily_insights):
-- - Verified: Composite unique constraint exists on (unified_user_id, date)
-- - Added: Partial index idx_daily_insights_morning_sent for morning idempotency
-- - Added: Partial index idx_daily_insights_evening_sent for evening idempotency
-- - Status: 2 NEW PARTIAL INDEXES added for query optimization
