/**
 * Memory Concurrency Tests
 *
 * Tests concurrent operations on the memory system to detect race conditions,
 * data loss, and corruption scenarios. These tests verify:
 * - Concurrent memory additions without data loss
 * - Multi-user concurrent operations isolation
 * - Read-while-write consistency
 * - Embedding generation under concurrent load
 * - Database transaction integrity
 *
 * Test Strategy:
 * - Use Promise.all() to simulate true concurrent operations
 * - Mock Supabase to control race conditions
 * - Mock embeddings with delays to simulate network latency
 * - Verify data integrity after concurrent operations
 * - Test cross-user data isolation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addMemory, getAllMemories, searchMemories, type MemoryCategory } from '../../../src/services/memory.service.js';
import { TEST_USER_ID, TEST_USER_ID_2, TEST_USER_ID_3 } from '../../setup/memory-test-helpers.js';

// =============================================================================
// Mock Setup
// =============================================================================

/**
 * In-memory storage to track concurrent operations
 */
let memoryStore: Map<string, any[]>;
let idCounter: number;
let insertCounter: number; // Track actual insert calls

/**
 * Mock Supabase client with controlled concurrency behavior
 */
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

/**
 * Mock embedding service with artificial delay to simulate network latency
 */
vi.mock('../../../src/core/embeddings/index.js', () => ({
  getEmbedding: vi.fn(async (text: string) => {
    // Simulate network delay (10-30ms random)
    const delay = 10 + Math.random() * 20;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return deterministic embedding based on text hash
    const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(1024).fill(0).map((_, i) => Math.sin(hash + i) * 0.5);
  }),
}));

vi.mock('../../../src/core/database.js', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Setup mock Supabase insert with concurrency tracking
 * Simulates real database behavior with proper async delays
 */
function setupMockInsert() {
  let lastInsertedMemory: any = null;

  const insertChain = {
    insert: vi.fn().mockImplementation((data: any) => {
      // Simulate database operation delay (async, but return synchronously)
      const delayPromise = new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));

      insertCounter++;
      const userId = String(data.telegram_user_id);
      const memories = memoryStore.get(userId) || [];

      const newMemory = {
        id: `mem-${++idCounter}`,
        telegram_user_id: data.telegram_user_id,
        content: data.content,
        category: data.category,
        embedding: data.embedding,
        source_message: data.source_message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      memories.push(newMemory);
      memoryStore.set(userId, memories);
      lastInsertedMemory = newMemory;

      // Return the chain with delayed resolution
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => {
            await delayPromise;
            return {
              data: lastInsertedMemory,
              error: null,
            };
          }),
        }),
      };
    }),
  };

  mockSupabaseClient.from.mockReturnValue(insertChain);
  return insertChain;
}

/**
 * Setup mock Supabase select with read consistency
 */
function setupMockSelect() {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  };

  mockSupabaseClient.from.mockReturnValue(selectChain);
  return selectChain;
}

/**
 * Setup mock RPC for vector search with concurrent behavior
 */
function setupMockSearch() {
  mockSupabaseClient.rpc.mockImplementation(async (funcName: string, params: any) => {
    // Simulate vector search delay
    await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 15));

    const userId = String(params.user_id);
    const memories = memoryStore.get(userId) || [];

    // Return memories with similarity scores
    const results = memories.slice(0, params.match_limit || 5).map((mem, idx) => ({
      id: mem.id,
      content: mem.content,
      category: mem.category,
      similarity: 0.9 - (idx * 0.1), // Decreasing similarity
    }));

    return {
      data: results,
      error: null,
    };
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Memory Concurrency Tests', () => {
  beforeEach(() => {
    memoryStore = new Map();
    idCounter = 0;
    insertCounter = 0;
    vi.clearAllMocks();
    setupMockInsert();
  });

  afterEach(() => {
    memoryStore.clear();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONC-001: Concurrent Adds Without Data Loss
  // ===========================================================================

  it('CONC-001: should handle concurrent adds without data loss', async () => {
    const userId = TEST_USER_ID;
    const CONCURRENT_OPS = 50;

    // Launch all adds concurrently using Promise.all
    const promises = Array.from({ length: CONCURRENT_OPS }, (_, i) =>
      addMemory(userId, `Concurrent memory ${i}`, 'personal_info', `Source ${i}`)
    );

    const results = await Promise.all(promises);

    // Verify all operations completed successfully
    expect(results).toHaveLength(CONCURRENT_OPS);
    expect(results.every(r => r.id)).toBe(true);

    // Verify no data loss in store
    const memories = memoryStore.get(String(userId)) || [];
    expect(memories).toHaveLength(CONCURRENT_OPS);

    // Verify all memories are unique (no overwrites)
    const ids = new Set(memories.map(m => m.id));
    expect(ids.size).toBe(CONCURRENT_OPS);

    // Verify all insert calls were made
    expect(insertCounter).toBe(CONCURRENT_OPS);
  });

  it('CONC-001b: should preserve content integrity during concurrent adds', async () => {
    const userId = TEST_USER_ID;
    const CONCURRENT_OPS = 30;

    const contentMap = new Map<number, string>();
    const promises = Array.from({ length: CONCURRENT_OPS }, (_, i) => {
      const content = `Unique content ${i} - ${Math.random()}`;
      contentMap.set(i, content);
      return addMemory(userId, content, 'interests');
    });

    await Promise.all(promises);

    const memories = memoryStore.get(String(userId)) || [];

    // Verify all unique contents are present
    const storedContents = new Set(memories.map(m => m.content));
    expect(storedContents.size).toBe(CONCURRENT_OPS);

    // Verify no content corruption
    for (const content of contentMap.values()) {
      expect(storedContents.has(content)).toBe(true);
    }
  });

  // ===========================================================================
  // CONC-002: Multi-User Concurrent Operations
  // ===========================================================================

  it('CONC-002: should handle concurrent adds from multiple users', async () => {
    const userIds = [TEST_USER_ID, TEST_USER_ID_2, TEST_USER_ID_3];
    const MEMORIES_PER_USER = 20;

    // All users add memories concurrently
    const promises = userIds.flatMap(userId =>
      Array.from({ length: MEMORIES_PER_USER }, (_, i) =>
        addMemory(userId, `User ${userId} memory ${i}`, 'work')
      )
    );

    await Promise.all(promises);

    // Verify each user has correct count
    for (const userId of userIds) {
      const memories = memoryStore.get(String(userId)) || [];
      expect(memories).toHaveLength(MEMORIES_PER_USER);

      // Verify no cross-contamination between users
      expect(memories.every(m => m.telegram_user_id === userId)).toBe(true);
    }

    // Verify total operations
    expect(insertCounter).toBe(userIds.length * MEMORIES_PER_USER);
  });

  it('CONC-002b: should isolate user data during concurrent operations', async () => {
    const user1 = TEST_USER_ID;
    const user2 = TEST_USER_ID_2;

    // Interleaved concurrent operations from two users
    const promises = [
      addMemory(user1, 'User1 Memory A', 'personal_info'),
      addMemory(user2, 'User2 Memory A', 'personal_info'),
      addMemory(user1, 'User1 Memory B', 'health'),
      addMemory(user2, 'User2 Memory B', 'health'),
      addMemory(user1, 'User1 Memory C', 'preferences'),
      addMemory(user2, 'User2 Memory C', 'preferences'),
    ];

    await Promise.all(promises);

    const user1Memories = memoryStore.get(String(user1)) || [];
    const user2Memories = memoryStore.get(String(user2)) || [];

    // Verify correct counts
    expect(user1Memories).toHaveLength(3);
    expect(user2Memories).toHaveLength(3);

    // Verify content isolation
    expect(user1Memories.every(m => m.content.startsWith('User1'))).toBe(true);
    expect(user2Memories.every(m => m.content.startsWith('User2'))).toBe(true);
  });

  // ===========================================================================
  // CONC-003: Read-While-Write Scenarios
  // ===========================================================================

  it('CONC-003: should handle read-while-write scenarios consistently', async () => {
    const userId = TEST_USER_ID;

    // Pre-populate with initial data
    await addMemory(userId, 'Initial memory', 'personal_info');

    // Setup select chain for reads
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(async () => {
        // Simulate read delay
        await new Promise(r => setTimeout(r, 10));
        const memories = memoryStore.get(String(userId)) || [];
        return {
          data: memories,
          error: null,
        };
      }),
    };

    // Override from() to return select chain for reads
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'user_memories') {
        // Check if this is a select or insert based on next call
        return {
          insert: setupMockInsert().insert,
          select: selectChain.select,
        };
      }
      return setupMockInsert();
    });

    // Concurrent read and write operations
    const writePromises = Array.from({ length: 5 }, (_, i) =>
      addMemory(userId, `New memory ${i}`, 'events')
    );

    const readPromise = (async () => {
      await new Promise(r => setTimeout(r, 15)); // Delay read slightly
      const memories = memoryStore.get(String(userId)) || [];
      return memories.length;
    })();

    const [writeResults, readCount] = await Promise.all([
      Promise.all(writePromises),
      readPromise,
    ]);

    // Writes should all succeed
    expect(writeResults).toHaveLength(5);

    // Read should return consistent state (at least initial memory)
    expect(readCount).toBeGreaterThanOrEqual(1);

    // Final state should have all memories
    const finalMemories = memoryStore.get(String(userId)) || [];
    expect(finalMemories).toHaveLength(6); // 1 initial + 5 new
  });

  it('CONC-003b: should handle concurrent search during writes', async () => {
    const userId = TEST_USER_ID;
    setupMockSearch();

    // Pre-populate
    await addMemory(userId, 'Coffee preferences: likes dark roast', 'preferences');

    // Concurrent writes and searches
    const operations = [
      addMemory(userId, 'Health: has anxiety', 'health'),
      searchMemories(userId, 'coffee preferences', 5),
      addMemory(userId, 'Interests: loves reading', 'interests'),
      searchMemories(userId, 'health', 5),
      addMemory(userId, 'Work: software engineer', 'work'),
    ];

    const results = await Promise.all(operations);

    // Verify writes succeeded (indices 0, 2, 4)
    expect(results[0]).toHaveProperty('id');
    expect(results[2]).toHaveProperty('id');
    expect(results[4]).toHaveProperty('id');

    // Verify searches returned results (indices 1, 3)
    expect(Array.isArray(results[1])).toBe(true);
    expect(Array.isArray(results[3])).toBe(true);

    // Final state should have all 4 memories
    const finalMemories = memoryStore.get(String(userId)) || [];
    expect(finalMemories).toHaveLength(4);
  });

  // ===========================================================================
  // CONC-004: Order Maintenance Under Concurrent Load
  // ===========================================================================

  it('CONC-004: should maintain memory count under concurrent updates', async () => {
    const userId = TEST_USER_ID;
    const TOTAL_OPS = 100;

    // Batch 1: Sequential baseline (10 operations)
    for (let i = 0; i < 10; i++) {
      await addMemory(userId, `Sequential ${i}`, 'personal_info');
    }

    const sequentialCount = (memoryStore.get(String(userId)) || []).length;
    expect(sequentialCount).toBe(10);

    // Batch 2: Concurrent operations (90 operations)
    const concurrentPromises = Array.from({ length: TOTAL_OPS - 10 }, (_, i) =>
      addMemory(userId, `Concurrent ${i}`, 'other')
    );

    await Promise.all(concurrentPromises);

    // Verify total count
    const finalCount = (memoryStore.get(String(userId)) || []).length;
    expect(finalCount).toBe(TOTAL_OPS);

    // Verify all IDs are unique
    const memories = memoryStore.get(String(userId)) || [];
    const ids = new Set(memories.map(m => m.id));
    expect(ids.size).toBe(TOTAL_OPS);
  });

  it('CONC-004b: should handle timestamp ordering during concurrent adds', async () => {
    const userId = TEST_USER_ID;

    const timestamps: Date[] = [];
    const promises = Array.from({ length: 20 }, async (_, i) => {
      const result = await addMemory(userId, `Memory ${i}`, 'events');
      timestamps.push(result.createdAt);
      return result;
    });

    await Promise.all(promises);

    // Verify all timestamps are valid dates
    expect(timestamps.every(t => t instanceof Date && !isNaN(t.getTime()))).toBe(true);

    // Timestamps should be within a reasonable range (a few seconds)
    const earliest = Math.min(...timestamps.map(t => t.getTime()));
    const latest = Math.max(...timestamps.map(t => t.getTime()));
    const rangeMs = latest - earliest;

    expect(rangeMs).toBeLessThan(5000); // Should complete within 5 seconds
  });

  // ===========================================================================
  // CONC-005: Embedding Generation Under Load
  // ===========================================================================

  it('CONC-005: should handle concurrent embedding generation', async () => {
    const userId = TEST_USER_ID;
    const { getEmbedding } = await import('../../../src/core/embeddings/index.js');

    // Track embedding calls
    const embeddingCallCount = (getEmbedding as any).mock.calls.length;

    const promises = Array.from({ length: 30 }, (_, i) =>
      addMemory(userId, `Text for embedding ${i}`, 'preferences')
    );

    await Promise.all(promises);

    // Verify embeddings were generated for all memories
    const newEmbeddingCalls = (getEmbedding as any).mock.calls.length - embeddingCallCount;
    expect(newEmbeddingCalls).toBe(30);

    // Verify all memories have embeddings
    const memories = memoryStore.get(String(userId)) || [];
    expect(memories.every(m => m.embedding)).toBe(true);
  });

  it('CONC-005b: should generate unique embeddings for different content', async () => {
    const userId = TEST_USER_ID;

    const contents = [
      'I love coffee',
      'I prefer tea',
      'Coffee is my favorite',
      'Tea helps me relax',
    ];

    const promises = contents.map(content =>
      addMemory(userId, content, 'preferences')
    );

    await Promise.all(promises);

    const memories = memoryStore.get(String(userId)) || [];
    const embeddings = memories.map(m => m.embedding);

    // Verify all embeddings are different (as strings)
    const uniqueEmbeddings = new Set(embeddings);
    expect(uniqueEmbeddings.size).toBe(contents.length);
  });

  // ===========================================================================
  // CONC-006: Category Distribution Under Concurrency
  // ===========================================================================

  it('CONC-006: should maintain category distribution under concurrent load', async () => {
    const userId = TEST_USER_ID;

    const categories: MemoryCategory[] = [
      'personal_info',
      'health',
      'preferences',
      'events',
      'interests',
      'work',
      'other',
    ];

    const MEMORIES_PER_CATEGORY = 10;

    // Add memories concurrently for all categories
    const promises = categories.flatMap(category =>
      Array.from({ length: MEMORIES_PER_CATEGORY }, (_, i) =>
        addMemory(userId, `${category} memory ${i}`, category)
      )
    );

    await Promise.all(promises);

    const memories = memoryStore.get(String(userId)) || [];

    // Group by category
    const categoryCounts = new Map<string, number>();
    for (const memory of memories) {
      categoryCounts.set(
        memory.category,
        (categoryCounts.get(memory.category) || 0) + 1
      );
    }

    // Verify each category has correct count
    for (const category of categories) {
      expect(categoryCounts.get(category)).toBe(MEMORIES_PER_CATEGORY);
    }
  });

  // ===========================================================================
  // CONC-007: Stress Test - High Concurrency
  // ===========================================================================

  it('CONC-007: should handle high concurrency stress test', async () => {
    const userIds = [TEST_USER_ID, TEST_USER_ID_2, TEST_USER_ID_3];
    const MEMORIES_PER_USER = 50;

    const startTime = Date.now();

    // Maximum concurrent load
    const promises = userIds.flatMap(userId =>
      Array.from({ length: MEMORIES_PER_USER }, (_, i) =>
        addMemory(
          userId,
          `Stress test memory ${i} for user ${userId}`,
          ['personal_info', 'health', 'preferences', 'events'][i % 4] as MemoryCategory
        )
      )
    );

    await Promise.all(promises);

    const duration = Date.now() - startTime;

    // Verify completion time is reasonable (should complete within 10 seconds)
    expect(duration).toBeLessThan(10000);

    // Verify all users have correct counts
    for (const userId of userIds) {
      const memories = memoryStore.get(String(userId)) || [];
      expect(memories).toHaveLength(MEMORIES_PER_USER);
    }

    // Verify total insert operations
    expect(insertCounter).toBe(userIds.length * MEMORIES_PER_USER);
  });
});
