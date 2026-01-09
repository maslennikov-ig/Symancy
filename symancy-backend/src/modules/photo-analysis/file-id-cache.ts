/**
 * File ID Cache Service
 *
 * Telegram callback_data has a 64-byte limit, but file_ids can be 100+ characters.
 * This service provides a short ID mapping to work around this limitation.
 *
 * Architecture:
 * - Uses nanoid for short, URL-safe IDs (10 chars)
 * - In-memory Map with TTL (15 minutes default)
 * - Auto-cleanup of expired entries
 *
 * Usage:
 * ```typescript
 * const shortId = storeFileId(fileId);  // Store and get short ID
 * const fileId = resolveFileId(shortId); // Resolve back to file ID
 * ```
 */

import { nanoid } from "nanoid";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "file-id-cache" });

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Short ID length (10 chars = ~1 trillion combinations) */
const SHORT_ID_LENGTH = 10;

/** TTL for cached entries in milliseconds (15 minutes) */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Cleanup interval in milliseconds (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// =============================================================================
// CACHE STORAGE
// =============================================================================

interface CacheEntry {
  fileId: string;
  expiresAt: number;
}

/** In-memory cache: shortId → { fileId, expiresAt } */
const cache = new Map<string, CacheEntry>();

/** Cleanup interval handle */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Store a file ID and return a short ID for callback_data
 *
 * @param fileId - Telegram file ID (can be 100+ chars)
 * @returns Short ID (10 chars) safe for callback_data
 *
 * @example
 * ```typescript
 * const shortId = storeFileId("AgACAgIAAxkBAAI...");
 * // shortId: "abc123xyz0"
 * // Use in callback: `topic:love:${shortId}`
 * ```
 */
export function storeFileId(fileId: string): string {
  const shortId = nanoid(SHORT_ID_LENGTH);
  const expiresAt = Date.now() + CACHE_TTL_MS;

  cache.set(shortId, { fileId, expiresAt });

  logger.debug(
    { shortId, fileIdLength: fileId.length, expiresAt: new Date(expiresAt).toISOString() },
    "Stored file ID in cache"
  );

  // Ensure cleanup is running
  startCleanupIfNeeded();

  return shortId;
}

/**
 * Resolve a short ID back to the original file ID
 *
 * @param shortId - Short ID from callback_data
 * @returns Original file ID, or null if not found/expired
 *
 * @example
 * ```typescript
 * const fileId = resolveFileId("abc123xyz0");
 * if (!fileId) {
 *   // Handle expired/invalid short ID
 * }
 * ```
 */
export function resolveFileId(shortId: string): string | null {
  const entry = cache.get(shortId);

  if (!entry) {
    logger.debug({ shortId }, "Short ID not found in cache");
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    logger.debug({ shortId }, "Short ID expired, removing from cache");
    cache.delete(shortId);
    return null;
  }

  logger.debug({ shortId, fileIdLength: entry.fileId.length }, "Resolved file ID from cache");
  return entry.fileId;
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): { size: number; oldestEntry: Date | null } {
  let oldestTimestamp = Infinity;

  for (const entry of cache.values()) {
    const createdAt = entry.expiresAt - CACHE_TTL_MS;
    if (createdAt < oldestTimestamp) {
      oldestTimestamp = createdAt;
    }
  }

  return {
    size: cache.size,
    oldestEntry: oldestTimestamp === Infinity ? null : new Date(oldestTimestamp),
  };
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Remove expired entries from cache
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let removedCount = 0;

  for (const [shortId, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(shortId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.debug({ removedCount, remainingSize: cache.size }, "Cleaned up expired cache entries");
  }
}

/**
 * Start cleanup interval if not already running
 */
function startCleanupIfNeeded(): void {
  if (cleanupInterval === null) {
    cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
    // Don't block process exit
    cleanupInterval.unref();
    logger.debug("Started file ID cache cleanup interval");
  }
}

/**
 * Stop cleanup interval (for graceful shutdown)
 */
export function stopCleanup(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug("Stopped file ID cache cleanup interval");
  }
}
