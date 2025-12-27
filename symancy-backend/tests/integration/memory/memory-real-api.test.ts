/**
 * Memory System Real API Integration Tests
 *
 * These tests run against REAL APIs (not mocks) for pre-production validation.
 * Skip by default - only run when REAL_API_TESTS=true is set.
 *
 * Run with: REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts
 * Or use: ./scripts/run-real-api-tests.sh
 *
 * REQUIREMENTS:
 * - OPENROUTER_API_KEY must be set
 * - SUPABASE_URL must be set
 * - SUPABASE_SERVICE_KEY must be set
 *
 * WARNING: These tests will:
 * - Consume OpenRouter API credits
 * - Write to real Supabase database
 * - Take longer than mock tests (30-120s per test)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Skip entire suite if REAL_API_TESTS is not set
const SKIP_REAL_API = !process.env.REAL_API_TESTS;

describe.skipIf(SKIP_REAL_API)("Memory System - Real API Integration", () => {
  // Use a unique test user ID to avoid conflicts
  const TEST_USER_ID = 888888888;
  const createdMemoryIds: string[] = [];

  beforeAll(async () => {
    // Verify required environment variables
    const required = ["OPENROUTER_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please set these in your .env file or environment.`
      );
    }

    console.log("\n✓ Environment variables verified");
    console.log("⚠️  Real API tests will consume API credits and write to database");
    console.log(`   Test user ID: ${TEST_USER_ID}\n`);
  });

  afterAll(async () => {
    // Cleanup: delete all test memories
    if (createdMemoryIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdMemoryIds.length} test memories...`);
      const { deleteMemory } = await import("@/services/memory.service.js");

      for (const id of createdMemoryIds) {
        try {
          await deleteMemory(id);
        } catch (error) {
          console.warn(`   ⚠️  Failed to delete memory ${id}:`, error);
        }
      }
      console.log("✓ Test cleanup completed\n");
    }
  });

  describe("Real BGE Embeddings", () => {
    it("should generate real 1024-dim embedding from OpenRouter", async () => {
      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const embedding = await getEmbedding("Привет, меня зовут Тест");

      expect(embedding).toHaveLength(1024);
      expect(embedding.every(v => typeof v === "number")).toBe(true);

      // Real embeddings should have varied values (not all zeros or same)
      const uniqueValues = new Set(embedding.slice(0, 100).map(v => v.toFixed(4)));
      expect(uniqueValues.size).toBeGreaterThan(50);
    }, 30000); // 30s timeout for API call

    it("should generate consistent embeddings for same text", async () => {
      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const text = "Тестовый текст для проверки консистентности";
      const embedding1 = await getEmbedding(text);
      const embedding2 = await getEmbedding(text);

      // Same text should produce very similar embeddings (cosine similarity > 0.99)
      const dotProduct = embedding1.reduce((sum, v, i) => sum + v * embedding2[i], 0);
      const norm1 = Math.sqrt(embedding1.reduce((sum, v) => sum + v * v, 0));
      const norm2 = Math.sqrt(embedding2.reduce((sum, v) => sum + v * v, 0));
      const similarity = dotProduct / (norm1 * norm2);

      expect(similarity).toBeGreaterThan(0.99);
    }, 60000);

    it("should handle Russian, English, and Chinese text", async () => {
      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const texts = [
        "Привет, как дела?",           // Russian
        "Hello, how are you?",         // English
        "你好，你好吗？",              // Chinese
      ];

      for (const text of texts) {
        const embedding = await getEmbedding(text);

        expect(embedding).toHaveLength(1024);
        expect(embedding.every(v => typeof v === "number")).toBe(true);
      }
    }, 90000); // 90s for 3 API calls
  });

  describe("Real Memory Extraction", () => {
    it("should extract memories from Russian text using real LLM", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");

      const result = await extractMemories("Меня зовут Алексей, мне 35 лет, я работаю программистом.");

      expect(result.hasMemories).toBe(true);
      expect(result.memories.length).toBeGreaterThanOrEqual(2);

      // Should extract name, age, and/or job
      const contents = result.memories.map(m => m.content.toLowerCase());
      const hasName = contents.some(c => c.includes("алексей") || c.includes("имя"));
      const hasAge = contents.some(c => c.includes("35") || c.includes("год") || c.includes("age"));
      const hasJob = contents.some(c => c.includes("программист") || c.includes("работ"));

      expect(hasName || hasAge || hasJob).toBe(true);

      console.log("   Extracted memories:");
      result.memories.forEach(m => {
        console.log(`     [${m.category}] ${m.content}`);
      });
    }, 30000);

    it("should return empty for greetings", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");

      const result = await extractMemories("Привет! Как дела?");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    }, 30000);

    it("should extract health information", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");

      const result = await extractMemories(
        "У меня часто болит голова, особенно по утрам. Принимаю парацетамол."
      );

      expect(result.hasMemories).toBe(true);

      const healthMemories = result.memories.filter(m => m.category === "health");
      expect(healthMemories.length).toBeGreaterThanOrEqual(1);

      console.log("   Health memories:");
      healthMemories.forEach(m => {
        console.log(`     ${m.content}`);
      });
    }, 30000);

    it("should categorize work-related information", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");

      const result = await extractMemories(
        "I work as a software engineer at Google, currently working on the search team."
      );

      expect(result.hasMemories).toBe(true);

      const workMemories = result.memories.filter(m => m.category === "work");
      expect(workMemories.length).toBeGreaterThanOrEqual(1);
    }, 30000);
  });

  describe("Real Supabase Memory Storage", () => {
    it("should store and retrieve memory from real database", async () => {
      const { addMemory, searchMemories, deleteMemory } = await import("@/services/memory.service.js");

      // Add memory
      const memory = await addMemory(
        TEST_USER_ID,
        "User's favorite color is blue",
        "preferences",
        "I love blue color"
      );

      createdMemoryIds.push(memory.id);

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe("User's favorite color is blue");
      expect(memory.category).toBe("preferences");
      expect(memory.telegramUserId).toBe(TEST_USER_ID);

      // Search for it
      const results = await searchMemories(TEST_USER_ID, "what is favorite color", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("blue");
      expect(results[0].score).toBeGreaterThan(0.5); // Should have high similarity

      console.log(`   Created memory: ${memory.id}`);
      console.log(`   Search returned ${results.length} results, top score: ${results[0].score.toFixed(3)}`);
    }, 60000);

    it("should search memories by semantic similarity", async () => {
      const { addMemory, searchMemories } = await import("@/services/memory.service.js");

      // Add multiple memories
      const memories = [
        { content: "User lives in Saint Petersburg", category: "personal_info" as const },
        { content: "User works as a designer", category: "work" as const },
        { content: "User enjoys photography", category: "interests" as const },
      ];

      for (const mem of memories) {
        const stored = await addMemory(TEST_USER_ID, mem.content, mem.category);
        createdMemoryIds.push(stored.id);
      }

      // Search for location
      const locationResults = await searchMemories(TEST_USER_ID, "где живет пользователь", 5);
      expect(locationResults.length).toBeGreaterThan(0);
      expect(locationResults[0].content).toContain("Petersburg");

      // Search for job
      const jobResults = await searchMemories(TEST_USER_ID, "чем занимается пользователь", 5);
      expect(jobResults.length).toBeGreaterThan(0);
      expect(jobResults[0].content.toLowerCase()).toContain("designer");

      console.log(`   Location search top result: ${locationResults[0].content}`);
      console.log(`   Job search top result: ${jobResults[0].content}`);
    }, 120000); // 120s for multiple operations
  });

  describe("Real End-to-End Flow", () => {
    it("should complete full memory lifecycle with real APIs", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");
      const { addMemory, searchMemories } = await import("@/services/memory.service.js");

      console.log("\n   === Real E2E Test ===");

      // Step 1: Extract memories
      const message = "Я живу в Санкт-Петербурге и работаю дизайнером";
      console.log(`   Input: "${message}"`);

      const extracted = await extractMemories(message);
      console.log(`   Extracted ${extracted.memories.length} memories`);

      expect(extracted.hasMemories).toBe(true);
      expect(extracted.memories.length).toBeGreaterThanOrEqual(2);

      // Step 2: Store memories
      for (const mem of extracted.memories) {
        const stored = await addMemory(TEST_USER_ID, mem.content, mem.category, message);
        createdMemoryIds.push(stored.id);
        console.log(`     Stored: [${mem.category}] ${mem.content}`);
      }

      // Step 3: Search
      const searchResults = await searchMemories(TEST_USER_ID, "где живет пользователь", 5);
      console.log(`   Search returned ${searchResults.length} results`);

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].content.toLowerCase()).toMatch(/санкт-петербург|petersburg|спб/);

      console.log(`     Top result: ${searchResults[0].content} (score: ${searchResults[0].score.toFixed(3)})`);
    }, 120000);

    it("should handle multilingual extraction and search", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");
      const { addMemory, searchMemories } = await import("@/services/memory.service.js");

      // Extract from English
      const englishResult = await extractMemories("My name is John and I'm 30 years old");
      expect(englishResult.hasMemories).toBe(true);

      // Store
      for (const mem of englishResult.memories) {
        const stored = await addMemory(TEST_USER_ID, mem.content, mem.category);
        createdMemoryIds.push(stored.id);
      }

      // Search in Russian
      const searchResults = await searchMemories(TEST_USER_ID, "как зовут пользователя", 5);
      expect(searchResults.length).toBeGreaterThan(0);

      console.log(`   Multilingual search result: ${searchResults[0].content}`);
    }, 90000);
  });

  describe("Real Error Handling", () => {
    it("should handle rate limiting gracefully", async () => {
      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      // Make multiple rapid requests
      const promises = Array(3).fill(null).map((_, i) =>
        getEmbedding(`Test text ${i}`)
      );

      // All should succeed (retries handle rate limits)
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(emb => {
        expect(emb).toHaveLength(1024);
      });
    }, 60000);

    it("should handle malformed extraction responses", async () => {
      const { extractMemories } = await import("@/chains/memory-extraction.chain.js");

      // Test with edge case input
      const result = await extractMemories("123 !@# $%^ invalid??? 🎨🎭");

      // Should return gracefully even if LLM response is weird
      expect(result.hasMemories).toBeDefined();
      expect(Array.isArray(result.memories)).toBe(true);
    }, 30000);
  });
});
