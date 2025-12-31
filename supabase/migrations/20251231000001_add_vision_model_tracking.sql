-- Migration: 20251231000001_add_vision_model_tracking.sql
-- Purpose: Add Vision model tracking fields to analysis_history table
--
-- Context:
--   Currently analysis_history only tracks the interpretation model (Arina/Cassandra)
--   via model_used and tokens_used fields. However, the actual analysis pipeline uses
--   TWO models:
--   1. Vision Model (Gemini) - for image recognition and pattern detection
--   2. Interpretation Model (Arina/Cassandra via Xiaomi) - for generating the reading
--
-- These new fields will enable:
--   - Separate cost tracking for Vision vs Interpretation models
--   - Accurate reporting on /admin/costs page
--   - Better usage analytics and optimization opportunities
--
-- Fields added:
--   - vision_model_used: Name of the Vision model (e.g., "google/gemini-3-flash-preview")
--   - vision_tokens_used: Token count consumed by Vision model (default 0)

-- Add vision_model_used column
-- This stores the Vision model name (e.g., "google/gemini-3-flash-preview")
ALTER TABLE analysis_history
ADD COLUMN vision_model_used TEXT NULL;

COMMENT ON COLUMN analysis_history.vision_model_used IS
'Vision model used for image recognition (e.g., google/gemini-3-flash-preview). Separate from model_used which tracks the interpretation model (Arina/Cassandra).';

-- Add vision_tokens_used column
-- This stores the token count consumed by the Vision model
ALTER TABLE analysis_history
ADD COLUMN vision_tokens_used INTEGER NULL DEFAULT 0;

COMMENT ON COLUMN analysis_history.vision_tokens_used IS
'Token count consumed by Vision model for image recognition. Separate from tokens_used which tracks the interpretation model tokens.';

-- Add check constraint to ensure non-negative tokens
ALTER TABLE analysis_history
ADD CONSTRAINT vision_tokens_used_non_negative
CHECK (vision_tokens_used >= 0);

-- Create index for cost analytics queries
-- This will speed up queries on /admin/costs page that filter by vision model
CREATE INDEX IF NOT EXISTS idx_analysis_history_vision_model
ON analysis_history(vision_model_used)
WHERE vision_model_used IS NOT NULL;

-- Create composite index for cost reporting by date and model
CREATE INDEX IF NOT EXISTS idx_analysis_history_costs_reporting
ON analysis_history(created_at DESC, model_used, vision_model_used)
WHERE status = 'completed';
