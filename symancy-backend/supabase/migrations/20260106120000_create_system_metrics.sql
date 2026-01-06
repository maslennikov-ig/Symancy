-- Migration: 20260106120000_create_system_metrics.sql
-- Purpose: Create system_metrics table for tracking application metrics
-- (latency, token usage, success rates for insights, memory, API, embeddings)

-- ============================================================================
-- System Metrics Table
-- ============================================================================
-- Tracks application metrics like latency, token usage, success rates
-- for monitoring insight generation, memory operations, and API performance.

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metric classification
  metric_type TEXT NOT NULL,  -- 'insight', 'memory', 'api', 'embedding'
  metric_name TEXT NOT NULL,  -- 'generation_latency_ms', 'tokens_used', 'success_count', etc.
  metric_value NUMERIC NOT NULL,

  -- Flexible tagging for filtering/grouping
  tags JSONB,  -- { "user_id": "...", "job_type": "morning", "language": "ru" }

  -- Timestamp for time-series queries
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for Efficient Time-Series Queries
-- ============================================================================

-- Primary index for queries by metric type over time
CREATE INDEX idx_metrics_type_recorded ON system_metrics(metric_type, recorded_at DESC);

-- Index for queries by metric name over time
CREATE INDEX idx_metrics_name_recorded ON system_metrics(metric_name, recorded_at DESC);

-- Partitioning-friendly index for date range queries
CREATE INDEX idx_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
-- Service role only: backend writes metrics, no public/user access

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert/select/update/delete metrics (no public access)
-- Note: service_role bypasses RLS by default, but explicit policy provides clarity
CREATE POLICY "Service role full access to metrics"
  ON system_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE system_metrics IS 'Application metrics for monitoring insight generation, memory operations, and API performance';
COMMENT ON COLUMN system_metrics.metric_type IS 'Category of metric: insight, memory, api, embedding';
COMMENT ON COLUMN system_metrics.metric_name IS 'Specific metric: generation_latency_ms, tokens_used, success_count, error_count, etc.';
COMMENT ON COLUMN system_metrics.metric_value IS 'Numeric value of the metric';
COMMENT ON COLUMN system_metrics.tags IS 'JSONB tags for filtering: user_id, job_type, language, model, etc.';
COMMENT ON COLUMN system_metrics.recorded_at IS 'Timestamp when metric was recorded (for time-series queries)';
