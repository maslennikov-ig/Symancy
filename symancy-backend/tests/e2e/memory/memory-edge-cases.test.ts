/**
 * Memory System Edge Cases Tests
 * Validates handling of unusual inputs and error conditions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addMemory,
  searchMemories,
  getAllMemories,
  type MemoryCategory,
} from "../../../src/services/memory.service.js";

// Mock embeddings module
vi.mock("../../../src/core/embeddings/index.js", async () => {
  const { mockGetEmbedding, mockGetEmbeddings } = await import("../../setup/mocks/embeddings.mock.js");
  return {
    getEmbedding: mockGetEmbedding,
    getEmbeddings: mockGetEmbeddings,
    EMBEDDING_MODEL: 'baai/bge-m3',
    EMBEDDING_DIMS: 1024,
  };
});

// Mock database module with detailed mock setup
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

describe("Memory System Edge Cases", () => {
  const TEST_USER_ID = 999999985;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Text edge cases
  describe("Text handling", () => {
    it("should handle cyrillic text correctly", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const cyrillicContent = "Пользователь говорит по-русски";

      // Mock insert for addMemory
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "cyrillic-memory-id",
            telegram_user_id: TEST_USER_ID,
            content: cyrillicContent,
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, cyrillicContent, "other");

      // Verify embedding was called with cyrillic text
      expect(getEmbedding).toHaveBeenCalledWith(cyrillicContent);

      // Mock search
      vi.clearAllMocks();

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            id: "cyrillic-memory-id",
            content: cyrillicContent,
            category: "other",
            similarity: 0.85,
          },
        ],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, "русский язык", 5);

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle mixed language text", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const mixedContent = "User likes TypeScript и Python";

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "mixed-lang-id",
            telegram_user_id: TEST_USER_ID,
            content: mixedContent,
            category: "interests",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, mixedContent, "interests");

      expect(getEmbedding).toHaveBeenCalledWith(mixedContent);

      // Search for mixed language
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            id: "mixed-lang-id",
            content: mixedContent,
            category: "interests",
            similarity: 0.9,
          },
        ],
        error: null,
      });

      const results = await searchMemories(
        TEST_USER_ID,
        "programming languages",
        5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle emojis in content", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const emojiContent = "User loves coffee ☕ and coding 💻";

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "emoji-memory-id",
            telegram_user_id: TEST_USER_ID,
            content: emojiContent,
            category: "interests",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, emojiContent, "interests");

      expect(getEmbedding).toHaveBeenCalledWith(emojiContent);

      // Search with emojis
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            id: "emoji-memory-id",
            content: emojiContent,
            category: "interests",
            similarity: 0.88,
          },
        ],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, "coffee coding", 5);

      expect(Array.isArray(results)).toBe(true);
      expect(results[0]?.content).toContain("☕");
      expect(results[0]?.content).toContain("💻");
    });

    it("should handle very long content (1000+ chars)", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const longContent = "This is a very long memory. ".repeat(50); // ~1400 chars

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "long-memory-id",
            telegram_user_id: TEST_USER_ID,
            content: longContent,
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, longContent, "other");

      expect(getEmbedding).toHaveBeenCalledWith(longContent);

      // Get all memories to verify long content
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "long-memory-id",
              telegram_user_id: TEST_USER_ID,
              content: longContent,
              category: "other",
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectChain);

      const memories = await getAllMemories(TEST_USER_ID);

      expect(memories.some((m) => m.content.length > 1000)).toBe(true);
      expect(memories[0]?.content).toBe(longContent);
    });

    it("should handle special characters", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const specialContent =
        "User's email: test@example.com & phone: +7-999-123-4567";

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "special-chars-id",
            telegram_user_id: TEST_USER_ID,
            content: specialContent,
            category: "personal_info",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, specialContent, "personal_info");

      expect(getEmbedding).toHaveBeenCalledWith(specialContent);

      // Search
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [
          {
            id: "special-chars-id",
            content: specialContent,
            category: "personal_info",
            similarity: 0.75,
          },
        ],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, "контактные данные", 5);

      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle newlines and tabs", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const multilineContent = "Line 1\nLine 2\tTabbed";

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "multiline-id",
            telegram_user_id: TEST_USER_ID,
            content: multilineContent,
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await addMemory(TEST_USER_ID, multilineContent, "other");

      // Get all memories
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "multiline-id",
              telegram_user_id: TEST_USER_ID,
              content: multilineContent,
              category: "other",
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectChain);

      const memories = await getAllMemories(TEST_USER_ID);

      expect(memories.some((m) => m.content.includes("\n"))).toBe(true);
      expect(memories[0]?.content).toContain("\n");
      expect(memories[0]?.content).toContain("\t");
    });
  });

  // Database edge cases
  describe("Database handling", () => {
    it("should handle duplicate content gracefully", async () => {
      const duplicateContent = "Duplicate content test";

      // First insert
      const mockInsertChain1 = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "duplicate-1",
            telegram_user_id: TEST_USER_ID,
            content: duplicateContent,
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain1);
      await addMemory(TEST_USER_ID, duplicateContent, "other");

      // Second insert
      const mockInsertChain2 = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "duplicate-2",
            telegram_user_id: TEST_USER_ID,
            content: duplicateContent,
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-02T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain2);
      await addMemory(TEST_USER_ID, duplicateContent, "other");

      // Get all memories
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "duplicate-2",
              telegram_user_id: TEST_USER_ID,
              content: duplicateContent,
              category: "other",
              source_message: null,
              created_at: "2024-01-02T00:00:00Z",
              updated_at: "2024-01-02T00:00:00Z",
            },
            {
              id: "duplicate-1",
              telegram_user_id: TEST_USER_ID,
              content: duplicateContent,
              category: "other",
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockSelectChain);

      const memories = await getAllMemories(TEST_USER_ID);
      const dupes = memories.filter((m) => m.content === duplicateContent);

      expect(dupes.length).toBe(2); // Both should be stored
    });
  });

  // Search edge cases
  describe("Search edge cases", () => {
    it("should handle empty query", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, "", 5);

      expect(Array.isArray(results)).toBe(true);
      expect(getEmbedding).toHaveBeenCalledWith("");
    });

    it("should handle very long query", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      const longQuery = "test ".repeat(200);

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, longQuery, 5);

      expect(Array.isArray(results)).toBe(true);
      expect(getEmbedding).toHaveBeenCalledWith(longQuery);
    });

    it("should handle special characters in query", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await searchMemories(TEST_USER_ID, "test@#$%^&*()", 5);

      expect(Array.isArray(results)).toBe(true);
      expect(getEmbedding).toHaveBeenCalledWith("test@#$%^&*()");
    });

    it("should return empty for user with no memories", async () => {
      const emptyUserId = 999999980;

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await searchMemories(emptyUserId, "anything", 5);

      expect(results).toHaveLength(0);
    });
  });

  // Error handling
  describe("Error handling", () => {
    it("should handle embedding failure gracefully", async () => {
      const { getEmbedding } = await import(
        "../../../src/core/embeddings/index.js"
      );
      (getEmbedding as any).mockRejectedValueOnce(
        new Error("Embedding API failed")
      );

      await expect(
        addMemory(TEST_USER_ID, "Test content", "other")
      ).rejects.toThrow("Embedding API failed");
    });

    it("should handle database connection failure", async () => {
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection timeout" },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockInsertChain);

      await expect(
        addMemory(TEST_USER_ID, "Test content", "other")
      ).rejects.toThrow("Failed to add memory: Database connection timeout");
    });
  });
});
