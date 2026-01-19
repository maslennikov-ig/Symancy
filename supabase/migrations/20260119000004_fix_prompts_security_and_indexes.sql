-- Migration: fix_prompts_security_and_indexes
-- Purpose: Fix code review issues for prompts table
-- HIGH-3: Remove anon RLS policy (security fix)
-- MEDIUM-1: Replace separate indexes with composite index (performance)
-- LOW-1: Add column comments (documentation)

-- =============================================================================
-- HIGH-3: Remove anon RLS policy
-- Rationale: Anonymous users should NOT have access to prompts.
-- Only authenticated users and service_role should access prompts.
-- =============================================================================
DROP POLICY IF EXISTS "Anon can read active prompts" ON prompts;

-- =============================================================================
-- MEDIUM-1: Composite index for key + is_active queries
-- Rationale: Queries typically filter by both key AND is_active together.
-- A composite partial index is more efficient than two separate indexes.
-- =============================================================================

-- Drop individual indexes (redundant with composite index)
DROP INDEX IF EXISTS idx_prompts_key;
DROP INDEX IF EXISTS idx_prompts_is_active;

-- Create composite partial index for common query pattern:
-- SELECT * FROM prompts WHERE key = ? AND is_active = true
CREATE INDEX idx_prompts_key_active ON prompts(key, is_active) WHERE is_active = true;

-- =============================================================================
-- LOW-1: Add column comments for documentation
-- Rationale: Improve schema discoverability and documentation.
-- =============================================================================
COMMENT ON COLUMN prompts.id IS 'Primary key (UUID)';
COMMENT ON COLUMN prompts.created_at IS 'Timestamp when prompt was created';
COMMENT ON COLUMN prompts.updated_at IS 'Timestamp of last update (auto-updated by trigger)';
