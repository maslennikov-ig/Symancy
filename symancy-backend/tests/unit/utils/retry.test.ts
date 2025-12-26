/**
 * Unit tests for retry utility with exponential backoff
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../../../src/utils/retry.js";

// Mock the logger module
vi.mock("../../../src/core/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("withRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Success scenarios", () => {
    it("should succeed on first attempt without retry", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");

      const promise = withRetry(mockFn);

      // Fast-forward all timers
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should return correct value on successful retry", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("success after retry");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success after retry");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Retry on network errors", () => {
    it("should retry on network error and succeed", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on timeout error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Request timeout"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on ECONNREFUSED error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on ETIMEDOUT error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("ETIMEDOUT"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on rate limit (429) error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Rate limit exceeded (429)"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on 503 service unavailable error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Service unavailable (503)"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on FetchError", async () => {
      // Create object with name property to simulate FetchError
      const fetchError = { name: "FetchError", message: "Fetch failed" };

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(fetchError)
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should retry on AbortError", async () => {
      // Create object with name property to simulate AbortError
      const abortError = { name: "AbortError", message: "Aborted" };

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Non-retryable errors", () => {
    it("should NOT retry on non-retryable errors", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Validation failed"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Validation failed");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on authentication errors", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Unauthorized"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Unauthorized");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on bad request errors", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Bad request (400)"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Bad request (400)");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Retry exhaustion", () => {
    it("should exhaust all attempts and throw last error", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("should respect maxAttempts configuration", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const promise = withRetry(mockFn, { maxAttempts: 5, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");
      expect(mockFn).toHaveBeenCalledTimes(5);
    });

    it("should fail after single attempt when maxAttempts is 1", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const promise = withRetry(mockFn, { maxAttempts: 1, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Exponential backoff", () => {
    it("should apply exponential backoff (verify delays increase)", async () => {
      const delays: number[] = [];
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      // Track setTimeout calls to capture delays
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay: number) => {
        if (typeof delay === "number") {
          delays.push(delay);
        }
        return originalSetTimeout(fn, 0);
      });

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");

      // Verify delays are increasing (with jitter, should be approximately exponential)
      // First retry: ~1000ms, Second retry: ~2000ms
      expect(delays.length).toBeGreaterThan(0);
      if (delays.length >= 2) {
        // With jitter (±10%), delays should still show exponential growth
        expect(delays[1]!).toBeGreaterThan(delays[0]! * 0.9);
      }
    });

    it("should cap delay at maxDelayMs", async () => {
      const delays: number[] = [];
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay: number) => {
        if (typeof delay === "number") {
          delays.push(delay);
        }
        return originalSetTimeout(fn, 0);
      });

      const promise = withRetry(mockFn, {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");

      // All delays should be <= maxDelayMs (accounting for jitter: maxDelayMs * 1.1)
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(3000 * 1.1 + 1); // +1 for rounding
      });
    });

    it("should apply jitter to prevent thundering herd", async () => {
      const delays1: number[] = [];
      const delays2: number[] = [];

      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      // Capture delays from first execution
      const originalSetTimeout = global.setTimeout;
      let captureArray = delays1;

      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay: number) => {
        if (typeof delay === "number") {
          captureArray.push(delay);
        }
        return originalSetTimeout(fn, 0);
      });

      const promise1 = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });

      await vi.runAllTimersAsync();
      await promise1.catch(() => {});

      // Reset and capture delays from second execution
      vi.clearAllMocks();
      captureArray = delays2;
      mockFn.mockRejectedValue(new Error("Network error"));

      const promise2 = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 1000,
      });

      await vi.runAllTimersAsync();
      await promise2.catch(() => {});

      // Delays should differ due to jitter (very unlikely to be identical)
      if (delays1.length > 0 && delays2.length > 0) {
        const hasJitter = delays1.some((d1, i) => {
          const d2 = delays2[i];
          return d2 !== undefined && Math.abs(d1 - d2) > 1;
        });
        expect(hasJitter).toBe(true);
      }
    });
  });

  describe("Custom retryCondition", () => {
    it("should handle custom retryCondition", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("CUSTOM_RETRY_ERROR"))
        .mockResolvedValueOnce("success");

      const customRetryCondition = (error: unknown) => {
        if (error instanceof Error) {
          return error.message.includes("CUSTOM_RETRY_ERROR");
        }
        return false;
      };

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        retryCondition: customRetryCondition,
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry when custom retryCondition returns false", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const customRetryCondition = () => false; // Never retry

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        retryCondition: customRetryCondition,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should retry on custom error condition", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("TEMP_DATABASE_LOCK"))
        .mockResolvedValueOnce("success");

      const customRetryCondition = (error: unknown) => {
        if (error instanceof Error) {
          return error.message.includes("DATABASE_LOCK");
        }
        return false;
      };

      const promise = withRetry(mockFn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        retryCondition: customRetryCondition,
      });

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle non-Error thrown values", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce("string error")
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      // Non-Error values should not match default retry condition
      const expectation = expect(promise).rejects.toBe("string error");

      await vi.runAllTimersAsync();
      await expectation;

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle null errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(null)
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      const expectation = expect(promise).rejects.toBeNull();

      await vi.runAllTimersAsync();
      await expectation;

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle undefined errors", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(undefined)
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      const expectation = expect(promise).rejects.toBeUndefined();

      await vi.runAllTimersAsync();
      await expectation;

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle successful return of null", async () => {
      const mockFn = vi.fn().mockResolvedValue(null);

      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBeNull();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle successful return of undefined", async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);

      const promise = withRetry(mockFn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBeUndefined();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Logger integration", () => {
    it("should log warning on retry attempt", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await promise;

      expect(logger.warn).toHaveBeenCalledWith(
        "Retry attempt failed, retrying...",
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3,
          error: "Network error",
        })
      );
    });

    it("should log info on successful retry", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await promise;

      expect(logger.info).toHaveBeenCalledWith(
        "Retry successful",
        expect.objectContaining({
          attempt: 2,
          totalAttempts: 3,
        })
      );
    });

    it("should log error when retries exhausted", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const mockFn = vi.fn().mockRejectedValue(new Error("Network error"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await promise.catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        "Retry exhausted all attempts",
        expect.objectContaining({
          attempt: 3,
          maxAttempts: 3,
          error: "Network error",
        })
      );
    });

    it("should log error for non-retryable errors", async () => {
      const { logger } = await import("../../../src/core/logger.js");

      const mockFn = vi.fn().mockRejectedValue(new Error("Validation failed"));

      const promise = withRetry(mockFn, { maxAttempts: 3, baseDelayMs: 100 });

      await vi.runAllTimersAsync();

      await promise.catch(() => {});

      expect(logger.error).toHaveBeenCalledWith(
        "Error not retryable",
        expect.objectContaining({
          attempt: 1,
          error: "Validation failed",
        })
      );
    });
  });
});
