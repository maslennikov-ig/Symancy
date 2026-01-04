/**
 * Unit tests for Daily Insight Chain
 * @module chains/__tests__/daily-insight.chain.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWithRetry } from '../../../src/chains/daily-insight.chain.js';

// Mock the logger module
vi.mock('../../../src/core/logger.js', () => ({
  getLogger: vi.fn(() => ({
    child: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

describe('DailyInsightChain', () => {
  describe('generateWithRetry', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return result on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = generateWithRetry(fn);

      // Fast-forward through any timers
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and return result on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValue('success after retry');

      const promise = generateWithRetry(fn, 3, 100);

      // Fast-forward through the delay
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw last error after all retries fail', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'));

      const promise = generateWithRetry(fn, 3, 100);

      const expectation = expect(promise).rejects.toThrow('Fail 3');

      // Fast-forward through all delays
      await vi.runAllTimersAsync();

      await expectation;
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff delays', async () => {
      const delays: number[] = [];
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      // Track setTimeout calls to capture delays
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
        if (typeof delay === 'number') {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0);
      });

      const promise = generateWithRetry(fn, 3, 1000);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);

      // Verify delays follow exponential backoff: 1000 * 2^0, 1000 * 2^1
      // First retry: 1000ms (1000 * 2^0)
      // Second retry: 2000ms (1000 * 2^1)
      expect(delays.length).toBeGreaterThanOrEqual(2);
      expect(delays[0]).toBe(1000); // First delay: baseDelay * 2^0
      expect(delays[1]).toBe(2000); // Second delay: baseDelay * 2^1
    });

    it('should handle non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      const promise = generateWithRetry(fn, 1, 100);

      const expectation = expect(promise).rejects.toThrow('string error');

      await vi.runAllTimersAsync();

      await expectation;
    });

    it('should use default retry parameters when not provided', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = generateWithRetry(fn);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple retry attempts correctly', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'))
        .mockResolvedValue('success');

      const promise = generateWithRetry(fn, 4, 100);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should throw after exhausting all retries', async () => {
      const lastError = new Error('Final network error');
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(lastError);

      const promise = generateWithRetry(fn, 2, 100);

      const expectation = expect(promise).rejects.toThrow('Final network error');

      await vi.runAllTimersAsync();

      await expectation;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle successful execution with complex return types', async () => {
      const complexResult = {
        data: 'test',
        nested: { value: 42 },
        array: [1, 2, 3],
      };

      const fn = vi.fn().mockResolvedValue(complexResult);

      const promise = generateWithRetry(fn, 3, 100);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual(complexResult);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry exactly maxRetries - 1 times before final attempt', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockResolvedValue('success');

      const promise = generateWithRetry(fn, 5, 100);

      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should not delay before the first attempt', async () => {
      const delays: number[] = [];
      const fn = vi.fn().mockResolvedValue('success');

      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
        if (typeof delay === 'number') {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0);
      });

      const promise = generateWithRetry(fn, 3, 1000);

      await vi.runAllTimersAsync();

      await promise;

      // Should have no delays for first successful attempt
      expect(delays.length).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should wait correct delay before each retry', async () => {
      const delays: number[] = [];
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'));

      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
        if (typeof delay === 'number') {
          delays.push(delay);
        }
        return originalSetTimeout(callback, 0);
      });

      const promise = generateWithRetry(fn, 3, 500);

      const expectation = promise.catch(() => {
        // Expected to throw after all retries
      });

      await vi.runAllTimersAsync();

      await expectation;

      // Should have 2 delays (after first and second failures, not after last)
      expect(delays.length).toBe(2);
      expect(delays[0]).toBe(500);  // 500 * 2^0
      expect(delays[1]).toBe(1000); // 500 * 2^1
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
