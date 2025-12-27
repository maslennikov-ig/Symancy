# Memory System E2E Test Specification

## Overview

Comprehensive test plan for the Memory System in symancy-backend.
Covers unit tests, integration tests, and E2E validation before production deployment.

## Architecture Under Test

```
┌─────────────────────────────────────────────────────────────┐
│                    Components to Test                        │
├─────────────────────────────────────────────────────────────┤
│ 1. BGE Embeddings Client   → /src/core/embeddings/bge-client.ts │
│ 2. Memory Extraction Chain → /src/chains/memory-extraction.chain.ts │
│ 3. Memory Service          → /src/services/memory.service.ts │
│ 4. Chat Chain Integration  → /src/chains/chat.chain.ts      │
│ 5. Chat Worker Integration → /src/modules/chat/worker.ts    │
│ 6. Database (pgvector)     → user_memories table + RPC      │
└─────────────────────────────────────────────────────────────┘
```

---

## Test Categories

### 1. Unit Tests

#### 1.1 BGE Embeddings Client (`bge-client.test.ts`)

```typescript
// Test: getEmbedding returns correct dimensions
describe("getEmbedding", () => {
  it("should return 1024-dimensional vector for Russian text", async () => {
    const embedding = await getEmbedding("Привет, меня зовут Алексей");
    expect(embedding).toHaveLength(1024);
    expect(embedding.every(v => typeof v === "number")).toBe(true);
  });

  it("should return 1024-dimensional vector for English text", async () => {
    const embedding = await getEmbedding("Hello, my name is Alex");
    expect(embedding).toHaveLength(1024);
  });

  it("should handle empty string gracefully", async () => {
    const embedding = await getEmbedding("");
    expect(embedding).toHaveLength(1024);
  });

  it("should handle very long text (>10000 chars)", async () => {
    const longText = "Тест ".repeat(3000);
    const embedding = await getEmbedding(longText);
    expect(embedding).toHaveLength(1024);
  });

  it("should handle special characters and emojis", async () => {
    const embedding = await getEmbedding("Привет! 👋 Как дела? 🎉");
    expect(embedding).toHaveLength(1024);
  });
});

// Test: getEmbeddings batch processing
describe("getEmbeddings", () => {
  it("should return correct number of embeddings for batch", async () => {
    const texts = ["Текст 1", "Текст 2", "Текст 3"];
    const embeddings = await getEmbeddings(texts);
    expect(embeddings).toHaveLength(3);
    expect(embeddings.every(e => e.length === 1024)).toBe(true);
  });

  it("should return empty array for empty input", async () => {
    const embeddings = await getEmbeddings([]);
    expect(embeddings).toHaveLength(0);
  });

  it("should maintain order of embeddings", async () => {
    const texts = ["Короткий", "Очень длинный текст с множеством слов"];
    const embeddings = await getEmbeddings(texts);
    // Verify different texts produce different embeddings
    const similarity = cosineSimilarity(embeddings[0], embeddings[1]);
    expect(similarity).toBeLessThan(0.95);
  });
});

// Test: Retry logic
describe("retry logic", () => {
  it("should retry on 429 rate limit error", async () => {
    // Mock OpenRouter to return 429 first, then success
  });

  it("should retry on 500 server error", async () => {
    // Mock OpenRouter to return 500 first, then success
  });

  it("should throw after max retries exceeded", async () => {
    // Mock OpenRouter to always return 500
  });
});
```

#### 1.2 Memory Extraction Chain (`memory-extraction.chain.test.ts`)

```typescript
describe("extractMemories", () => {
  // Personal info extraction
  describe("personal_info category", () => {
    it("should extract name from message", async () => {
      const result = await extractMemories("Меня зовут Алексей, мне 35 лет");
      expect(result.hasMemories).toBe(true);
      expect(result.memories).toContainEqual(
        expect.objectContaining({
          category: "personal_info",
          content: expect.stringContaining("Алексей")
        })
      );
    });

    it("should extract location from message", async () => {
      const result = await extractMemories("Я живу в Москве");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("personal_info");
    });

    it("should extract age from message", async () => {
      const result = await extractMemories("Мне 28 лет");
      expect(result.hasMemories).toBe(true);
    });
  });

  // Health extraction
  describe("health category", () => {
    it("should extract health symptoms", async () => {
      const result = await extractMemories("У меня болит спина уже неделю");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("health");
    });

    it("should extract chronic conditions", async () => {
      const result = await extractMemories("У меня диабет второго типа");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("health");
    });

    it("should extract allergies", async () => {
      const result = await extractMemories("У меня аллергия на орехи");
      expect(result.hasMemories).toBe(true);
    });
  });

  // Preferences extraction
  describe("preferences category", () => {
    it("should extract communication style preference", async () => {
      const result = await extractMemories("Я предпочитаю краткие ответы");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("preferences");
    });

    it("should extract food preferences", async () => {
      const result = await extractMemories("Я люблю зеленый чай без сахара");
      expect(result.hasMemories).toBe(true);
    });
  });

  // Events extraction
  describe("events category", () => {
    it("should extract upcoming events", async () => {
      const result = await extractMemories(
        "На следующей неделе у меня важная встреча с инвестором"
      );
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("events");
    });

    it("should extract deadlines", async () => {
      const result = await extractMemories(
        "Мне нужно сдать проект до пятницы"
      );
      expect(result.hasMemories).toBe(true);
    });
  });

  // Work extraction
  describe("work category", () => {
    it("should extract job information", async () => {
      const result = await extractMemories("Я работаю программистом в Яндексе");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("work");
    });

    it("should extract project information", async () => {
      const result = await extractMemories(
        "Работаю над стартапом в сфере EdTech"
      );
      expect(result.hasMemories).toBe(true);
    });
  });

  // Interests extraction
  describe("interests category", () => {
    it("should extract hobbies", async () => {
      const result = await extractMemories("Я занимаюсь йогой по утрам");
      expect(result.hasMemories).toBe(true);
      expect(result.memories[0].category).toBe("interests");
    });

    it("should extract topics of interest", async () => {
      const result = await extractMemories(
        "Интересуюсь криптовалютами и блокчейном"
      );
      expect(result.hasMemories).toBe(true);
    });
  });

  // No memories cases
  describe("no memories extraction", () => {
    it("should return empty for greetings", async () => {
      const result = await extractMemories("Привет! Как дела?");
      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should return empty for questions", async () => {
      const result = await extractMemories("Что ты думаешь об этом?");
      expect(result.hasMemories).toBe(false);
    });

    it("should return empty for small talk", async () => {
      const result = await extractMemories("Да, согласен с тобой");
      expect(result.hasMemories).toBe(false);
    });
  });

  // Multiple memories
  describe("multiple memories", () => {
    it("should extract multiple facts from complex message", async () => {
      const result = await extractMemories(
        "Меня зовут Алексей, мне 35 лет, я живу в Москве и работаю программистом. У меня болит спина."
      );
      expect(result.hasMemories).toBe(true);
      expect(result.memories.length).toBeGreaterThanOrEqual(3);
    });
  });

  // Error handling
  describe("error handling", () => {
    it("should handle malformed LLM response gracefully", async () => {
      // Mock LLM to return invalid JSON
      const result = await extractMemories("test");
      expect(result).toEqual({ memories: [], hasMemories: false });
    });
  });
});
```

#### 1.3 Memory Service (`memory.service.test.ts`)

```typescript
describe("Memory Service", () => {
  const testUserId = 999999999; // Test user ID

  beforeEach(async () => {
    // Clean up test data
    await deleteAllMemoriesForUser(testUserId);
  });

  afterAll(async () => {
    // Final cleanup
    await deleteAllMemoriesForUser(testUserId);
  });

  describe("addMemory", () => {
    it("should add memory with correct fields", async () => {
      const memory = await addMemory(
        testUserId,
        "User's name is Test User",
        "personal_info",
        "Original: My name is Test User"
      );

      expect(memory.id).toBeDefined();
      expect(memory.telegramUserId).toBe(testUserId);
      expect(memory.content).toBe("User's name is Test User");
      expect(memory.category).toBe("personal_info");
      expect(memory.sourceMessage).toBe("Original: My name is Test User");
      expect(memory.createdAt).toBeInstanceOf(Date);
    });

    it("should generate embedding (verified by search)", async () => {
      await addMemory(testUserId, "Пользователь любит кофе", "preferences");

      // Search should find it
      const results = await searchMemories(testUserId, "напитки кофе", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle all categories", async () => {
      const categories = [
        "personal_info", "health", "preferences",
        "events", "interests", "work", "other"
      ];

      for (const category of categories) {
        const memory = await addMemory(
          testUserId,
          `Test for ${category}`,
          category as MemoryCategory
        );
        expect(memory.category).toBe(category);
      }
    });

    it("should fail with invalid user ID (no profile)", async () => {
      await expect(
        addMemory(0, "Test", "other")
      ).rejects.toThrow();
    });
  });

  describe("searchMemories", () => {
    beforeEach(async () => {
      // Add test memories
      await addMemory(testUserId, "Пользователя зовут Алексей", "personal_info");
      await addMemory(testUserId, "У пользователя болит спина", "health");
      await addMemory(testUserId, "Пользователь любит зеленый чай", "preferences");
      await addMemory(testUserId, "Пользователь работает программистом", "work");
    });

    it("should find relevant memory by semantic search", async () => {
      const results = await searchMemories(testUserId, "Как зовут?", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("Алексей");
    });

    it("should find health-related memory", async () => {
      const results = await searchMemories(testUserId, "проблемы со здоровьем", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("спина");
    });

    it("should return similarity scores", async () => {
      const results = await searchMemories(testUserId, "имя", 5);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it("should respect limit parameter", async () => {
      const results = await searchMemories(testUserId, "пользователь", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty for non-matching query", async () => {
      const results = await searchMemories(
        testUserId,
        "совершенно несвязанный запрос про космос и динозавров",
        5
      );
      // May return results but with low scores
      if (results.length > 0) {
        expect(results[0].score).toBeLessThan(0.5);
      }
    });

    it("should not return other user's memories", async () => {
      const otherUserId = 888888888;
      await addMemory(otherUserId, "Secret memory of another user", "other");

      const results = await searchMemories(testUserId, "Secret memory", 5);
      expect(results.every(r => !r.content.includes("Secret"))).toBe(true);

      // Cleanup
      await deleteAllMemoriesForUser(otherUserId);
    });
  });

  describe("getAllMemories", () => {
    it("should return all memories for user", async () => {
      await addMemory(testUserId, "Memory 1", "personal_info");
      await addMemory(testUserId, "Memory 2", "health");
      await addMemory(testUserId, "Memory 3", "work");

      const memories = await getAllMemories(testUserId);
      expect(memories.length).toBe(3);
    });

    it("should order by created_at descending", async () => {
      await addMemory(testUserId, "First", "other");
      await new Promise(r => setTimeout(r, 100)); // Small delay
      await addMemory(testUserId, "Second", "other");

      const memories = await getAllMemories(testUserId);
      expect(memories[0].content).toBe("Second"); // Newest first
    });

    it("should return empty array for user with no memories", async () => {
      const memories = await getAllMemories(777777777);
      expect(memories).toHaveLength(0);
    });
  });

  describe("deleteMemory", () => {
    it("should delete memory by ID", async () => {
      const memory = await addMemory(testUserId, "To delete", "other");
      await deleteMemory(memory.id);

      const memories = await getAllMemories(testUserId);
      expect(memories.find(m => m.id === memory.id)).toBeUndefined();
    });

    it("should not throw on non-existent ID", async () => {
      await expect(
        deleteMemory("00000000-0000-0000-0000-000000000000")
      ).resolves.not.toThrow();
    });
  });
});
```

---

### 2. Integration Tests

#### 2.1 Full Memory Pipeline (`memory-pipeline.integration.test.ts`)

```typescript
describe("Memory Pipeline Integration", () => {
  const testUserId = 999999998;

  beforeAll(async () => {
    // Ensure test user exists in profiles
    await createTestProfile(testUserId);
  });

  afterAll(async () => {
    await cleanupTestData(testUserId);
  });

  it("should extract and store memories from message", async () => {
    const message = "Меня зовут Тестовый Пользователь, мне 30 лет, живу в Санкт-Петербурге";

    // Step 1: Extract memories
    const extracted = await extractMemories(message);
    expect(extracted.hasMemories).toBe(true);
    expect(extracted.memories.length).toBeGreaterThan(0);

    // Step 2: Store each memory
    for (const mem of extracted.memories) {
      await addMemory(testUserId, mem.content, mem.category, message);
    }

    // Step 3: Verify search works
    const searchResults = await searchMemories(testUserId, "как зовут", 5);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].content).toContain("Тестовый");
  });

  it("should build context over multiple messages", async () => {
    // Simulate conversation
    const messages = [
      "Меня зовут Иван",
      "Я работаю врачом в поликлинике",
      "У меня аллергия на пенициллин",
      "Завтра важная операция",
      "Люблю классическую музыку"
    ];

    for (const msg of messages) {
      const extracted = await extractMemories(msg);
      if (extracted.hasMemories) {
        for (const mem of extracted.memories) {
          await addMemory(testUserId, mem.content, mem.category, msg);
        }
      }
    }

    // Verify different categories
    const workQuery = await searchMemories(testUserId, "профессия работа", 3);
    expect(workQuery.some(r => r.category === "work")).toBe(true);

    const healthQuery = await searchMemories(testUserId, "медицинские противопоказания", 3);
    expect(healthQuery.some(r => r.category === "health")).toBe(true);

    const eventQuery = await searchMemories(testUserId, "планы на завтра", 3);
    expect(eventQuery.some(r => r.category === "events")).toBe(true);
  });
});
```

#### 2.2 Chat Chain with Memory (`chat-memory.integration.test.ts`)

```typescript
describe("Chat Chain with Memory Integration", () => {
  const testUserId = 999999997;

  beforeAll(async () => {
    await createTestProfile(testUserId);
    // Add some memories
    await addMemory(testUserId, "User's name is TestBot", "personal_info");
    await addMemory(testUserId, "User prefers short answers", "preferences");
    await addMemory(testUserId, "User has back pain", "health");
  });

  afterAll(async () => {
    await cleanupTestData(testUserId);
  });

  it("should include relevant memories in response context", async () => {
    // This test verifies memories are searched (not AI response quality)
    const searchSpy = jest.spyOn(memoryService, 'searchMemories');

    await generateChatResponseDirect("Привет", testUserId);

    expect(searchSpy).toHaveBeenCalledWith(testUserId, "Привет", 5);
  });

  it("should handle memory search failure gracefully", async () => {
    // Mock search to throw
    jest.spyOn(memoryService, 'searchMemories').mockRejectedValueOnce(
      new Error("Database connection failed")
    );

    // Should not throw, just continue without memories
    const result = await generateChatResponseDirect("Test message", testUserId);
    expect(result.text).toBeDefined();
  });
});
```

---

### 3. E2E Tests

#### 3.1 Full User Flow (`memory-e2e.test.ts`)

```typescript
describe("Memory System E2E", () => {
  const testUserId = 999999996;

  beforeAll(async () => {
    await createTestProfile(testUserId);
  });

  afterAll(async () => {
    await cleanupTestData(testUserId);
  });

  it("E2E: Complete memory lifecycle", async () => {
    console.log("=== E2E Test: Complete Memory Lifecycle ===\n");

    // Phase 1: User introduces themselves
    console.log("Phase 1: User introduction");
    const intro = "Привет! Меня зовут Елена, мне 28 лет. Я живу в Казани и работаю дизайнером.";

    const extracted1 = await extractMemories(intro);
    console.log(`  Extracted ${extracted1.memories.length} memories`);

    for (const mem of extracted1.memories) {
      await addMemory(testUserId, mem.content, mem.category, intro);
      console.log(`  + [${mem.category}] ${mem.content}`);
    }

    // Phase 2: User shares health info
    console.log("\nPhase 2: Health information");
    const health = "Кстати, у меня мигрени бывают, особенно когда много работаю.";

    const extracted2 = await extractMemories(health);
    for (const mem of extracted2.memories) {
      await addMemory(testUserId, mem.content, mem.category, health);
      console.log(`  + [${mem.category}] ${mem.content}`);
    }

    // Phase 3: User mentions preferences
    console.log("\nPhase 3: Preferences");
    const prefs = "Я предпочитаю общаться неформально и люблю когда ответы с примерами.";

    const extracted3 = await extractMemories(prefs);
    for (const mem of extracted3.memories) {
      await addMemory(testUserId, mem.content, mem.category, prefs);
      console.log(`  + [${mem.category}] ${mem.content}`);
    }

    // Phase 4: Verify retrieval
    console.log("\n=== Verification Queries ===\n");

    const queries = [
      { q: "Как зовут пользователя?", expected: "Елена" },
      { q: "Где живет?", expected: "Казани" },
      { q: "Кем работает?", expected: "дизайнер" },
      { q: "Проблемы со здоровьем?", expected: "мигрен" },
      { q: "Какой стиль общения предпочитает?", expected: "неформально" },
    ];

    let passed = 0;
    for (const { q, expected } of queries) {
      const results = await searchMemories(testUserId, q, 3);
      const found = results.some(r =>
        r.content.toLowerCase().includes(expected.toLowerCase())
      );

      console.log(`  Query: "${q}"`);
      console.log(`  Expected: "${expected}" | Found: ${found}`);
      console.log(`  Top result: ${results[0]?.content || "(none)"} [${results[0]?.score?.toFixed(2) || "N/A"}]`);
      console.log();

      if (found) passed++;
    }

    console.log(`=== Results: ${passed}/${queries.length} passed ===`);
    expect(passed).toBeGreaterThanOrEqual(4); // Allow 1 failure
  });

  it("E2E: Memory isolation between users", async () => {
    const user1 = 999999995;
    const user2 = 999999994;

    await createTestProfile(user1);
    await createTestProfile(user2);

    try {
      // User 1 adds secret
      await addMemory(user1, "User 1 secret password is ABC123", "other");

      // User 2 adds their own
      await addMemory(user2, "User 2 prefers tea", "preferences");

      // User 2 should NOT find User 1's secret
      const results = await searchMemories(user2, "secret password", 10);
      expect(results.every(r => !r.content.includes("ABC123"))).toBe(true);

      // User 1 should find their own secret
      const user1Results = await searchMemories(user1, "password", 10);
      expect(user1Results.some(r => r.content.includes("ABC123"))).toBe(true);

      console.log("✓ Memory isolation verified");
    } finally {
      await cleanupTestData(user1);
      await cleanupTestData(user2);
    }
  });

  it("E2E: Memory update scenario (contradiction handling)", async () => {
    // First, user says one thing
    const msg1 = "Я живу в Москве";
    const extracted1 = await extractMemories(msg1);
    for (const mem of extracted1.memories) {
      await addMemory(testUserId, mem.content, mem.category, msg1);
    }

    // Later, user updates location
    const msg2 = "Я переехал в Санкт-Петербург";
    const extracted2 = await extractMemories(msg2);
    for (const mem of extracted2.memories) {
      await addMemory(testUserId, mem.content, mem.category, msg2);
    }

    // Search should return both (newest first by score typically)
    const results = await searchMemories(testUserId, "где живет пользователь", 5);

    // Verify both exist
    const allMemories = await getAllMemories(testUserId);
    const locationMemories = allMemories.filter(m =>
      m.content.includes("Москв") || m.content.includes("Петербург")
    );

    console.log("Location memories:", locationMemories.map(m => m.content));
    expect(locationMemories.length).toBe(2); // Both should exist

    // Note: In future, we may want to implement memory consolidation
  });
});
```

#### 3.2 Performance Tests (`memory-performance.test.ts`)

```typescript
describe("Memory System Performance", () => {
  const testUserId = 999999990;

  beforeAll(async () => {
    await createTestProfile(testUserId);
  });

  afterAll(async () => {
    await cleanupTestData(testUserId);
  });

  it("PERF: Embedding generation latency", async () => {
    const times: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await getEmbedding(`Тестовый текст номер ${i} для проверки скорости`);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);

    console.log(`Embedding latency: avg=${avg.toFixed(0)}ms, max=${max}ms`);

    expect(avg).toBeLessThan(2000); // Average under 2s
    expect(max).toBeLessThan(5000); // Max under 5s
  });

  it("PERF: Memory extraction latency", async () => {
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
    console.log(`Extraction latency: avg=${avg.toFixed(0)}ms`);

    expect(avg).toBeLessThan(5000); // Under 5s average
  });

  it("PERF: Memory search latency with many memories", async () => {
    // Add 50 memories
    console.log("Adding 50 test memories...");
    for (let i = 0; i < 50; i++) {
      await addMemory(
        testUserId,
        `Test memory number ${i} with some random content about topic ${i % 10}`,
        "other"
      );
    }

    // Measure search time
    const times: number[] = [];
    const queries = ["topic 5", "memory number", "random content"];

    for (const q of queries) {
      const start = Date.now();
      await searchMemories(testUserId, q, 10);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`Search latency (50 memories): avg=${avg.toFixed(0)}ms`);

    expect(avg).toBeLessThan(1000); // Under 1s with HNSW index
  });

  it("PERF: Concurrent memory operations", async () => {
    const start = Date.now();

    // 10 concurrent adds
    await Promise.all(
      Array(10).fill(0).map((_, i) =>
        addMemory(testUserId, `Concurrent memory ${i}`, "other")
      )
    );

    const addTime = Date.now() - start;
    console.log(`10 concurrent adds: ${addTime}ms`);

    // 10 concurrent searches
    const searchStart = Date.now();
    await Promise.all(
      Array(10).fill(0).map((_, i) =>
        searchMemories(testUserId, `query ${i}`, 5)
      )
    );

    const searchTime = Date.now() - searchStart;
    console.log(`10 concurrent searches: ${searchTime}ms`);

    expect(addTime).toBeLessThan(10000); // 10 adds under 10s
    expect(searchTime).toBeLessThan(5000); // 10 searches under 5s
  });
});
```

#### 3.3 Edge Cases & Error Handling (`memory-edge-cases.test.ts`)

```typescript
describe("Memory System Edge Cases", () => {
  const testUserId = 999999985;

  beforeAll(async () => {
    await createTestProfile(testUserId);
  });

  afterAll(async () => {
    await cleanupTestData(testUserId);
  });

  // Text edge cases
  describe("Text handling", () => {
    it("should handle cyrillic text correctly", async () => {
      await addMemory(testUserId, "Пользователь говорит по-русски", "other");
      const results = await searchMemories(testUserId, "русский язык", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle mixed language text", async () => {
      await addMemory(testUserId, "User likes TypeScript и Python", "interests");
      const results = await searchMemories(testUserId, "programming languages", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle emojis in content", async () => {
      await addMemory(testUserId, "User loves coffee ☕ and coding 💻", "interests");
      const results = await searchMemories(testUserId, "coffee coding", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle very long content (1000+ chars)", async () => {
      const longContent = "This is a very long memory. ".repeat(50);
      await addMemory(testUserId, longContent, "other");

      const memories = await getAllMemories(testUserId);
      expect(memories.some(m => m.content.length > 1000)).toBe(true);
    });

    it("should handle special characters", async () => {
      await addMemory(testUserId, "User's email: test@example.com & phone: +7-999-123-4567", "personal_info");
      const results = await searchMemories(testUserId, "контактные данные", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle newlines and tabs", async () => {
      await addMemory(testUserId, "Line 1\nLine 2\tTabbed", "other");
      const memories = await getAllMemories(testUserId);
      expect(memories.some(m => m.content.includes("\n"))).toBe(true);
    });
  });

  // Database edge cases
  describe("Database handling", () => {
    it("should handle duplicate content gracefully", async () => {
      await addMemory(testUserId, "Duplicate content test", "other");
      await addMemory(testUserId, "Duplicate content test", "other");

      const memories = await getAllMemories(testUserId);
      const dupes = memories.filter(m => m.content === "Duplicate content test");
      expect(dupes.length).toBe(2); // Both should be stored
    });

    it("should maintain referential integrity on user delete", async () => {
      // This would require profile deletion - out of scope for now
      // Just verify FK constraint exists
    });
  });

  // API error handling
  describe("API error handling", () => {
    it("should handle OpenRouter rate limiting", async () => {
      // Rapid-fire requests to potentially trigger rate limit
      const promises = Array(20).fill(0).map(() =>
        getEmbedding("Rate limit test")
      );

      // Should either succeed or fail gracefully
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === "rejected");

      console.log(`Rate limit test: ${failures.length}/20 failed`);
      // Retry logic should handle most failures
      expect(failures.length).toBeLessThan(10);
    });

    it("should handle network timeout gracefully", async () => {
      // Would need to mock network - placeholder
    });
  });

  // Search edge cases
  describe("Search edge cases", () => {
    it("should handle empty query", async () => {
      const results = await searchMemories(testUserId, "", 5);
      // Should not throw, may return empty or all
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle very long query", async () => {
      const longQuery = "test ".repeat(200);
      const results = await searchMemories(testUserId, longQuery, 5);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle special characters in query", async () => {
      const results = await searchMemories(testUserId, "test@#$%^&*()", 5);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty for user with no memories", async () => {
      const emptyUserId = 999999980;
      await createTestProfile(emptyUserId);

      const results = await searchMemories(emptyUserId, "anything", 5);
      expect(results).toHaveLength(0);

      await cleanupTestData(emptyUserId);
    });
  });
});
```

---

### 4. Test Utilities

#### 4.1 Test Helpers (`test-helpers.ts`)

```typescript
import { getSupabase } from "../core/database.js";

/**
 * Create test profile for testing
 */
export async function createTestProfile(telegramUserId: number): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from("profiles")
    .upsert({
      telegram_user_id: telegramUserId,
      username: `test_user_${telegramUserId}`,
      first_name: "Test",
      last_name: "User",
      language_code: "ru",
    });
}

/**
 * Delete all memories for a user (cleanup)
 */
export async function deleteAllMemoriesForUser(telegramUserId: number): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from("user_memories")
    .delete()
    .eq("telegram_user_id", telegramUserId);
}

/**
 * Full cleanup of test data
 */
export async function cleanupTestData(telegramUserId: number): Promise<void> {
  await deleteAllMemoriesForUser(telegramUserId);
  // Don't delete profile - might be needed for other tests
}

/**
 * Cosine similarity for embedding comparison
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

### 5. Test Execution

#### 5.1 Run Commands

```bash
# Run all memory tests
pnpm test -- --grep "Memory"

# Run only unit tests
pnpm test -- tests/unit/memory

# Run only integration tests
pnpm test -- tests/integration/memory

# Run only E2E tests
pnpm test -- tests/e2e/memory

# Run with coverage
pnpm test -- --coverage tests/unit/memory

# Run specific test file
pnpm test -- tests/e2e/memory-e2e.test.ts

# Run in watch mode
pnpm test -- --watch tests/unit/memory
```

#### 5.2 CI/CD Integration

```yaml
# .github/workflows/test-memory.yml
name: Memory System Tests

on:
  push:
    paths:
      - 'src/core/embeddings/**'
      - 'src/chains/memory-extraction.chain.ts'
      - 'src/services/memory.service.ts'
      - 'tests/**/memory*.ts'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm type-check
      - run: pnpm test -- tests/unit/memory

      # Integration tests require secrets
      - run: pnpm test -- tests/integration/memory
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

---

### 6. Expected Results Matrix

| Test Category | Tests | Expected Pass Rate |
|---------------|-------|-------------------|
| Unit: BGE Client | 10 | 100% |
| Unit: Extraction Chain | 20 | 95% (LLM variability) |
| Unit: Memory Service | 15 | 100% |
| Integration: Pipeline | 5 | 100% |
| Integration: Chat | 3 | 100% |
| E2E: Full Flow | 3 | 95% |
| Performance | 4 | 100% |
| Edge Cases | 15 | 95% |

**Total: ~75 tests**

---

### 7. Pre-Production Checklist

Before deploying to production, ensure:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass with >95% success rate
- [ ] Performance tests meet latency requirements
- [ ] No memory leaks detected
- [ ] Error handling covers all edge cases
- [ ] Logging is appropriate (not verbose in production)
- [ ] pgvector HNSW index is created and working
- [ ] RPC function `search_user_memories` is deployed
- [ ] OpenRouter API key has sufficient credits
- [ ] Rate limiting is configured appropriately
