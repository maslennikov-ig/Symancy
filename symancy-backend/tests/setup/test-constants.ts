/**
 * Test Constants
 *
 * Centralized configuration for all test magic numbers and thresholds.
 * This ensures test values are documented, consistent, and maintainable.
 *
 * Purpose:
 * - Replace hardcoded magic numbers with named, documented constants
 * - Maintain consistency across all test files
 * - Make test expectations clear and self-documenting
 * - Simplify updates when requirements change
 */

// =============================================================================
// Performance Thresholds
// =============================================================================

/**
 * Maximum acceptable latency for mocked embedding API calls
 * This tests code path efficiency, not actual API performance
 */
export const MAX_EMBEDDING_LATENCY_MS = 100;

/**
 * Maximum acceptable latency for mocked memory extraction
 * Includes LLM call simulation + JSON parsing
 */
export const MAX_EXTRACTION_LATENCY_MS = 200;

/**
 * Maximum acceptable latency for vector search operations
 * Based on mocked Supabase RPC calls
 */
export const MAX_SEARCH_LATENCY_MS = 100;

/**
 * Maximum acceptable latency for end-to-end memory flow
 * Extract → Add → Search with mocked APIs
 */
export const MAX_E2E_FLOW_LATENCY_MS = 300;

/**
 * Maximum acceptable latency for single memory addition
 * Includes embedding generation + DB insert (mocked)
 */
export const MAX_MEMORY_ADD_LATENCY_MS = 100;

/**
 * Maximum acceptable latency for memory retrieval
 * getAllMemories with 100 records (mocked)
 */
export const MAX_MEMORY_RETRIEVAL_LATENCY_MS = 100;

/**
 * Maximum acceptable latency for batch embedding generation
 * Average per embedding when processing 20 texts
 */
export const MAX_BATCH_EMBEDDING_AVG_LATENCY_MS = 100;

/**
 * Maximum total time for batch embedding generation
 * Processing 20 texts sequentially
 */
export const MAX_BATCH_EMBEDDING_TOTAL_MS = 2000;

/**
 * Maximum acceptable latency for concurrent operations
 * 10 concurrent adds or searches (mocked)
 */
export const MAX_CONCURRENT_OPS_LATENCY_MS = 500;

/**
 * Maximum acceptable latency for stress test
 * 50 concurrent operations (25 adds + 25 searches)
 */
export const MAX_STRESS_TEST_LATENCY_MS = 1000;

/**
 * Maximum acceptable performance degradation
 * Percentage difference between first 10 and second 10 sequential operations
 */
export const MAX_PERFORMANCE_DEGRADATION_PERCENT = 50;

// =============================================================================
// Retry Configuration (matches src/utils/retry.ts)
// =============================================================================

/**
 * Base delay before first retry attempt (milliseconds)
 * @see src/utils/retry.ts - baseDelayMs default
 */
export const BASE_RETRY_DELAY_MS = 1000;

/**
 * Maximum delay cap for exponential backoff (milliseconds)
 * @see src/utils/retry.ts - maxDelayMs default
 */
export const MAX_RETRY_DELAY_MS = 30000;

/**
 * Maximum number of retry attempts
 * @see src/utils/retry.ts - maxAttempts default
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Exponential backoff multiplier
 * @see src/utils/retry.ts - backoffMultiplier default
 */
export const RETRY_BACKOFF_MULTIPLIER = 2;

/**
 * Minimum jitter factor for retry delays
 * Formula: delay * MIN_RETRY_JITTER_FACTOR
 * Example: 1000ms * 0.9 = 900ms
 */
export const MIN_RETRY_JITTER_FACTOR = 0.9;

/**
 * Maximum jitter factor for retry delays
 * Formula: delay * MAX_RETRY_JITTER_FACTOR
 * Example: 1000ms * 1.1 = 1100ms
 */
export const MAX_RETRY_JITTER_FACTOR = 1.1;

/**
 * Jitter range (±10%)
 * @see src/utils/retry.ts - calculateDelay() function
 */
export const RETRY_JITTER_RANGE = 0.2;

// =============================================================================
// Embedding Dimensions
// =============================================================================

/**
 * BGE-M3 embedding vector dimensions
 * @see src/core/embeddings/bge-client.ts - EMBEDDING_DIMS
 */
export const EMBEDDING_DIMS = 1024;

/**
 * Model name for BGE-M3 embeddings
 * @see src/core/embeddings/bge-client.ts - EMBEDDING_MODEL
 */
export const EMBEDDING_MODEL = "baai/bge-m3";

// =============================================================================
// Mock API Delays (Realistic Simulation)
// =============================================================================

/**
 * Minimum simulated embedding API delay (milliseconds)
 * Used in performance tests to simulate realistic network latency
 */
export const MOCK_EMBEDDING_DELAY_MIN_MS = 5;

/**
 * Maximum simulated embedding API delay (milliseconds)
 * Used in performance tests to simulate realistic network latency
 */
export const MOCK_EMBEDDING_DELAY_MAX_MS = 10;

/**
 * Minimum simulated LLM API delay (milliseconds)
 * Used in memory extraction tests
 */
export const MOCK_LLM_DELAY_MIN_MS = 20;

/**
 * Maximum simulated LLM API delay (milliseconds)
 * Used in memory extraction tests
 */
export const MOCK_LLM_DELAY_MAX_MS = 30;

/**
 * Minimum simulated DB insert delay (milliseconds)
 * Used in memory service tests
 */
export const MOCK_DB_INSERT_DELAY_MIN_MS = 2;

/**
 * Maximum simulated DB insert delay (milliseconds)
 * Used in memory service tests
 */
export const MOCK_DB_INSERT_DELAY_MAX_MS = 5;

/**
 * Minimum simulated vector search delay (milliseconds)
 * Used in memory service tests
 */
export const MOCK_VECTOR_SEARCH_DELAY_MIN_MS = 5;

/**
 * Maximum simulated vector search delay (milliseconds)
 * Used in memory service tests
 */
export const MOCK_VECTOR_SEARCH_DELAY_MAX_MS = 10;

/**
 * Minimum simulated DB query delay (milliseconds)
 * Used in getAllMemories tests
 */
export const MOCK_DB_QUERY_DELAY_MIN_MS = 10;

/**
 * Maximum simulated DB query delay (milliseconds)
 * Used in getAllMemories tests
 */
export const MOCK_DB_QUERY_DELAY_MAX_MS = 15;

// =============================================================================
// Test Timeouts (Vitest)
// =============================================================================

/**
 * Timeout for unit tests (milliseconds)
 * Fast tests with mocked dependencies
 */
export const TIMEOUT_UNIT = 5_000;

/**
 * Timeout for integration tests (milliseconds)
 * Tests with multiple components but mocked external APIs
 */
export const TIMEOUT_INTEGRATION = 15_000;

/**
 * Timeout for E2E tests (milliseconds)
 * End-to-end flows with mocked external APIs
 */
export const TIMEOUT_E2E = 30_000;

/**
 * Timeout for tests using real APIs (milliseconds)
 * Actual network calls to OpenRouter/Supabase
 */
export const TIMEOUT_REAL_API = 60_000;

/**
 * Timeout for performance tests (milliseconds)
 * Multiple iterations, benchmarking
 */
export const TIMEOUT_PERFORMANCE = 120_000;

// =============================================================================
// Test Data Sizes
// =============================================================================

/**
 * Number of memories for large dataset tests
 * Used in PERF-003: Memory search latency with many memories
 */
export const LARGE_MEMORY_COUNT = 50;

/**
 * Number of memories for retrieval tests
 * Used in PERF-006: Retrieval latency for getAllMemories
 */
export const RETRIEVAL_MEMORY_COUNT = 100;

/**
 * Number of concurrent operations for stress test
 * Used in PERF-008: 25 adds + 25 searches
 */
export const STRESS_TEST_OPS_COUNT = 50;

/**
 * Number of concurrent add operations
 * Used in PERF-004: Concurrent memory operations
 */
export const CONCURRENT_ADDS_COUNT = 10;

/**
 * Number of concurrent search operations
 * Used in PERF-004: Concurrent memory operations
 */
export const CONCURRENT_SEARCHES_COUNT = 10;

/**
 * Number of sequential operations for degradation test
 * Used in PERF-009: Rapid sequential memory additions
 */
export const SEQUENTIAL_OPS_COUNT = 20;

/**
 * Number of batch embeddings for batch test
 * Used in PERF-007: Batch embedding generation
 */
export const BATCH_EMBEDDINGS_COUNT = 20;

/**
 * Number of large batch embeddings (edge case)
 * Used in bge-client.test.ts: Very large batch test
 */
export const LARGE_BATCH_EMBEDDINGS_COUNT = 150;

/**
 * Number of performance measurement iterations
 * Used in PERF-001, PERF-002 for averaging
 */
export const PERF_ITERATIONS = 5;

// =============================================================================
// Retry Delay Calculations
// =============================================================================

/**
 * Helper to calculate minimum expected delay for retry attempt
 * @param baseDelayMs - Base delay in milliseconds
 * @param attempt - Retry attempt number (0-indexed)
 * @param multiplier - Backoff multiplier
 * @returns Minimum expected delay with jitter
 */
export function calculateMinRetryDelay(
  baseDelayMs: number = BASE_RETRY_DELAY_MS,
  attempt: number = 0,
  multiplier: number = RETRY_BACKOFF_MULTIPLIER
): number {
  const exponentialDelay = baseDelayMs * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
  return Math.floor(cappedDelay * MIN_RETRY_JITTER_FACTOR);
}

/**
 * Helper to calculate maximum expected delay for retry attempt
 * @param baseDelayMs - Base delay in milliseconds
 * @param attempt - Retry attempt number (0-indexed)
 * @param multiplier - Backoff multiplier
 * @returns Maximum expected delay with jitter
 */
export function calculateMaxRetryDelay(
  baseDelayMs: number = BASE_RETRY_DELAY_MS,
  attempt: number = 0,
  multiplier: number = RETRY_BACKOFF_MULTIPLIER
): number {
  const exponentialDelay = baseDelayMs * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
  return Math.ceil(cappedDelay * MAX_RETRY_JITTER_FACTOR) + 1; // +1 for rounding tolerance
}

// =============================================================================
// Export All Constants as Object (Optional)
// =============================================================================

/**
 * All test constants in a single object
 * Useful for destructuring in tests
 */
export const TEST_CONSTANTS = {
  // Performance thresholds
  MAX_EMBEDDING_LATENCY_MS,
  MAX_EXTRACTION_LATENCY_MS,
  MAX_SEARCH_LATENCY_MS,
  MAX_E2E_FLOW_LATENCY_MS,
  MAX_MEMORY_ADD_LATENCY_MS,
  MAX_MEMORY_RETRIEVAL_LATENCY_MS,
  MAX_BATCH_EMBEDDING_AVG_LATENCY_MS,
  MAX_BATCH_EMBEDDING_TOTAL_MS,
  MAX_CONCURRENT_OPS_LATENCY_MS,
  MAX_STRESS_TEST_LATENCY_MS,
  MAX_PERFORMANCE_DEGRADATION_PERCENT,

  // Retry configuration
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MULTIPLIER,
  MIN_RETRY_JITTER_FACTOR,
  MAX_RETRY_JITTER_FACTOR,
  RETRY_JITTER_RANGE,

  // Embedding dimensions
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,

  // Mock API delays
  MOCK_EMBEDDING_DELAY_MIN_MS,
  MOCK_EMBEDDING_DELAY_MAX_MS,
  MOCK_LLM_DELAY_MIN_MS,
  MOCK_LLM_DELAY_MAX_MS,
  MOCK_DB_INSERT_DELAY_MIN_MS,
  MOCK_DB_INSERT_DELAY_MAX_MS,
  MOCK_VECTOR_SEARCH_DELAY_MIN_MS,
  MOCK_VECTOR_SEARCH_DELAY_MAX_MS,
  MOCK_DB_QUERY_DELAY_MIN_MS,
  MOCK_DB_QUERY_DELAY_MAX_MS,

  // Test timeouts
  TIMEOUT_UNIT,
  TIMEOUT_INTEGRATION,
  TIMEOUT_E2E,
  TIMEOUT_REAL_API,
  TIMEOUT_PERFORMANCE,

  // Test data sizes
  LARGE_MEMORY_COUNT,
  RETRIEVAL_MEMORY_COUNT,
  STRESS_TEST_OPS_COUNT,
  CONCURRENT_ADDS_COUNT,
  CONCURRENT_SEARCHES_COUNT,
  SEQUENTIAL_OPS_COUNT,
  BATCH_EMBEDDINGS_COUNT,
  LARGE_BATCH_EMBEDDINGS_COUNT,
  PERF_ITERATIONS,

  // Helper functions
  calculateMinRetryDelay,
  calculateMaxRetryDelay,
} as const;
