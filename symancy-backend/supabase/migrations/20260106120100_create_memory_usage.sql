-- Migration: 20260106120100_create_memory_usage.sql
-- Purpose: Track how often and where memories are used in context
-- This enables quality scoring, analytics, and memory relevance optimization

-- Memory Usage Tracking Table
CREATE TABLE IF NOT EXISTS memory_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES user_memories(id) ON DELETE CASCADE,
  used_in_context_type TEXT NOT NULL,  -- 'chat', 'morning_insight', 'evening_insight', 'interpretation'
  context_id TEXT,  -- Optional: ID of the context (conversation_id, insight_id, etc.)
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying usage by memory (most common query pattern)
CREATE INDEX idx_memory_usage_memory_id ON memory_usage(memory_id);

-- Index for time-based queries (analytics, recent usage)
CREATE INDEX idx_memory_usage_used_at ON memory_usage(used_at DESC);

-- Index for context type queries (filtering by usage type)
CREATE INDEX idx_memory_usage_context_type ON memory_usage(used_in_context_type);

-- Composite index for memory + time queries (usage frequency analysis)
CREATE INDEX idx_memory_usage_memory_id_used_at ON memory_usage(memory_id, used_at DESC);

-- Enable Row Level Security
ALTER TABLE memory_usage ENABLE ROW LEVEL SECURITY;

-- Service role can manage all usage records (backend operations)
CREATE POLICY "Service role full access to memory_usage"
  ON memory_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE memory_usage IS 'Tracks memory usage in various contexts for quality scoring and analytics';
COMMENT ON COLUMN memory_usage.memory_id IS 'FK to user_memories.id - the memory that was used';
COMMENT ON COLUMN memory_usage.used_in_context_type IS 'Context type: chat, morning_insight, evening_insight, interpretation';
COMMENT ON COLUMN memory_usage.context_id IS 'Optional reference to specific context (conversation_id, daily_insight_id, analysis_id)';
COMMENT ON COLUMN memory_usage.used_at IS 'Timestamp when the memory was used in context';
