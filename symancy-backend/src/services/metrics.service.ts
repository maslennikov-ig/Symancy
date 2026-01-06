/**
 * Metrics Service
 * Tracks application metrics for insights, API calls, embeddings, etc.
 *
 * Uses the system_metrics table:
 * - metric_type: 'insight', 'memory', 'api', 'embedding'
 * - metric_name: 'generation_latency_ms', 'tokens_used', etc.
 * - metric_value: numeric value
 * - tags: { user_id, job_type, language, ... }
 */
import { getSupabase } from "../core/database.js";
import { getLogger } from "../core/logger.js";

const logger = getLogger().child({ module: "metrics-service" });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Metric type categories
 */
export type MetricType = "insight" | "memory" | "api" | "embedding" | "queue";

/**
 * Common metric names for type safety
 */
export type InsightMetricName =
  | "generation_latency_ms"
  | "total_processing_time_ms"
  | "tokens_used"
  | "success_count"
  | "error_count"
  | "fallback_used_count";

export type MemoryMetricName =
  | "search_latency_ms"
  | "add_latency_ms"
  | "results_count";

export type ApiMetricName =
  | "request_latency_ms"
  | "response_size_bytes";

export type EmbeddingMetricName =
  | "generation_latency_ms"
  | "dimensions";

export type QueueMetricName =
  | "job_processing_time_ms"
  | "jobs_dispatched"
  | "jobs_failed";

/**
 * Union type for all metric names
 */
export type MetricName =
  | InsightMetricName
  | MemoryMetricName
  | ApiMetricName
  | EmbeddingMetricName
  | QueueMetricName
  | string; // Allow custom metric names

/**
 * Common tags for metrics
 */
export interface MetricTags {
  user_id?: string;
  job_type?: string;
  language?: string;
  timezone?: string;
  persona?: string;
  error_type?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Single metric record
 */
export interface MetricRecord {
  type: MetricType;
  name: MetricName;
  value: number;
  tags?: MetricTags;
}

/**
 * Timer for measuring durations
 */
export interface MetricTimer {
  start: number;
  elapsed: () => number;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Record a single metric
 *
 * @param type - Metric type category (insight, memory, api, embedding)
 * @param name - Metric name (generation_latency_ms, tokens_used, etc.)
 * @param value - Numeric value
 * @param tags - Optional tags for filtering/grouping
 *
 * @example
 * await recordMetric('insight', 'generation_latency_ms', 1234, {
 *   user_id: userId,
 *   job_type: 'morning',
 *   language: 'ru'
 * });
 */
export async function recordMetric(
  type: MetricType,
  name: MetricName,
  value: number,
  tags?: MetricTags
): Promise<void> {
  try {
    const supabase = getSupabase();

    // Filter out undefined values from tags
    const cleanTags = tags
      ? Object.fromEntries(
          Object.entries(tags).filter(([, v]) => v !== undefined)
        )
      : null;

    const { error } = await supabase.from("system_metrics").insert({
      metric_type: type,
      metric_name: name,
      metric_value: value,
      tags: cleanTags,
    });

    if (error) {
      logger.warn(
        { error: error.message, type, name, value },
        "Failed to record metric"
      );
    }
  } catch (error) {
    // Log but don't throw - metrics should not break the main flow
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), type, name },
      "Error recording metric"
    );
  }
}

/**
 * Record multiple metrics in a single batch insert
 * More efficient for recording many metrics at once
 *
 * @param metrics - Array of metric records
 *
 * @example
 * await recordMetricBatch([
 *   { type: 'insight', name: 'generation_latency_ms', value: 1234, tags: { job_type: 'morning' } },
 *   { type: 'insight', name: 'tokens_used', value: 500, tags: { job_type: 'morning' } },
 * ]);
 */
export async function recordMetricBatch(metrics: MetricRecord[]): Promise<void> {
  if (metrics.length === 0) return;

  try {
    const supabase = getSupabase();

    const records = metrics.map((m) => ({
      metric_type: m.type,
      metric_name: m.name,
      metric_value: m.value,
      tags: m.tags
        ? Object.fromEntries(
            Object.entries(m.tags).filter(([, v]) => v !== undefined)
          )
        : null,
    }));

    const { error } = await supabase.from("system_metrics").insert(records);

    if (error) {
      logger.warn(
        { error: error.message, count: metrics.length },
        "Failed to record metric batch"
      );
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), count: metrics.length },
      "Error recording metric batch"
    );
  }
}

// =============================================================================
// TIMING HELPERS
// =============================================================================

/**
 * Start a timer for measuring duration
 *
 * @returns Timer object with start time and elapsed function
 *
 * @example
 * const timer = startTimer();
 * // ... do work ...
 * await recordDuration('insight', 'total_processing_time_ms', timer, { job_type: 'morning' });
 */
export function startTimer(): MetricTimer {
  const start = performance.now();
  return {
    start,
    elapsed: () => Math.round(performance.now() - start),
  };
}

/**
 * Record the elapsed duration from a timer
 *
 * @param type - Metric type category
 * @param name - Metric name (should indicate ms)
 * @param timer - Timer started with startTimer()
 * @param tags - Optional tags
 *
 * @example
 * const timer = startTimer();
 * await generateMorningAdvice(...);
 * await recordDuration('insight', 'generation_latency_ms', timer, { user_id: userId });
 */
export async function recordDuration(
  type: MetricType,
  name: MetricName,
  timer: MetricTimer,
  tags?: MetricTags
): Promise<void> {
  const elapsed = timer.elapsed();
  await recordMetric(type, name, elapsed, tags);
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Record a success count (increments by 1)
 */
export async function recordSuccess(
  type: MetricType,
  tags?: MetricTags
): Promise<void> {
  await recordMetric(type, "success_count", 1, tags);
}

/**
 * Record an error count (increments by 1)
 */
export async function recordError(
  type: MetricType,
  tags?: MetricTags
): Promise<void> {
  await recordMetric(type, "error_count", 1, tags);
}

/**
 * Record a fallback usage count (increments by 1)
 */
export async function recordFallback(
  type: MetricType,
  tags?: MetricTags
): Promise<void> {
  await recordMetric(type, "fallback_used_count", 1, tags);
}

/**
 * Record tokens used
 */
export async function recordTokens(
  type: MetricType,
  tokens: number,
  tags?: MetricTags
): Promise<void> {
  await recordMetric(type, "tokens_used", tokens, tags);
}
