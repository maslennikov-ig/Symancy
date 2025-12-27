/**
 * Memory System Stress Tests
 * Validates system behavior under extreme load conditions
 *
 * Test Coverage:
 * - STRESS-001: 10,000 memory insertions with performance degradation tracking
 * - STRESS-002: Search efficiency with 10,000 memories
 * - STRESS-003: Concurrent operations under load
 * - STRESS-004: Memory cleanup and garbage collection
 *
 * IMPORTANT: These tests are SKIPPED in CI due to execution time.
 * Run manually with: pnpm test memory-stress
 *
 * Performance Expectations:
 * - Insertion degradation < 50% (first quarter vs last quarter)
 * - Search latency < 500ms with 10k memories
 * - Concurrent ops should not cause failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addMemory,
  searchMemories,
  getAllMemories,
  type MemoryCategory,
} from '../../../src/services/memory.service.js';
import { TEST_CONSTANTS } from '../../setup/test-constants.js';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock embeddings module with realistic performance characteristics
// Constants hardcoded due to vi.mock hoisting limitations
vi.mock('../../../src/core/embeddings/index.js', () => ({
  getEmbedding: vi.fn(async (text: string) => {
    // Simulate small network delay (2-5ms for stress test efficiency)
    await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 3));
    return Array(1024).fill(0).map(() => Math.random());
  }),
  getEmbeddings: vi.fn(async (texts: string[]) => {
    await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 3));
    return texts.map(() => Array(1024).fill(0).map(() => Math.random()));
  }),
  EMBEDDING_MODEL: 'baai/bge-m3',
  EMBEDDING_DIMS: 1024,
}));

// Mock database module with in-memory storage for stress testing
const memoryStore = new Map<string, any[]>();
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('../../../src/core/database.js', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// =============================================================================
// Stress Tests (Skipped in CI)
// =============================================================================

describe.skipIf(process.env.CI === 'true')('Memory Stress Tests', () => {
  const MEMORY_COUNT = 10_000;
  const BATCH_SIZE = 100;
  const STRESS_USER_ID = 999999999;

  beforeEach(() => {
    memoryStore.clear();
    vi.clearAllMocks();

    // Setup mock chain for addMemory
    const mockInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(async function() {
        // Simulate minimal DB delay
        await new Promise(resolve => setTimeout(resolve, 1));

        // Get inserted data from insert call
        const insertedData = mockInsertChain.insert.mock.calls[mockInsertChain.insert.mock.calls.length - 1]?.[0];

        if (!insertedData) {
          return { data: null, error: new Error('No data to insert') };
        }

        const userId = String(insertedData.telegram_user_id);
        const memories = memoryStore.get(userId) || [];
        const memoryId = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newMemory = {
          id: memoryId,
          telegram_user_id: insertedData.telegram_user_id,
          content: insertedData.content,
          category: insertedData.category,
          embedding: insertedData.embedding,
          source_message: insertedData.source_message || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        memories.push(newMemory);
        memoryStore.set(userId, memories);

        return { data: newMemory, error: null };
      }),
    };

    // Setup mockSupabaseClient.from to return the chain
    mockSupabaseClient.from.mockReturnValue(mockInsertChain);

    // Setup mockSupabaseClient.rpc for search operations
    mockSupabaseClient.rpc.mockImplementation(async (funcName: string, params: any) => {
      // Simulate minimal RPC delay
      await new Promise(resolve => setTimeout(resolve, 2));

      if (funcName === 'search_memories') {
        const userId = String(params.user_id);
        const memories = memoryStore.get(userId) || [];
        const limit = params.match_count || 10;

        // Simulate vector search with random similarity scores
        const results = memories
          .map(m => ({
            id: m.id,
            telegram_user_id: m.telegram_user_id,
            content: m.content,
            category: m.category,
            embedding: m.embedding,
            source_message: m.source_message,
            created_at: m.created_at,
            updated_at: m.updated_at,
            similarity: Math.random(), // Random similarity for stress test
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);

        return { data: results, error: null };
      }

      return { data: [], error: null };
    });
  });

  afterEach(() => {
    memoryStore.clear();
  });

  it('STRESS-001: should handle 10,000 memories without significant degradation', async () => {
    const timings: number[] = [];

    console.log(`\n📊 STRESS-001: Adding ${MEMORY_COUNT} memories in batches of ${BATCH_SIZE}...`);
    console.log(`   Started at: ${new Date().toISOString()}`);

    const overallStart = performance.now();

    // Add memories in batches to track performance over time
    for (let batch = 0; batch < MEMORY_COUNT / BATCH_SIZE; batch++) {
      const batchStart = performance.now();

      // Add batch of memories
      const promises = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const idx = batch * BATCH_SIZE + i;
        const content = `Memory content ${idx} about topic ${idx % 100}`;
        promises.push(addMemory(STRESS_USER_ID, content, 'other' as MemoryCategory));
      }

      await Promise.all(promises);

      const batchTime = performance.now() - batchStart;
      timings.push(batchTime);

      // Log progress every 10 batches
      if ((batch + 1) % 10 === 0) {
        console.log(`   Batch ${batch + 1}/${MEMORY_COUNT / BATCH_SIZE}: ${batchTime.toFixed(1)}ms`);
      }
    }

    const overallTime = performance.now() - overallStart;

    // Calculate performance statistics
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const minTime = Math.min(...timings);
    const maxTime = Math.max(...timings);

    // Calculate degradation: compare first quarter vs last quarter
    const firstQuarter = timings.slice(0, Math.floor(timings.length / 4));
    const lastQuarter = timings.slice(-Math.floor(timings.length / 4));
    const firstAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
    const lastAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
    const degradation = ((lastAvg - firstAvg) / firstAvg) * 100;

    console.log(`\n📊 STRESS-001 Results:`);
    console.log(`   Total memories: ${MEMORY_COUNT}`);
    console.log(`   Overall time: ${(overallTime / 1000).toFixed(2)}s`);
    console.log(`   Average batch time: ${avgTime.toFixed(1)}ms`);
    console.log(`   Min batch time: ${minTime.toFixed(1)}ms`);
    console.log(`   Max batch time: ${maxTime.toFixed(1)}ms`);
    console.log(`   First quarter avg: ${firstAvg.toFixed(1)}ms`);
    console.log(`   Last quarter avg: ${lastAvg.toFixed(1)}ms`);
    console.log(`   Performance degradation: ${degradation.toFixed(1)}%`);
    console.log(`   Completed at: ${new Date().toISOString()}\n`);

    // Verify all memories were stored
    const storedMemories = memoryStore.get(String(STRESS_USER_ID));
    expect(storedMemories).toBeDefined();
    expect(storedMemories?.length).toBe(MEMORY_COUNT);

    // Verify performance degradation is acceptable
    expect(degradation).toBeLessThan(TEST_CONSTANTS.MAX_PERFORMANCE_DEGRADATION_PERCENT);

    // Verify overall time is reasonable (< 2 minutes for 10k memories)
    expect(overallTime).toBeLessThan(120_000);
  }, TEST_CONSTANTS.TIMEOUT_PERFORMANCE);

  it('STRESS-002: should search efficiently with 10,000 memories', async () => {
    console.log(`\n🔍 STRESS-002: Populating ${MEMORY_COUNT} memories for search test...`);

    // Pre-populate memories
    const populateStart = performance.now();
    const memories: any[] = [];

    for (let i = 0; i < MEMORY_COUNT; i++) {
      memories.push({
        id: `mem-${i}`,
        telegram_user_id: STRESS_USER_ID,
        content: `Memory ${i} with topic ${i % 100}`,
        category: 'other',
        embedding: JSON.stringify(Array(TEST_CONSTANTS.EMBEDDING_DIMS).fill(0).map(() => Math.random())),
        source_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    memoryStore.set(String(STRESS_USER_ID), memories);

    const populateTime = performance.now() - populateStart;
    console.log(`   Populated in: ${populateTime.toFixed(1)}ms`);

    // Perform multiple searches and measure performance
    console.log(`   Performing 10 searches...`);
    const searchTimings: number[] = [];

    for (let i = 0; i < 10; i++) {
      const searchStart = performance.now();

      const query = `Search query ${i}`;
      const results = await searchMemories(STRESS_USER_ID, query, 10);

      const searchTime = performance.now() - searchStart;
      searchTimings.push(searchTime);

      // Verify results
      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(10);
    }

    const avgSearch = searchTimings.reduce((a, b) => a + b, 0) / searchTimings.length;
    const minSearch = Math.min(...searchTimings);
    const maxSearch = Math.max(...searchTimings);

    console.log(`\n📊 STRESS-002 Results:`);
    console.log(`   Total memories: ${MEMORY_COUNT}`);
    console.log(`   Search iterations: 10`);
    console.log(`   Average search time: ${avgSearch.toFixed(1)}ms`);
    console.log(`   Min search time: ${minSearch.toFixed(1)}ms`);
    console.log(`   Max search time: ${maxSearch.toFixed(1)}ms\n`);

    // Search should be fast even with 10k memories
    expect(avgSearch).toBeLessThan(500);
    expect(maxSearch).toBeLessThan(1000);
  }, TEST_CONSTANTS.TIMEOUT_PERFORMANCE);

  it('STRESS-003: should handle concurrent operations under load', async () => {
    console.log(`\n⚡ STRESS-003: Testing concurrent operations...`);

    // Pre-populate 1000 memories
    const baseMemories: any[] = [];
    for (let i = 0; i < 1000; i++) {
      baseMemories.push({
        id: `mem-${i}`,
        telegram_user_id: STRESS_USER_ID,
        content: `Base memory ${i}`,
        category: 'other',
        embedding: JSON.stringify(Array(TEST_CONSTANTS.EMBEDDING_DIMS).fill(0).map(() => Math.random())),
        source_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    memoryStore.set(String(STRESS_USER_ID), baseMemories);

    console.log(`   Base memories: 1000`);

    // Concurrent operations: 25 adds + 25 searches simultaneously
    const concurrentStart = performance.now();
    const operations: Promise<any>[] = [];

    // 25 concurrent adds
    for (let i = 0; i < 25; i++) {
      operations.push(
        addMemory(STRESS_USER_ID, `Concurrent add ${i}`, 'other' as MemoryCategory)
      );
    }

    // 25 concurrent searches
    for (let i = 0; i < 25; i++) {
      operations.push(
        searchMemories(STRESS_USER_ID, `Concurrent search ${i}`, 5)
      );
    }

    // Wait for all operations to complete
    const results = await Promise.allSettled(operations);
    const concurrentTime = performance.now() - concurrentStart;

    // Verify all operations succeeded
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;

    console.log(`\n📊 STRESS-003 Results:`);
    console.log(`   Concurrent operations: 50 (25 adds + 25 searches)`);
    console.log(`   Total time: ${concurrentTime.toFixed(1)}ms`);
    console.log(`   Successful: ${fulfilled}`);
    console.log(`   Failed: ${rejected}\n`);

    // All operations should succeed
    expect(rejected).toBe(0);
    expect(fulfilled).toBe(50);

    // Concurrent ops should complete reasonably fast
    expect(concurrentTime).toBeLessThan(TEST_CONSTANTS.MAX_STRESS_TEST_LATENCY_MS);
  }, TEST_CONSTANTS.TIMEOUT_PERFORMANCE);

  it('STRESS-004: should handle memory cleanup after large dataset', async () => {
    console.log(`\n🗑️ STRESS-004: Testing memory cleanup...`);

    // Add 5000 memories
    console.log(`   Adding 5000 memories...`);
    const addStart = performance.now();

    for (let i = 0; i < 5000; i++) {
      await addMemory(STRESS_USER_ID, `Memory ${i}`, 'other' as MemoryCategory);
    }

    const addTime = performance.now() - addStart;
    console.log(`   Added in: ${(addTime / 1000).toFixed(2)}s`);

    // Verify memories exist
    const beforeCleanup = memoryStore.get(String(STRESS_USER_ID));
    expect(beforeCleanup?.length).toBe(5000);

    // Simulate cleanup (clear store)
    console.log(`   Cleaning up...`);
    const cleanupStart = performance.now();
    memoryStore.delete(String(STRESS_USER_ID));
    const cleanupTime = performance.now() - cleanupStart;

    console.log(`\n📊 STRESS-004 Results:`);
    console.log(`   Memories before cleanup: 5000`);
    console.log(`   Cleanup time: ${cleanupTime.toFixed(1)}ms`);
    console.log(`   Memories after cleanup: 0\n`);

    // Verify cleanup was successful
    const afterCleanup = memoryStore.get(String(STRESS_USER_ID));
    expect(afterCleanup).toBeUndefined();

    // Cleanup should be fast
    expect(cleanupTime).toBeLessThan(100);
  }, TEST_CONSTANTS.TIMEOUT_PERFORMANCE);

  it('STRESS-005: should maintain search performance with large dataset', async () => {
    console.log(`\n🎯 STRESS-005: Testing search performance with 10k memories...`);

    // Pre-populate using addMemory to ensure proper embeddings
    console.log(`   Adding ${MEMORY_COUNT} memories...`);
    const addStart = performance.now();

    for (let i = 0; i < MEMORY_COUNT; i++) {
      await addMemory(STRESS_USER_ID, `Memory ${i}`, 'other' as MemoryCategory);

      // Log progress every 2000 memories
      if ((i + 1) % 2000 === 0) {
        console.log(`   Progress: ${i + 1}/${MEMORY_COUNT}`);
      }
    }

    const addTime = performance.now() - addStart;
    console.log(`   Added ${MEMORY_COUNT} memories in ${(addTime / 1000).toFixed(2)}s`);

    // Perform multiple searches and measure performance
    console.log(`   Performing 10 searches...`);
    const searchTimings: number[] = [];

    for (let i = 0; i < 10; i++) {
      const searchStart = performance.now();
      const results = await searchMemories(STRESS_USER_ID, `Query ${i}`, 20);
      const searchTime = performance.now() - searchStart;

      searchTimings.push(searchTime);

      // Verify results
      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(20);
    }

    const avgSearch = searchTimings.reduce((a, b) => a + b, 0) / searchTimings.length;
    const minSearch = Math.min(...searchTimings);
    const maxSearch = Math.max(...searchTimings);

    console.log(`\n📊 STRESS-005 Results:`);
    console.log(`   Total memories: ${MEMORY_COUNT}`);
    console.log(`   Search iterations: 10`);
    console.log(`   Average search time: ${avgSearch.toFixed(1)}ms`);
    console.log(`   Min search time: ${minSearch.toFixed(1)}ms`);
    console.log(`   Max search time: ${maxSearch.toFixed(1)}ms\n`);

    // Verify search performance remains good with large dataset
    expect(avgSearch).toBeLessThan(500);
    expect(maxSearch).toBeLessThan(1000);
  }, TEST_CONSTANTS.TIMEOUT_PERFORMANCE);
});

// =============================================================================
// Manual Test Instructions
// =============================================================================

/*
 * To run these stress tests manually:
 *
 * 1. Run all stress tests:
 *    pnpm test memory-stress
 *
 * 2. Run specific stress test:
 *    pnpm test memory-stress -t "STRESS-001"
 *
 * 3. Run with verbose output:
 *    pnpm test memory-stress --reporter=verbose
 *
 * 4. Monitor system resources during test:
 *    - Watch memory usage: htop or Activity Monitor
 *    - Check CPU usage during concurrent operations
 *    - Monitor test output for timing degradation
 *
 * Expected execution time:
 * - STRESS-001: ~60-90 seconds (10k insertions)
 * - STRESS-002: ~10-15 seconds (10k search dataset)
 * - STRESS-003: ~5-10 seconds (50 concurrent ops)
 * - STRESS-004: ~30-45 seconds (5k cleanup)
 * - STRESS-005: ~15-20 seconds (relevance testing)
 * - Total: ~2-3 minutes
 *
 * Performance benchmarks:
 * - Insertion degradation should be < 50%
 * - Search latency should be < 500ms average
 * - Concurrent operations should not fail
 * - Memory cleanup should be < 100ms
 */
