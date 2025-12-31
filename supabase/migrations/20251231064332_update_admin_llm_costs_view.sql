-- Migration: 20251231064332_update_admin_llm_costs_view.sql
-- Purpose: Update admin_llm_costs view to unpivot Vision and Interpretation model data into separate rows
--
-- Changes:
-- - Create 2 rows per analysis: one for Vision model, one for Interpretation model
-- - Use UNION ALL to combine both model types
-- - Filter NULL model_used and vision_model_used to avoid empty rows

-- Drop existing view
DROP VIEW IF EXISTS admin_llm_costs;

-- Recreate view with UNPIVOT logic
CREATE OR REPLACE VIEW admin_llm_costs AS
-- Interpretation model rows (e.g., xiaomi/mimo-v2-flash:free, anthropic/claude-3.5-sonnet)
SELECT
  ah.unified_user_id,
  uu.display_name,
  uu.telegram_id,
  ah.model_used,
  date_trunc('day', ah.created_at) AS date,
  count(*) AS request_count,
  sum(COALESCE(ah.tokens_used, 0)) AS total_tokens,
  avg(COALESCE(ah.processing_time_ms, 0))::integer AS avg_processing_ms
FROM analysis_history ah
JOIN unified_users uu ON ah.unified_user_id = uu.id
WHERE
  ah.status = 'completed'
  AND ah.unified_user_id IS NOT NULL
  AND ah.model_used IS NOT NULL -- Only include rows with interpretation model
GROUP BY ah.unified_user_id, uu.display_name, uu.telegram_id, ah.model_used, date_trunc('day', ah.created_at)

UNION ALL

-- Vision model rows (e.g., google/gemini-3-flash-preview)
SELECT
  ah.unified_user_id,
  uu.display_name,
  uu.telegram_id,
  ah.vision_model_used AS model_used, -- Map vision_model_used to model_used column
  date_trunc('day', ah.created_at) AS date,
  count(*) AS request_count,
  sum(COALESCE(ah.vision_tokens_used, 0)) AS total_tokens, -- Map vision_tokens_used to total_tokens
  avg(COALESCE(ah.processing_time_ms, 0))::integer AS avg_processing_ms
FROM analysis_history ah
JOIN unified_users uu ON ah.unified_user_id = uu.id
WHERE
  ah.status = 'completed'
  AND ah.unified_user_id IS NOT NULL
  AND ah.vision_model_used IS NOT NULL -- Only include rows with vision model
GROUP BY ah.unified_user_id, uu.display_name, uu.telegram_id, ah.vision_model_used, date_trunc('day', ah.created_at);

-- Add comment explaining the view structure
COMMENT ON VIEW admin_llm_costs IS
'Admin view showing LLM costs with UNPIVOT logic. Each analysis creates 2 rows: one for Vision model (google/gemini-3-flash-preview) and one for Interpretation model (xiaomi/mimo-v2-flash:free or anthropic/claude-3.5-sonnet). This enables separate cost tracking per model type.';
