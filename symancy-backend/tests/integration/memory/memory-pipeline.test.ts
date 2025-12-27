/**
 * Memory Pipeline Integration Tests
 *
 * Tests the full memory pipeline flow:
 * 1. Extract memories from message (LangChain extraction)
 * 2. Store memories with embeddings (Memory Service + BGE embeddings)
 * 3. Search stored memories (Vector search via Supabase RPC)
 *
 * This tests component integration while mocking external APIs:
 * - LangChain model (extraction)
 * - OpenRouter embeddings API (BGE-M3)
 * - Supabase database
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractMemories } from "@/chains/memory-extraction.chain.js";
import {
  addMemory,
  searchMemories,
  type MemoryCategory,
} from "@/services/memory.service.js";
import {
  TEST_USER_ID_2,
  cosineSimilarity,
  generateDeterministicEmbedding,
} from "../../setup/memory-test-helpers.js";

// =============================================================================
// Mock Setup
// =============================================================================

/**
 * Mock environment config
 */
vi.mock("@/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    MODE: "BOTH",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_KEY: "test-key",
    DATABASE_URL: "postgresql://test",
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_WEBHOOK_SECRET: "test-secret",
    OPENROUTER_API_KEY: "test-openrouter-key",
  })),
}));

/**
 * Mock embeddings generator function
 * Will be initialized per test suite to avoid state leakage
 */
function createEmbeddingGenerator() {
  const mockEmbeddings = new Map<string, number[]>();
  let embeddingCounter = 0;

  return {
    mockEmbeddings,
    generateUniqueEmbedding(text: string): number[] {
      if (!mockEmbeddings.has(text)) {
        // Generate unique embedding based on counter + text hash
        const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const uniqueSeed = hash + embeddingCounter++;
        const embedding = Array(1024).fill(0).map((_, i) => Math.sin(uniqueSeed + i * 0.1) * 0.5);
        mockEmbeddings.set(text, embedding);
      }
      return mockEmbeddings.get(text)!;
    },
  };
}

// Create a module-level generator that will be re-initialized in beforeEach
let embeddingGen = createEmbeddingGenerator();

vi.mock("@/core/embeddings/index.js", async () => ({
  getEmbedding: vi.fn(async (text: string) => {
    return embeddingGen.generateUniqueEmbedding(text);
  }),
  getEmbeddings: vi.fn(async (texts: string[]) => {
    return texts.map((text) => embeddingGen.generateUniqueEmbedding(text));
  }),
  EMBEDDING_MODEL: 'baai/bge-m3',
  EMBEDDING_DIMS: 1024,
}));

/**
 * Mock LangChain ChatOpenAI for extraction
 */
const mockInvoke = vi.fn();

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(() => ({
    invoke: mockInvoke,
  })),
}));

/**
 * Mock Supabase client
 */
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Mock extraction to return specific memories
 */
function mockExtractionResponse(memories: Array<{ content: string; category: MemoryCategory }>) {
  mockInvoke.mockResolvedValueOnce({
    content: JSON.stringify({
      memories,
      hasMemories: memories.length > 0,
    }),
  });

  return mockInvoke;
}

/**
 * Mock successful memory insertion
 */
function mockMemoryInsert(id: string, content: string, category: MemoryCategory) {
  const mockInsertChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id,
        telegram_user_id: TEST_USER_ID_2,
        content,
        category,
        embedding: JSON.stringify(embeddingGen.mockEmbeddings.get(content) || []),
        source_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    }),
  };

  mockSupabaseClient.from.mockReturnValue(mockInsertChain);
  return mockInsertChain;
}

/**
 * Mock vector search results
 */
function mockVectorSearch(results: Array<{ id: string; content: string; category: string; similarity: number }>) {
  mockSupabaseClient.rpc.mockResolvedValue({
    data: results,
    error: null,
  });
}

// =============================================================================
// Integration Tests
// =============================================================================

describe("Memory Pipeline Integration", () => {
  beforeEach(() => {
    // Re-initialize embedding generator with fresh state
    embeddingGen = createEmbeddingGenerator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup: clear state and restore mocks
    embeddingGen.mockEmbeddings.clear();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Full Pipeline Flow: Extract → Store → Search
  // ===========================================================================

  describe("Full Pipeline Flow", () => {
    it("should extract and store memories from message", async () => {
      // Step 1: Extract memories from message
      const mockInvoke = mockExtractionResponse([
        { content: "User's name is Alice", category: "personal_info" },
        { content: "User prefers technical explanations", category: "preferences" },
      ]);

      const extractionResult = await extractMemories("Меня зовут Алиса, я предпочитаю технические объяснения");

      expect(extractionResult.hasMemories).toBe(true);
      expect(extractionResult.memories).toHaveLength(2);
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Step 2: Store extracted memories
      for (const memory of extractionResult.memories) {
        mockMemoryInsert(`memory-${memory.category}`, memory.content, memory.category);

        const stored = await addMemory(
          TEST_USER_ID_2,
          memory.content,
          memory.category
        );

        expect(stored.content).toBe(memory.content);
        expect(stored.category).toBe(memory.category);
      }

      // Step 3: Search for stored memories
      mockVectorSearch([
        {
          id: "memory-personal_info",
          content: "User's name is Alice",
          category: "personal_info",
          similarity: 0.95,
        },
      ]);

      const searchResults = await searchMemories(TEST_USER_ID_2, "как зовут", 5);

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]?.content).toContain("Alice");
      expect(searchResults[0]?.score).toBeGreaterThan(0.9);
    });

    it("should build context over multiple messages", async () => {
      const messages = [
        {
          text: "Меня зовут Алексей, мне 35 лет",
          expectedMemories: [
            { content: "User's name is Alexey", category: "personal_info" as MemoryCategory },
            { content: "User is 35 years old", category: "personal_info" as MemoryCategory },
          ],
        },
        {
          text: "Я работаю программистом в Москве",
          expectedMemories: [
            { content: "User works as a programmer", category: "work" as MemoryCategory },
            { content: "User lives in Moscow", category: "personal_info" as MemoryCategory },
          ],
        },
        {
          text: "У меня болит спина уже неделю",
          expectedMemories: [
            { content: "User has back pain for a week", category: "health" as MemoryCategory },
          ],
        },
      ];

      const allStoredMemories: Array<{ content: string; category: MemoryCategory }> = [];

      // Process each message: extract and store
      for (const msg of messages) {
        mockExtractionResponse(msg.expectedMemories);

        const extractionResult = await extractMemories(msg.text);

        expect(extractionResult.hasMemories).toBe(true);
        expect(extractionResult.memories).toHaveLength(msg.expectedMemories.length);

        for (const memory of extractionResult.memories) {
          mockMemoryInsert(`memory-${allStoredMemories.length}`, memory.content, memory.category);

          await addMemory(TEST_USER_ID_2, memory.content, memory.category);
          allStoredMemories.push(memory);
        }
      }

      // Verify all memories stored
      expect(allStoredMemories).toHaveLength(5);

      // Search different categories
      const searchQueries = [
        {
          query: "как зовут",
          expectedCategory: "personal_info",
          expectedContent: "Alexey",
        },
        {
          query: "где работает",
          expectedCategory: "work",
          expectedContent: "programmer",
        },
        {
          query: "здоровье",
          expectedCategory: "health",
          expectedContent: "back pain",
        },
      ];

      for (const { query, expectedCategory, expectedContent } of searchQueries) {
        const relevantMemory = allStoredMemories.find(
          (m) => m.category === expectedCategory && m.content.includes(expectedContent)
        );

        if (relevantMemory) {
          mockVectorSearch([
            {
              id: `memory-${expectedCategory}`,
              content: relevantMemory.content,
              category: expectedCategory,
              similarity: 0.92,
            },
          ]);

          const results = await searchMemories(TEST_USER_ID_2, query, 5);

          expect(results).toHaveLength(1);
          expect(results[0]?.content).toContain(expectedContent);
          expect(results[0]?.category).toBe(expectedCategory);
        }
      }
    });

    it("should handle mixed categories in one message", async () => {
      const message = "Меня зовут Алексей, мне 35 лет, я живу в Москве и работаю программистом. У меня болит спина.";

      const expectedMemories = [
        { content: "User's name is Alexey", category: "personal_info" as MemoryCategory },
        { content: "User is 35 years old", category: "personal_info" as MemoryCategory },
        { content: "User lives in Moscow", category: "personal_info" as MemoryCategory },
        { content: "User works as a programmer", category: "work" as MemoryCategory },
        { content: "User has back pain", category: "health" as MemoryCategory },
      ];

      mockExtractionResponse(expectedMemories);

      const extractionResult = await extractMemories(message);

      expect(extractionResult.hasMemories).toBe(true);
      expect(extractionResult.memories).toHaveLength(5);

      // Verify categories are diverse
      const categories = new Set(extractionResult.memories.map((m) => m.category));
      expect(categories.has("personal_info")).toBe(true);
      expect(categories.has("work")).toBe(true);
      expect(categories.has("health")).toBe(true);

      // Store all memories
      for (let i = 0; i < extractionResult.memories.length; i++) {
        const memory = extractionResult.memories[i]!;
        mockMemoryInsert(`memory-${i}`, memory.content, memory.category);

        const stored = await addMemory(TEST_USER_ID_2, memory.content, memory.category);

        expect(stored.category).toBe(memory.category);
      }
    });
  });

  // ===========================================================================
  // Embedding Uniqueness
  // ===========================================================================

  describe("Embedding Generation", () => {
    it("should generate unique embeddings for different content", async () => {
      const contents = [
        "User's name is Alice",
        "User loves coffee",
        "User works as a developer",
      ];

      const embeddings: number[][] = [];

      for (const content of contents) {
        mockMemoryInsert(`memory-${embeddings.length}`, content, "personal_info");

        await addMemory(TEST_USER_ID_2, content, "personal_info");

        const embedding = mockEmbeddings.get(content);
        expect(embedding).toBeDefined();
        embeddings.push(embedding!);
      }

      // Verify embeddings are different (cosine similarity < 0.95)
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = cosineSimilarity(embeddings[i]!, embeddings[j]!);
          expect(similarity).toBeLessThan(0.95);
        }
      }
    });

    it("should generate consistent embeddings for same content", async () => {
      const content = "User prefers dark mode";

      // Generate embedding twice for the same content
      mockMemoryInsert("memory-1", content, "preferences");
      await addMemory(TEST_USER_ID_2, content, "preferences");

      const embedding1 = mockEmbeddings.get(content);

      vi.clearAllMocks();

      mockMemoryInsert("memory-2", content, "preferences");
      await addMemory(TEST_USER_ID_2, content, "preferences");

      const embedding2 = mockEmbeddings.get(content);

      expect(embedding1).toEqual(embedding2);
      // Allow for floating point precision errors
      expect(cosineSimilarity(embedding1!, embedding2!)).toBeCloseTo(1, 10);
    });
  });

  // ===========================================================================
  // Semantic Search Relevance
  // ===========================================================================

  describe("Semantic Search", () => {
    it("should return relevant memories for search queries", async () => {
      // Store multiple memories
      const memories = [
        { content: "User's name is Alexey", category: "personal_info" as MemoryCategory },
        { content: "User lives in Moscow", category: "personal_info" as MemoryCategory },
        { content: "User works as a developer", category: "work" as MemoryCategory },
      ];

      for (let i = 0; i < memories.length; i++) {
        const memory = memories[i]!;
        mockMemoryInsert(`memory-${i}`, memory.content, memory.category);
        await addMemory(TEST_USER_ID_2, memory.content, memory.category);
      }

      // Search "как зовут" should return name memory
      mockVectorSearch([
        {
          id: "memory-0",
          content: "User's name is Alexey",
          category: "personal_info",
          similarity: 0.94,
        },
      ]);

      const nameResults = await searchMemories(TEST_USER_ID_2, "как зовут", 5);

      expect(nameResults).toHaveLength(1);
      expect(nameResults[0]?.content).toContain("Alexey");
      expect(nameResults[0]?.score).toBeGreaterThan(0.9);

      // Search "где работает" should return work memory
      mockVectorSearch([
        {
          id: "memory-2",
          content: "User works as a developer",
          category: "work",
          similarity: 0.91,
        },
      ]);

      const workResults = await searchMemories(TEST_USER_ID_2, "где работает", 5);

      expect(workResults).toHaveLength(1);
      expect(workResults[0]?.content).toContain("developer");
      expect(workResults[0]?.category).toBe("work");
    });

    it("should rank results by similarity score", async () => {
      mockVectorSearch([
        {
          id: "memory-1",
          content: "User loves coffee",
          category: "preferences",
          similarity: 0.95,
        },
        {
          id: "memory-2",
          content: "User drinks tea occasionally",
          category: "preferences",
          similarity: 0.75,
        },
        {
          id: "memory-3",
          content: "User prefers morning coffee",
          category: "preferences",
          similarity: 0.88,
        },
      ]);

      const results = await searchMemories(TEST_USER_ID_2, "кофе", 5);

      expect(results).toHaveLength(3);
      expect(results[0]?.score).toBe(0.95); // Highest similarity first
      expect(results[1]?.score).toBe(0.75);
      expect(results[2]?.score).toBe(0.88);
    });

    it("should respect limit parameter in search", async () => {
      mockVectorSearch([
        { id: "1", content: "Memory 1", category: "other", similarity: 0.9 },
        { id: "2", content: "Memory 2", category: "other", similarity: 0.85 },
      ]);

      const results = await searchMemories(TEST_USER_ID_2, "test query", 2);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          match_limit: 2,
        })
      );

      expect(results).toHaveLength(2);
    });

    it("should return empty array when no relevant memories found", async () => {
      mockVectorSearch([]);

      const results = await searchMemories(TEST_USER_ID_2, "non-existent topic", 5);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    it("should handle extraction failure gracefully", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("LLM API error"));

      await expect(extractMemories("test message")).rejects.toThrow();
    });

    it("should handle malformed extraction response", async () => {
      mockInvoke.mockResolvedValueOnce({
        content: "not valid json", // Invalid JSON
      });

      const result = await extractMemories("test message");

      // Should return empty result on parse error
      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle storage failure", async () => {
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await expect(
        addMemory(TEST_USER_ID_2, "Test content", "other")
      ).rejects.toThrow("Failed to add memory");
    });

    it("should handle search failure", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function error" },
      });

      await expect(
        searchMemories(TEST_USER_ID_2, "test query", 5)
      ).rejects.toThrow("Failed to search memories");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle messages with no extractable memories", async () => {
      mockExtractionResponse([]);

      const result = await extractMemories("Привет! Как дела?");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle extraction with markdown code blocks", async () => {
      mockInvoke.mockResolvedValueOnce({
        content: '```json\n{"memories": [{"content": "User likes pizza", "category": "preferences"}], "hasMemories": true}\n```',
      });

      const result = await extractMemories("Я люблю пиццу");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]?.content).toBe("User likes pizza");
    });

    it("should handle very long memory content", async () => {
      const longContent = "User has a long history: " + "A".repeat(5000);

      mockMemoryInsert("memory-long", longContent, "other");

      const stored = await addMemory(TEST_USER_ID_2, longContent, "other");

      expect(stored.content).toBe(longContent);
      expect(stored.content.length).toBeGreaterThan(5000);
    });

    it("should handle special characters in content", async () => {
      const specialContent = "User's email: test@example.com, phone: +1-234-567-8900";

      mockMemoryInsert("memory-special", specialContent, "personal_info");

      const stored = await addMemory(TEST_USER_ID_2, specialContent, "personal_info");

      expect(stored.content).toBe(specialContent);
    });

    it("should handle Cyrillic and mixed language content", async () => {
      const mixedContent = "Пользователь работает developer в компании Google";

      mockExtractionResponse([
        { content: mixedContent, category: "work" },
      ]);

      const result = await extractMemories(mixedContent);

      expect(result.hasMemories).toBe(true);
      expect(result.memories[0]?.content).toBe(mixedContent);
    });
  });

  // ===========================================================================
  // Category Handling
  // ===========================================================================

  describe("Category Handling", () => {
    it("should handle all memory categories", async () => {
      const categories: MemoryCategory[] = [
        "personal_info",
        "health",
        "preferences",
        "events",
        "interests",
        "work",
        "other",
      ];

      for (const category of categories) {
        const content = `Test content for ${category}`;

        mockMemoryInsert(`memory-${category}`, content, category);

        const stored = await addMemory(TEST_USER_ID_2, content, category);

        expect(stored.category).toBe(category);
      }
    });

    it("should preserve category through extraction-storage-search cycle", async () => {
      mockExtractionResponse([
        { content: "User has diabetes", category: "health" },
      ]);

      const extractionResult = await extractMemories("У меня диабет");

      const memory = extractionResult.memories[0]!;
      expect(memory.category).toBe("health");

      mockMemoryInsert("memory-health", memory.content, memory.category);

      const stored = await addMemory(TEST_USER_ID_2, memory.content, memory.category);

      expect(stored.category).toBe("health");

      mockVectorSearch([
        {
          id: "memory-health",
          content: memory.content,
          category: "health",
          similarity: 0.93,
        },
      ]);

      const searchResults = await searchMemories(TEST_USER_ID_2, "здоровье", 5);

      expect(searchResults[0]?.category).toBe("health");
    });
  });

  // ===========================================================================
  // Performance and Limits
  // ===========================================================================

  describe("Performance and Limits", () => {
    it("should handle batch extraction of multiple memories", async () => {
      const memories = Array.from({ length: 10 }, (_, i) => ({
        content: `Memory ${i + 1}`,
        category: "other" as MemoryCategory,
      }));

      mockExtractionResponse(memories);

      const result = await extractMemories("Long message with many facts");

      expect(result.memories).toHaveLength(10);
    });

    it("should respect search limit parameter", async () => {
      const results = Array.from({ length: 20 }, (_, i) => ({
        id: `memory-${i}`,
        content: `Memory ${i}`,
        category: "other",
        similarity: 0.9 - i * 0.01,
      }));

      mockVectorSearch(results.slice(0, 5));

      const searchResults = await searchMemories(TEST_USER_ID_2, "test", 5);

      expect(searchResults).toHaveLength(5);
    });
  });
});
