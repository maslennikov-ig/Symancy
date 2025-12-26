/**
 * Retry Utility with Exponential Backoff
 *
 * Generic retry function for API calls with:
 * - Exponential backoff with jitter
 * - Configurable max attempts and delays
 * - Conditional retry based on error type
 * - Detailed logging
 */
import { logger } from "@/core/logger.js";

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds before first retry
   * @default 1000
   */
  baseDelayMs?: number;

  /**
   * Maximum delay in milliseconds (cap for exponential backoff)
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Backoff multiplier for exponential growth
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Function to determine if error should trigger retry
   * @default Retries on network errors
   */
  retryCondition?: (error: unknown) => boolean;
}

/**
 * Default retry condition - retries on network errors
 */
function defaultRetryCondition(error: unknown): boolean {
  // Retry on network errors, timeouts, rate limits
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("etimedout") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("504")
    );
  }

  // Retry on fetch errors
  if (error && typeof error === "object" && "name" in error) {
    return error.name === "FetchError" || error.name === "AbortError";
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 *
 * Formula: delay = min(baseDelay * (multiplier ^ attempt), maxDelay) + jitter
 * Jitter: Random 0-20% of delay to prevent thundering herd
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: 0-20% of delay
  const jitter = cappedDelay * Math.random() * 0.2;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with automatic retry on failure
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of successful execution
 * @throws Last error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch("https://api.example.com/data"),
 *   { maxAttempts: 3, baseDelayMs: 500 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryCondition = defaultRetryCondition,
  } = options ?? {};

  let lastError: unknown;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Attempt execution
      const result = await fn();

      // Log success if this was a retry
      if (attempt > 0) {
        logger.info("Retry successful", {
          attempt: attempt + 1,
          totalAttempts: maxAttempts,
        });
      }

      return result;
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we should retry
      const shouldRetry = attempt < maxAttempts && retryCondition(error);

      if (!shouldRetry) {
        // Don't retry - either max attempts reached or error type not retryable
        if (attempt >= maxAttempts) {
          logger.error("Retry exhausted all attempts", {
            attempt,
            maxAttempts,
            error: error instanceof Error ? error.message : String(error),
          });
        } else {
          logger.error("Error not retryable", {
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }

      // Calculate delay
      const delayMs = calculateDelay(
        attempt - 1,
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier
      );

      logger.warn("Retry attempt failed, retrying...", {
        attempt,
        maxAttempts,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });

      // Wait before retry
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
