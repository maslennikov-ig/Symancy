/**
 * Unit tests for Daily Insight Chain
 * @module chains/__tests__/daily-insight.chain.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWithRetry, truncateNicely } from '../../../src/chains/daily-insight.chain.js';

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

  describe('truncateNicely', () => {
    it('should return unchanged text when shorter than maxLen', () => {
      const text = 'Short text';
      const result = truncateNicely(text, 20);

      expect(result).toBe('Short text');
      expect(result).not.toContain('...');
    });

    it('should return unchanged text when exactly equal to maxLen', () => {
      const text = 'Exactly twenty chars';
      const result = truncateNicely(text, 20);

      expect(result).toBe('Exactly twenty chars');
      expect(result).not.toContain('...');
    });

    it('should cut at word boundary when space exists in valid range', () => {
      const text = 'This is a long sentence that needs to be truncated properly';
      const result = truncateNicely(text, 30);

      // Should cut at a word boundary (last space before maxLen)
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(30 + 3); // maxLen + '...'
      expect(result).not.toMatch(/\s\.\.\.$/); // Should not end with space before ...
      expect(result).toMatch(/\S\.\.\./); // Should end with non-space before ...
    });

    it('should add ellipsis when text is truncated', () => {
      const text = 'This text is definitely too long for the maximum length';
      const result = truncateNicely(text, 20);

      expect(result).toContain('...');
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not cut too short when space is before 70% threshold', () => {
      // Text with early space (before 70% of maxLen)
      // maxLen = 50, 70% = 35
      // Space at position 10 (before 35), should use hard cut instead
      const text = 'Short word' + 'x'.repeat(60); // Space at position 10, then many chars
      const result = truncateNicely(text, 50);

      // Should use hard cut at maxLen instead of cutting at position 10
      expect(result.length).toBe(50 + 3); // maxLen + '...'
      expect(result).toBe(text.slice(0, 50) + '...');
    });

    it('should handle text with no spaces (fallback to hard cut)', () => {
      const text = 'x'.repeat(100); // No spaces at all
      const result = truncateNicely(text, 30);

      // Should do hard cut at maxLen
      expect(result.length).toBe(30 + 3); // maxLen + '...'
      expect(result).toBe('x'.repeat(30) + '...');
    });

    it('should handle empty string', () => {
      const result = truncateNicely('', 50);

      expect(result).toBe('');
      expect(result).not.toContain('...');
    });

    it('should handle edge case where space is exactly at 70% threshold', () => {
      // Create text where space is exactly at 70% of maxLen
      // maxLen = 100, 70% = 70
      // The condition is `lastSpace > maxLen * 0.7`, so space AT 70 is NOT > 70
      const maxLen = 100;
      const threshold = Math.floor(maxLen * 0.7); // 70
      const text = 'x'.repeat(threshold) + ' ' + 'y'.repeat(50); // Space at position 70

      const result = truncateNicely(text, maxLen);

      // Space is at position 70, which is NOT > 70, so should use hard cut at maxLen
      expect(result).toBe(text.slice(0, maxLen) + '...');
    });

    it('should preserve word boundaries with multiple spaces', () => {
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8';
      const result = truncateNicely(text, 25);

      // Should cut at word boundary
      expect(result).toContain('...');
      expect(result).toMatch(/Word\d\.\.\./); // Should end with a word, not space
      expect(result.length).toBeLessThanOrEqual(25 + 3);
    });

    it('should handle single character maxLen', () => {
      const text = 'Long text';
      const result = truncateNicely(text, 1);

      expect(result).toBe('L...');
      expect(result.length).toBe(4);
    });

    it('should handle maxLen smaller than first word', () => {
      const text = 'Supercalifragilisticexpialidocious is a long word';
      const result = truncateNicely(text, 10);

      // No space in first 10 chars, should hard cut
      expect(result).toBe('Supercalif...');
      expect(result.length).toBe(13); // 10 + '...'
    });

    it('should handle text with leading/trailing spaces', () => {
      const text = '  Some text with spaces  ';
      const result = truncateNicely(text, 15);

      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(15 + 3);
    });

    it('should handle unicode characters correctly', () => {
      const text = 'Привет мир! This is a test with unicode characters 你好世界';
      const result = truncateNicely(text, 30);

      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(30 + 3);
    });

    it('should handle newlines in text', () => {
      const text = 'First line\nSecond line\nThird line that is very long';
      const result = truncateNicely(text, 25);

      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(25 + 3);
    });

    it('should correctly calculate 70% threshold for various maxLen values', () => {
      // Test with maxLen = 100 (70% = 70)
      const text1 = 'x'.repeat(71) + ' ' + 'y'.repeat(50);
      const result1 = truncateNicely(text1, 100);
      expect(result1).toBe('x'.repeat(71) + '...'); // Space at 71 > 70, should cut there

      // Test with maxLen = 50 (70% = 35)
      const text2 = 'x'.repeat(36) + ' ' + 'y'.repeat(50);
      const result2 = truncateNicely(text2, 50);
      expect(result2).toBe('x'.repeat(36) + '...'); // Space at 36 > 35, should cut there

      // Test with maxLen = 20 (70% = 14)
      const text3 = 'x'.repeat(15) + ' ' + 'y'.repeat(50);
      const result3 = truncateNicely(text3, 20);
      expect(result3).toBe('x'.repeat(15) + '...'); // Space at 15 > 14, should cut there
    });

    it('should not cut at space when it would result in too short text', () => {
      // maxLen = 100, 70% = 70
      // Space at position 50 (< 70), should use hard cut at 100 instead
      const text = 'x'.repeat(50) + ' ' + 'y'.repeat(70);
      const result = truncateNicely(text, 100);

      // Should NOT cut at position 50 (too short), should cut at 100
      expect(result.length).toBe(103); // 100 + '...'
      expect(result).toBe(text.slice(0, 100) + '...');
    });
  });
});
