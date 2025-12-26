/**
 * Rate limiting middleware for bot requests
 * Implements LRU-based in-memory rate limiter (10 requests per minute per user)
 */
import { type Context, type NextFunction } from "grammy";
import { LRUCache } from "lru-cache";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "rate-limit" });

/**
 * Rate limit configuration
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const MAX_TRACKED_USERS = 10000; // Max 10K users tracked to prevent unbounded growth

/**
 * User rate limit state
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * LRU cache for rate limit store
 * Automatically evicts old entries to prevent memory leaks
 */
const rateLimitStore = new LRUCache<number, RateLimitEntry>({
  max: MAX_TRACKED_USERS, // Max 10K users tracked
  ttl: RATE_LIMIT_WINDOW_MS, // Auto-evict after window expires
  updateAgeOnGet: false, // Don't reset TTL on read
  updateAgeOnHas: false,
});

/**
 * Rate limiting middleware
 * Limits users to 10 requests per minute
 */
export async function rateLimitMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Skip if no user ID (shouldn't happen, but be defensive)
  if (!ctx.from?.id) {
    return next();
  }

  const userId = ctx.from.id;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(userId, entry);
    return next();
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    logger.warn(
      { userId, count: entry.count, resetIn: entry.resetAt - now },
      "Rate limit exceeded"
    );

    // Reply with rate limit message
    await ctx.reply("Слишком много запросов. Подождите минуту.");
    return; // Don't call next(), stop processing
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(userId, entry);

  return next();
}

/**
 * Get rate limit status for a user (for debugging/monitoring)
 */
export function getRateLimitStatus(userId: number): RateLimitEntry | null {
  const entry = rateLimitStore.get(userId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now > entry.resetAt) {
    rateLimitStore.delete(userId);
    return null;
  }

  return {
    count: entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Clear rate limit for a user (for testing/admin override)
 */
export function clearRateLimit(userId: number): void {
  rateLimitStore.delete(userId);
  logger.info({ userId }, "Rate limit cleared");
}
