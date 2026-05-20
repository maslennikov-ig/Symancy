-- Cover the new FK from migration 20260520000001 for advisors.
-- Applied to prod via mcp__supabase__apply_migration 2026-05-20.

CREATE INDEX IF NOT EXISTS idx_user_states_pending_first_analysis_id
  ON public.user_states(pending_first_analysis_id)
  WHERE pending_first_analysis_id IS NOT NULL;
