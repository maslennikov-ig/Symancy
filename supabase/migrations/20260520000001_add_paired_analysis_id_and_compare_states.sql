-- T2.1: Сравнение чашек (dynamics + compatibility)
-- Применено на prod через mcp__supabase__apply_migration 2026-05-20.

-- 1) analysis_history: paired_analysis_id + расширить allowed analysis_type
ALTER TABLE public.analysis_history
  ADD COLUMN IF NOT EXISTS paired_analysis_id UUID NULL
  REFERENCES public.analysis_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_history_paired_analysis_id
  ON public.analysis_history(paired_analysis_id)
  WHERE paired_analysis_id IS NOT NULL;

ALTER TABLE public.analysis_history
  DROP CONSTRAINT IF EXISTS analysis_history_analysis_type_check;

ALTER TABLE public.analysis_history
  ADD CONSTRAINT analysis_history_analysis_type_check
  CHECK (analysis_type = ANY (ARRAY[
    'basic'::text,
    'pro'::text,
    'cassandra'::text,
    'dynamics'::text,
    'compatibility'::text,
    'dynamics_first'::text,
    'compatibility_first'::text
  ]));

-- 2) user_states: новые поля для compare state machine
ALTER TABLE public.user_states
  ADD COLUMN IF NOT EXISTS pending_compare_type TEXT NULL
  CHECK (pending_compare_type IS NULL OR pending_compare_type IN ('dynamics', 'compatibility'));

ALTER TABLE public.user_states
  ADD COLUMN IF NOT EXISTS pending_first_analysis_id UUID NULL
  REFERENCES public.analysis_history(id) ON DELETE SET NULL;

ALTER TABLE public.user_states
  ADD COLUMN IF NOT EXISTS pending_compare_started_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.analysis_history.paired_analysis_id IS
  'Ссылка на первую чашку при сравнении (dynamics/compatibility). NULL для одиночных анализов.';

COMMENT ON COLUMN public.user_states.pending_compare_type IS
  'Активный режим сравнения: dynamics (Advanced) или compatibility (Premium). NULL когда нет активной сессии.';

COMMENT ON COLUMN public.user_states.pending_first_analysis_id IS
  'ID первой чашки в режиме сравнения. NULL до получения первого фото.';
