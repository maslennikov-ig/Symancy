/**
 * Unit tests for rate-limit middleware
 * Tests LRU-based in-memory rate limiting (10 requests per minute per user)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rateLimitMiddleware,
  getRateLimitStatus,
  clearRateLimit,
} from "../../../src/modules/router/rate-limit.js";
import type { Context, NextFunction } from "grammy";

/**
 * Create a mock Grammy context for testing
 */
function createMockContext(userId?: number): Context {
  return {
    from: userId ? { id: userId } : undefined,
    reply: vi.fn(() => Promise.resolve()),
  } as any;
}

/**
 * Create a mock next function
 */
function createMockNext(): NextFunction {
  return vi.fn(() => Promise.resolve());
}

describe("rate-limit middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic Rate Limiting", () => {
    it("should allow first request", async () => {
      const userId = 123456789;
      const ctx = createMockContext(userId);
      const next = createMockNext();

      await rateLimitMiddleware(ctx, next);

      expect(next).toHaveBeenCalledOnce();
      expect(ctx.reply).not.toHaveBeenCalled();

      // Cleanup
      clearRateLimit(userId);
    });

    it("should allow up to 10 requests within a minute", async () => {
      const userId = 987654321;
      const ctx = createMockContext(userId);

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const next = createMockNext();
        await rateLimitMiddleware(ctx, next);
        expect(next).toHaveBeenCalledOnce();
        expect(ctx.reply).not.toHaveBeenCalled();
      }

      // Verify rate limit status
      const status = getRateLimitStatus(userId);
      expect(status).toBeDefined();
      expect(status?.count).toBe(10);

      // Cleanup
      clearRateLimit(userId);
    });

    it("should block 11th request with rate limit message", async () => {
      const userId = 111222333;
      const ctx = createMockContext(userId);

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        const next = createMockNext();
        await rateLimitMiddleware(ctx, next);
        expect(next).toHaveBeenCalledOnce();
      }

      // 11th request should be blocked
      const next11 = createMockNext();
      await rateLimitMiddleware(ctx, next11);

      expect(next11).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith("Слишком много запросов. Подождите минуту.");

      // Cleanup
      clearRateLimit(userId);
    });

    it("should reset after window expires", async () => {
      const userId = 444555666;
      const ctx = createMockContext(userId);

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const next = createMockNext();
        await rateLimitMiddleware(ctx, next);
      }

      // Verify limit is reached
      const status = getRateLimitStatus(userId);
      expect(status?.count).toBe(10);

      // Advance time by 61 seconds (past the 60-second window)
      vi.advanceTimersByTime(61 * 1000);

      // Next request should succeed (new window)
      const nextAfterReset = createMockNext();
      await rateLimitMiddleware(ctx, nextAfterReset);

      expect(nextAfterReset).toHaveBeenCalledOnce();
      expect(ctx.reply).not.toHaveBeenCalled();

      // Verify new entry created
      const newStatus = getRateLimitStatus(userId);
      expect(newStatus?.count).toBe(1);

      // Cleanup
      clearRateLimit(userId);
    });
  });

  describe("Edge Cases", () => {
    it("should skip rate limiting if no user ID", async () => {
      const ctx = createMockContext(); // No userId
      const next = createMockNext();

      await rateLimitMiddleware(ctx, next);

      expect(next).toHaveBeenCalledOnce();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it("should track separate limits per user", async () => {
      const user1 = 100000001;
      const user2 = 100000002;
      const ctx1 = createMockContext(user1);
      const ctx2 = createMockContext(user2);

      // User 1 makes 10 requests
      for (let i = 0; i < 10; i++) {
        const next = createMockNext();
        await rateLimitMiddleware(ctx1, next);
        expect(next).toHaveBeenCalledOnce();
      }

      // User 2 should still have full quota
      const next2 = createMockNext();
      await rateLimitMiddleware(ctx2, next2);
      expect(next2).toHaveBeenCalledOnce();

      // User 1 should be blocked
      const next1Blocked = createMockNext();
      await rateLimitMiddleware(ctx1, next1Blocked);
      expect(next1Blocked).not.toHaveBeenCalled();
      expect(ctx1.reply).toHaveBeenCalledWith("Слишком много запросов. Подождите минуту.");

      // User 2 should still be allowed
      const next2Second = createMockNext();
      await rateLimitMiddleware(ctx2, next2Second);
      expect(next2Second).toHaveBeenCalledOnce();

      // Cleanup
      clearRateLimit(user1);
      clearRateLimit(user2);
    });

    it("should call next() when allowed", async () => {
      const userId = 200000001;
      const ctx = createMockContext(userId);
      const next = createMockNext();

      await rateLimitMiddleware(ctx, next);

      expect(next).toHaveBeenCalledOnce();

      // Cleanup
      clearRateLimit(userId);
    });

    it("should NOT call next() when blocked", async () => {
      const userId = 200000002;
      const ctx = createMockContext(userId);

      // Exhaust quota
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
      }

      // Blocked request
      const blockedNext = createMockNext();
      await rateLimitMiddleware(ctx, blockedNext);

      expect(blockedNext).not.toHaveBeenCalled();

      // Cleanup
      clearRateLimit(userId);
    });

    it("should increment count correctly for each request", async () => {
      const userId = 300000001;
      const ctx = createMockContext(userId);

      // Make 5 requests and verify count after each
      for (let i = 1; i <= 5; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
        const status = getRateLimitStatus(userId);
        expect(status?.count).toBe(i);
      }

      // Cleanup
      clearRateLimit(userId);
    });

    it("should preserve resetAt timestamp during increments", async () => {
      const userId = 300000002;
      const ctx = createMockContext(userId);

      // First request
      await rateLimitMiddleware(ctx, createMockNext());
      const status1 = getRateLimitStatus(userId);
      const resetAt = status1?.resetAt;

      // Advance time by 10 seconds
      vi.advanceTimersByTime(10 * 1000);

      // Second request should keep same resetAt
      await rateLimitMiddleware(ctx, createMockNext());
      const status2 = getRateLimitStatus(userId);

      expect(status2?.resetAt).toBe(resetAt);
      expect(status2?.count).toBe(2);

      // Cleanup
      clearRateLimit(userId);
    });
  });

  describe("Helper Functions", () => {
    it("getRateLimitStatus should return null for unknown user", () => {
      const unknownUserId = 999999999;
      const status = getRateLimitStatus(unknownUserId);

      expect(status).toBeNull();
    });

    it("getRateLimitStatus should return entry for tracked user", async () => {
      const userId = 400000001;
      const ctx = createMockContext(userId);

      // Make a request to create entry
      await rateLimitMiddleware(ctx, createMockNext());

      const status = getRateLimitStatus(userId);

      expect(status).toBeDefined();
      expect(status?.count).toBe(1);
      expect(status?.resetAt).toBeGreaterThan(Date.now());

      // Cleanup
      clearRateLimit(userId);
    });

    it("getRateLimitStatus should return null for expired entry", async () => {
      const userId = 400000002;
      const ctx = createMockContext(userId);

      // Make a request
      await rateLimitMiddleware(ctx, createMockNext());

      // Verify entry exists
      const status1 = getRateLimitStatus(userId);
      expect(status1).toBeDefined();

      // Advance time past window
      vi.advanceTimersByTime(61 * 1000);

      // Entry should be expired and deleted
      const status2 = getRateLimitStatus(userId);
      expect(status2).toBeNull();
    });

    it("clearRateLimit should remove user from tracker", async () => {
      const userId = 500000001;
      const ctx = createMockContext(userId);

      // Make requests
      for (let i = 0; i < 5; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
      }

      // Verify entry exists
      const status1 = getRateLimitStatus(userId);
      expect(status1?.count).toBe(5);

      // Clear rate limit
      clearRateLimit(userId);

      // Verify entry removed
      const status2 = getRateLimitStatus(userId);
      expect(status2).toBeNull();
    });

    it("clearRateLimit should allow fresh start after clear", async () => {
      const userId = 500000002;
      const ctx = createMockContext(userId);

      // Exhaust quota
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
      }

      // Verify blocked
      const blockedNext = createMockNext();
      await rateLimitMiddleware(ctx, blockedNext);
      expect(blockedNext).not.toHaveBeenCalled();

      // Clear rate limit
      clearRateLimit(userId);

      // Should be allowed again
      const allowedNext = createMockNext();
      await rateLimitMiddleware(ctx, allowedNext);
      expect(allowedNext).toHaveBeenCalledOnce();

      // Cleanup
      clearRateLimit(userId);
    });
  });

  describe("Concurrent Scenarios", () => {
    it("should handle rapid concurrent requests correctly", async () => {
      const userId = 600000001;
      const ctx = createMockContext(userId);

      // Simulate 15 concurrent requests
      const requests = Array.from({ length: 15 }, () =>
        rateLimitMiddleware(ctx, createMockNext())
      );

      await Promise.all(requests);

      // Verify final state: exactly 10 allowed
      const status = getRateLimitStatus(userId);
      expect(status?.count).toBe(10);

      // Cleanup
      clearRateLimit(userId);
    });

    it("should handle multiple users concurrently", async () => {
      const users = [700000001, 700000002, 700000003];
      const contexts = users.map((id) => createMockContext(id));

      // Each user makes 5 requests
      const allRequests = contexts.flatMap((ctx) =>
        Array.from({ length: 5 }, () => rateLimitMiddleware(ctx, createMockNext()))
      );

      await Promise.all(allRequests);

      // Verify each user has count of 5
      for (const userId of users) {
        const status = getRateLimitStatus(userId);
        expect(status?.count).toBe(5);
      }

      // Cleanup
      users.forEach(clearRateLimit);
    });
  });

  describe("Window Boundary Conditions", () => {
    it("should create new window exactly at resetAt time", async () => {
      const userId = 800000001;
      const ctx = createMockContext(userId);

      // Make 10 requests to exhaust quota
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
      }

      const status1 = getRateLimitStatus(userId);
      const resetAt = status1!.resetAt;

      // Advance time to EXACTLY resetAt (boundary)
      vi.setSystemTime(resetAt);

      // Request at exact boundary still in old window (check is >)
      const next2 = createMockNext();
      await rateLimitMiddleware(ctx, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith("Слишком много запросов. Подождите минуту.");

      // Advance 1ms past resetAt
      vi.setSystemTime(resetAt + 1);

      // Should create new window
      const next3 = createMockNext();
      await rateLimitMiddleware(ctx, next3);
      expect(next3).toHaveBeenCalledOnce();

      const status3 = getRateLimitStatus(userId);
      expect(status3?.count).toBe(1);
      expect(status3?.resetAt).toBeGreaterThan(resetAt);

      // Cleanup
      clearRateLimit(userId);
    });

    it("should handle requests just before window expiry", async () => {
      const userId = 800000002;
      const ctx = createMockContext(userId);

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware(ctx, createMockNext());
      }

      const status = getRateLimitStatus(userId);
      const resetAt = status!.resetAt;

      // Advance to 1ms before reset
      vi.setSystemTime(resetAt - 1);

      // Should still be blocked
      const blockedNext = createMockNext();
      await rateLimitMiddleware(ctx, blockedNext);
      expect(blockedNext).not.toHaveBeenCalled();

      // Cleanup
      clearRateLimit(userId);
    });
  });
});
