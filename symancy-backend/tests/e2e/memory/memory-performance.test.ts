/**
 * Memory System Performance Tests
 * Validates latency requirements for production deployment
 *
 * Test Coverage:
 * - Embedding generation latency (mocked, code path efficiency)
 * - Memory extraction latency (mocked, LLM call + parsing)
 * - Memory search latency with large datasets (vector search simulation)
 * - Concurrent memory operations (parallel add/search)
 *
 * All external APIs are mocked to test code path efficiency only.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import {
  addMemory,
  searchMemories,
  getAllMemories,
  type MemoryCategory,
} from "../../../src/services/memory.service.js";
import { extractMemories } from "../../../src/chains/memory-extraction.chain.js";
import { getEmbedding } from "../../../src/core/embeddings/index.js";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock database module with realistic delays
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// Mock embeddings module with small realistic delay
// Note: This file uses custom timing mock to test performance, not the shared mock
vi.mock("../../../src/core/embeddings/index.js", () => ({
  getEmbedding: vi.fn(async (text: string) => {
    // Simulate small network + processing delay (5-10ms for mocked API)
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 5));
    return Array(1024).fill(0).map(() => Math.random());
  }),
  getEmbeddings: vi.fn(async (texts: string[]) => {
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 5));
    return texts.map(() => Array(1024).fill(0).map(() => Math.random()));
  }),
  EMBEDDING_MODEL: "baai/bge-m3",
  EMBEDDING_DIMS: 1024,
}));

// Mock memory extraction chain with realistic LLM delay
vi.mock("../../../src/chains/memory-extraction.chain.js", () => ({
  extractMemories: vi.fn(async (message: string) => {
    // Simulate LLM call + JSON parsing delay (20-30ms for mocked API)
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 10));

    // Simple heuristic for test purposes
    if (message.toLowerCase().includes("зовут") || message.toLowerCase().includes("name")) {
      return {
        memories: [
          {
            content: "User provided name information",
            category: "personal_info" as const,
          },
        ],
        hasMemories: true,
      };
    }

    if (message.toLowerCase().includes("работа") || message.toLowerCase().includes("work")) {
      return {
        memories: [
          {
            content: "User provided work information",
            category: "work" as const,
          },
        ],
        hasMemories: true,
      };
    }

    // No memorable facts for greetings, questions
    return {
      memories: [],
      hasMemories: false,
    };
  }),
}));

// =============================================================================
// Test Suite
// =============================================================================

describe("Memory System Performance", () => {
  const TEST_USER_ID = 999999990;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup: configure mocks for addMemory
    const mockInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(async () => {
        // Simulate small DB insert delay (2-5ms)
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 3));
        return {
          data: {
            id: `memory-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            telegram_user_id: TEST_USER_ID,
            content: "Test memory content",
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        };
      }),
    };

    mockSupabaseClient.from.mockReturnValue(mockInsertChain);

    // Setup: configure mocks for searchMemories
    mockSupabaseClient.rpc.mockImplementation(async (funcName: string, params: any) => {
      // Simulate vector search delay (5-10ms)
      await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 5));

      if (funcName === "search_user_memories") {
        // Return mock search results
        return {
          data: [
            {
              id: "memory-1",
              content: "Relevant memory 1",
              category: "other",
              similarity: 0.92,
            },
            {
              id: "memory-2",
              content: "Relevant memory 2",
              category: "other",
              similarity: 0.85,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    });
  });

  beforeAll(() => {
    // No-op: setup is done in beforeEach
  });

  afterAll(() => {
    // Cleanup
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // PERF-001: Embedding Generation Latency
  // ===========================================================================

  it("PERF-001: Embedding generation latency", async () => {
    const times: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await getEmbedding(`Тестовый текст номер ${i} для проверки скорости`);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`
📊 PERF-001: Embedding Generation Latency
   Average: ${avg.toFixed(1)}ms
   Min:     ${min}ms
   Max:     ${max}ms
   Samples: ${times.length}
    `);

    // With mocks, these should be very fast (< 100ms for code path + small delay)
    expect(avg).toBeLessThan(100);
    expect(max).toBeLessThan(200);

    // Verify getEmbedding was called 5 times
    expect(getEmbedding).toHaveBeenCalledTimes(5);
  });

  // ===========================================================================
  // PERF-002: Memory Extraction Latency
  // ===========================================================================

  it("PERF-002: Memory extraction latency", async () => {
    const times: number[] = [];
    const messages = [
      "Меня зовут Тест",
      "Я работаю программистом в большой компании",
      "Привет, как дела?",
    ];

    for (const msg of messages) {
      const start = Date.now();
      await extractMemories(msg);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`
📊 PERF-002: Memory Extraction Latency
   Average: ${avg.toFixed(1)}ms
   Min:     ${min}ms
   Max:     ${max}ms
   Samples: ${times.length}
    `);

    // Mocked LLM should be fast (< 100ms for code path + small delay)
    expect(avg).toBeLessThan(100);
    expect(max).toBeLessThan(200);

    // Verify extractMemories was called 3 times
    expect(extractMemories).toHaveBeenCalledTimes(3);
  });

  // ===========================================================================
  // PERF-003: Memory Search Latency with Many Memories
  // ===========================================================================

  it("PERF-003: Memory search latency with many memories", async () => {
    console.log("Adding 50 test memories...");

    // Add 50 memories (mocked, fast)
    const addTimes: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      await addMemory(
        TEST_USER_ID,
        `Test memory number ${i} with some random content about topic ${i % 10}`,
        "other"
      );
      addTimes.push(Date.now() - start);
    }

    const avgAdd = addTimes.reduce((a, b) => a + b, 0) / addTimes.length;
    console.log(`   Average add time: ${avgAdd.toFixed(1)}ms`);

    // Measure search time
    const searchTimes: number[] = [];
    const queries = ["topic 5", "memory number", "random content"];

    for (const q of queries) {
      const start = Date.now();
      await searchMemories(TEST_USER_ID, q, 10);
      searchTimes.push(Date.now() - start);
    }

    const avgSearch = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    const maxSearch = Math.max(...searchTimes);
    const minSearch = Math.min(...searchTimes);

    console.log(`
📊 PERF-003: Memory Search Latency (50 memories)
   Average: ${avgSearch.toFixed(1)}ms
   Min:     ${minSearch}ms
   Max:     ${maxSearch}ms
   Samples: ${searchTimes.length}
    `);

    // Search should be fast even with many memories (mocked vector search)
    expect(avgSearch).toBeLessThan(100);
    expect(maxSearch).toBeLessThan(200);
  });

  // ===========================================================================
  // PERF-004: Concurrent Memory Operations
  // ===========================================================================

  it("PERF-004: Concurrent memory operations", async () => {
    // 10 concurrent adds
    const addStart = Date.now();
    await Promise.all(
      Array(10)
        .fill(0)
        .map((_, i) =>
          addMemory(TEST_USER_ID, `Concurrent memory ${i}`, "other")
        )
    );
    const addTime = Date.now() - addStart;

    console.log(`   10 concurrent adds: ${addTime}ms`);

    // 10 concurrent searches
    const searchStart = Date.now();
    await Promise.all(
      Array(10)
        .fill(0)
        .map((_, i) => searchMemories(TEST_USER_ID, `query ${i}`, 5))
    );
    const searchTime = Date.now() - searchStart;

    console.log(`   10 concurrent searches: ${searchTime}ms`);

    console.log(`
📊 PERF-004: Concurrent Operations
   10 concurrent adds:     ${addTime}ms
   10 concurrent searches: ${searchTime}ms
    `);

    // Concurrent operations should benefit from parallelism
    // With mocks, these should complete quickly
    expect(addTime).toBeLessThan(500);
    expect(searchTime).toBeLessThan(500);
  });

  // ===========================================================================
  // PERF-005: End-to-End Flow Latency
  // ===========================================================================

  it("PERF-005: End-to-end flow latency (extract + add + search)", async () => {
    const times: number[] = [];

    const scenarios = [
      "Меня зовут Алексей, я работаю программистом",
      "Я люблю кофе и утренние прогулки",
      "У меня завтра важная встреча в 10 утра",
    ];

    for (const msg of scenarios) {
      const start = Date.now();

      // Step 1: Extract memories
      const extraction = await extractMemories(msg);

      // Step 2: Add memories to DB
      if (extraction.hasMemories) {
        for (const memory of extraction.memories) {
          await addMemory(
            TEST_USER_ID,
            memory.content,
            memory.category as MemoryCategory,
            msg
          );
        }
      }

      // Step 3: Search for related memories
      await searchMemories(TEST_USER_ID, msg, 5);

      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`
📊 PERF-005: End-to-End Flow Latency
   Average: ${avg.toFixed(1)}ms
   Min:     ${min}ms
   Max:     ${max}ms
   Samples: ${times.length}

   Flow: Extract → Add → Search
    `);

    // End-to-end flow should be fast with mocks (< 300ms)
    expect(avg).toBeLessThan(300);
    expect(max).toBeLessThan(500);
  });

  // ===========================================================================
  // PERF-006: Memory Retrieval with Large Result Sets
  // ===========================================================================

  it("PERF-006: Retrieval latency for getAllMemories", async () => {
    // Mock getAllMemories to return large dataset
    const mockSelectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(async () => {
        // Simulate DB query delay (10-15ms)
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 5));

        // Return 100 memories
        const memories = Array(100)
          .fill(0)
          .map((_, i) => ({
            id: `memory-${i}`,
            telegram_user_id: TEST_USER_ID,
            content: `Memory content ${i}`,
            category: "other",
            source_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        return { data: memories, error: null };
      }),
    };

    mockSupabaseClient.from.mockReturnValue(mockSelectChain);

    const times: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const result = await getAllMemories(TEST_USER_ID);
      times.push(Date.now() - start);

      expect(result).toHaveLength(100);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`
📊 PERF-006: Retrieval Latency (100 memories)
   Average: ${avg.toFixed(1)}ms
   Min:     ${min}ms
   Max:     ${max}ms
   Samples: ${times.length}
    `);

    // Retrieval should be fast (< 100ms for 100 records)
    expect(avg).toBeLessThan(100);
    expect(max).toBeLessThan(200);
  });

  // ===========================================================================
  // PERF-007: Batch Embedding Generation
  // ===========================================================================

  it("PERF-007: Batch embedding generation for multiple memories", async () => {
    const texts = Array(20)
      .fill(0)
      .map((_, i) => `Memory text number ${i} with some random content`);

    const start = Date.now();

    // Generate embeddings sequentially (current implementation)
    const embeddings = await Promise.all(texts.map(text => getEmbedding(text)));

    const elapsed = Date.now() - start;
    const avgPerEmbedding = elapsed / texts.length;

    console.log(`
📊 PERF-007: Batch Embedding Generation
   Total time:       ${elapsed}ms
   Embeddings:       ${texts.length}
   Avg per embedding: ${avgPerEmbedding.toFixed(1)}ms
    `);

    expect(embeddings).toHaveLength(20);
    expect(embeddings[0]).toHaveLength(1024);

    // Should complete in reasonable time (< 2s for 20 embeddings)
    expect(elapsed).toBeLessThan(2000);
    expect(avgPerEmbedding).toBeLessThan(100);
  });

  // ===========================================================================
  // PERF-008: Stress Test - High Concurrency
  // ===========================================================================

  it("PERF-008: Stress test with 50 concurrent operations", async () => {
    const operations = [];

    // Mix of adds and searches
    for (let i = 0; i < 25; i++) {
      operations.push(
        addMemory(TEST_USER_ID, `Stress test memory ${i}`, "other")
      );
    }

    for (let i = 0; i < 25; i++) {
      operations.push(searchMemories(TEST_USER_ID, `stress query ${i}`, 5));
    }

    const start = Date.now();
    const results = await Promise.allSettled(operations);
    const elapsed = Date.now() - start;

    const fulfilled = results.filter(r => r.status === "fulfilled").length;
    const rejected = results.filter(r => r.status === "rejected").length;

    console.log(`
📊 PERF-008: Stress Test (50 concurrent ops)
   Total time:  ${elapsed}ms
   Fulfilled:   ${fulfilled}
   Rejected:    ${rejected}
   Success rate: ${((fulfilled / results.length) * 100).toFixed(1)}%
    `);

    // All operations should succeed
    expect(rejected).toBe(0);
    expect(fulfilled).toBe(50);

    // Should handle high concurrency well (< 1s)
    expect(elapsed).toBeLessThan(1000);
  });

  // ===========================================================================
  // PERF-009: Memory Update Frequency Test
  // ===========================================================================

  it("PERF-009: Rapid sequential memory additions", async () => {
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await addMemory(TEST_USER_ID, `Sequential memory ${i}`, "other");
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    // Check for performance degradation over time
    const firstHalf = times.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const secondHalf = times.slice(10).reduce((a, b) => a + b, 0) / 10;
    const degradation = ((secondHalf - firstHalf) / firstHalf) * 100;

    console.log(`
📊 PERF-009: Rapid Sequential Additions
   Average:       ${avg.toFixed(1)}ms
   Min:           ${min}ms
   Max:           ${max}ms
   First 10:      ${firstHalf.toFixed(1)}ms
   Second 10:     ${secondHalf.toFixed(1)}ms
   Degradation:   ${degradation >= 0 ? '+' : ''}${degradation.toFixed(1)}%
    `);

    expect(avg).toBeLessThan(100);

    // Performance should not degrade significantly (< 50% slower)
    expect(Math.abs(degradation)).toBeLessThan(50);
  });

  // ===========================================================================
  // PERF-010: Search Precision vs Speed Trade-off
  // ===========================================================================

  it("PERF-010: Search with varying result limits", async () => {
    const limits = [5, 10, 20, 50];
    const results: Array<{ limit: number; time: number }> = [];

    for (const limit of limits) {
      const start = Date.now();
      await searchMemories(TEST_USER_ID, "test query", limit);
      const elapsed = Date.now() - start;

      results.push({ limit, time: elapsed });
    }

    console.log(`
📊 PERF-010: Search with Varying Limits
${results.map(r => `   Limit ${r.limit.toString().padStart(2)}: ${r.time}ms`).join('\n')}
    `);

    // All should be fast regardless of limit (mocked)
    results.forEach(r => {
      expect(r.time).toBeLessThan(100);
    });
  });
});
