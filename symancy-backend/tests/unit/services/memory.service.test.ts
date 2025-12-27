/**
 * Unit tests for Memory Service
 * Tests storage and retrieval of user memories with vector search
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to create mock client BEFORE vi.mock hoisting
const { mockSupabaseClient } = vi.hoisted(() => ({
  mockSupabaseClient: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock embeddings module - inline factory (hoisted to top)
vi.mock("../../../src/core/embeddings/index.js", () => ({
  getEmbedding: vi.fn(() => Promise.resolve(Array(1024).fill(0).map(() => Math.random() * 2 - 1))),
  getEmbeddings: vi.fn((texts: string[]) => Promise.resolve(texts.map(() => Array(1024).fill(0).map(() => Math.random() * 2 - 1)))),
  EMBEDDING_MODEL: 'baai/bge-m3',
  EMBEDDING_DIMS: 1024,
}));

// Mock database module - return the shared mockSupabaseClient
vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks are set up
import {
  addMemory,
  searchMemories,
  getAllMemories,
  deleteMemory,
  type MemoryCategory,
  type UserMemory,
  type MemorySearchResult,
} from "../../../src/services/memory.service.js";
import { getSupabase } from "../../../src/core/database.js";
import { getEmbedding } from "../../../src/core/embeddings/index.js";

// Helper to get mocked Supabase client - returns the shared mock
const getMockedSupabase = () => mockSupabaseClient;

describe("Memory Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addMemory", () => {
    it("should add memory with correct fields", async () => {
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "test-uuid-123",
            telegram_user_id: 999999999,
            content: "User loves coffee",
            category: "preferences",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: "I really love coffee!",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.from.mockReturnValue(mockInsertChain);

      const result = await addMemory(
        999999999,
        "User loves coffee",
        "preferences",
        "I really love coffee!"
      );

      expect(result).toMatchObject<Partial<UserMemory>>({
        id: "test-uuid-123",
        telegramUserId: 999999999,
        content: "User loves coffee",
        category: "preferences",
        sourceMessage: "I really love coffee!",
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      expect(mockSupabase.from).toHaveBeenCalledWith("user_memories");
      expect(mockInsertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          telegram_user_id: 999999999,
          content: "User loves coffee",
          category: "preferences",
          source_message: "I really love coffee!",
        })
      );
      // Verify embedding is a valid JSON array of 1024 numbers
      const insertCall = mockInsertChain.insert.mock.calls[0][0];
      const embedding = JSON.parse(insertCall.embedding);
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding).toHaveLength(1024);
    });

    it("should generate embedding for content", async () => {
      const { getEmbedding } = await import("../../../src/core/embeddings/index.js");

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "test-uuid",
            telegram_user_id: 123456789,
            content: "User is 25 years old",
            category: "personal_info",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      await addMemory(123456789, "User is 25 years old", "personal_info");

      expect(getEmbedding).toHaveBeenCalledWith("User is 25 years old");
      expect(getEmbedding).toHaveBeenCalledTimes(1);
    });

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
        vi.clearAllMocks();

        const mockInsertChain = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: `test-uuid-${category}`,
              telegram_user_id: 123456789,
              content: `Test content for ${category}`,
              category,
              embedding: JSON.stringify(Array(1024).fill(0.1)),
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
            error: null,
          }),
        };

        getMockedSupabase().from.mockReturnValue(mockInsertChain);

        const result = await addMemory(
          123456789,
          `Test content for ${category}`,
          category
        );

        expect(result.category).toBe(category);
        expect(mockInsertChain.insert).toHaveBeenCalledWith(
          expect.objectContaining({ category })
        );
      }
    });

    it("should add memory without source message", async () => {
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "test-uuid",
            telegram_user_id: 123456789,
            content: "Memory without source",
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      const result = await addMemory(123456789, "Memory without source", "other");

      expect(result.sourceMessage).toBeNull();
      expect(mockInsertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_message: undefined,
        })
      );
    });

    it("should throw error on database failure", async () => {
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" },
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      await expect(
        addMemory(123456789, "Test content", "other")
      ).rejects.toThrow("Failed to add memory: Database connection failed");
    });
  });

  describe("searchMemories", () => {
    it("should find relevant memories by semantic search", async () => {
      const mockRpcResponse = {
        data: [
          {
            id: "memory-1",
            content: "User loves drinking coffee in the morning",
            category: "preferences",
            similarity: 0.92,
          },
          {
            id: "memory-2",
            content: "User prefers espresso over americano",
            category: "preferences",
            similarity: 0.85,
          },
        ],
        error: null,
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "coffee preferences", 5);

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining<Partial<MemorySearchResult>>({
            id: "memory-1",
            content: "User loves drinking coffee in the morning",
            category: "preferences",
            score: 0.92,
          }),
          expect.objectContaining<Partial<MemorySearchResult>>({
            id: "memory-2",
            content: "User prefers espresso over americano",
            category: "preferences",
            score: 0.85,
          }),
        ])
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          user_id: 123456789,
          match_limit: 5,
        })
      );
      // Verify query_embedding is a valid JSON array of 1024 numbers
      const rpcCall = mockSupabase.rpc.mock.calls[0][1];
      const queryEmbedding = JSON.parse(rpcCall.query_embedding);
      expect(queryEmbedding).toBeInstanceOf(Array);
      expect(queryEmbedding).toHaveLength(1024);
    });

    it("should return similarity scores", async () => {
      const mockRpcResponse = {
        data: [
          {
            id: "memory-1",
            content: "User works as a software engineer",
            category: "work",
            similarity: 0.95,
          },
        ],
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "work", 5);

      expect(results[0]?.score).toBe(0.95);
      expect(results[0]?.score).toBeGreaterThan(0);
      expect(results[0]?.score).toBeLessThanOrEqual(1);
    });

    it("should respect limit parameter", async () => {
      const mockRpcResponse = {
        data: [
          { id: "1", content: "Memory 1", category: "other", similarity: 0.9 },
          { id: "2", content: "Memory 2", category: "other", similarity: 0.8 },
          { id: "3", content: "Memory 3", category: "other", similarity: 0.7 },
        ],
        error: null,
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      await searchMemories(123456789, "test query", 3);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          match_limit: 3,
        })
      );
    });

    it("should use default limit of 5 when not specified", async () => {
      const mockRpcResponse = {
        data: [],
        error: null,
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      await searchMemories(123456789, "test query");

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          match_limit: 5,
        })
      );
    });

    it("should return empty array for no results", async () => {
      const mockRpcResponse = {
        data: [],
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "non-existent query", 5);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it("should handle null data from RPC", async () => {
      const mockRpcResponse = {
        data: null,
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "test", 5);

      expect(results).toEqual([]);
    });

    it("should throw error on RPC failure", async () => {
      const mockRpcResponse = {
        data: null,
        error: { message: "RPC function not found" },
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      await expect(searchMemories(123456789, "test", 5)).rejects.toThrow(
        "Failed to search memories: RPC function not found"
      );
    });

    it("should generate embedding for search query", async () => {
      const { getEmbedding } = await import("../../../src/core/embeddings/index.js");

      const mockRpcResponse = {
        data: [],
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      await searchMemories(123456789, "search query text", 5);

      expect(getEmbedding).toHaveBeenCalledWith("search query text");
    });
  });

  describe("getAllMemories", () => {
    it("should return all memories for user", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "memory-1",
              telegram_user_id: 123456789,
              content: "Recent memory",
              category: "events",
              source_message: "Source 1",
              created_at: "2024-01-02T00:00:00Z",
              updated_at: "2024-01-02T00:00:00Z",
            },
            {
              id: "memory-2",
              telegram_user_id: 123456789,
              content: "Older memory",
              category: "personal_info",
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.from.mockReturnValue(mockSelectChain);

      const results = await getAllMemories(123456789);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject<Partial<UserMemory>>({
        id: "memory-1",
        telegramUserId: 123456789,
        content: "Recent memory",
        category: "events",
        sourceMessage: "Source 1",
      });
      expect(results[0]?.createdAt).toBeInstanceOf(Date);
      expect(results[0]?.updatedAt).toBeInstanceOf(Date);

      expect(mockSupabase.from).toHaveBeenCalledWith("user_memories");
      expect(mockSelectChain.select).toHaveBeenCalledWith(
        "id, telegram_user_id, content, category, source_message, created_at, updated_at"
      );
    });

    it("should filter by telegram user ID", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      await getAllMemories(987654321);

      expect(mockSelectChain.eq).toHaveBeenCalledWith("telegram_user_id", 987654321);
    });

    it("should order by created_at descending", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      await getAllMemories(123456789);

      expect(mockSelectChain.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("should return empty array for user with no memories", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      const results = await getAllMemories(123456789);

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it("should handle null data from query", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      const results = await getAllMemories(123456789);

      expect(results).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Query execution failed" },
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      await expect(getAllMemories(123456789)).rejects.toThrow(
        "Failed to get memories: Query execution failed"
      );
    });

    it("should map all fields correctly from database", async () => {
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "uuid-123",
              telegram_user_id: 555555555,
              content: "Test memory content",
              category: "health",
              source_message: "Original message",
              created_at: "2024-06-15T12:30:00Z",
              updated_at: "2024-06-16T14:45:00Z",
            },
          ],
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      const results = await getAllMemories(555555555);

      expect(results[0]).toEqual({
        id: "uuid-123",
        telegramUserId: 555555555,
        content: "Test memory content",
        category: "health",
        sourceMessage: "Original message",
        createdAt: new Date("2024-06-15T12:30:00Z"),
        updatedAt: new Date("2024-06-16T14:45:00Z"),
      });
    });
  });

  describe("deleteMemory", () => {
    it("should delete memory by ID", async () => {
      const mockDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.from.mockReturnValue(mockDeleteChain);

      await deleteMemory("memory-uuid-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("user_memories");
      expect(mockDeleteChain.delete).toHaveBeenCalled();
      expect(mockDeleteChain.eq).toHaveBeenCalledWith("id", "memory-uuid-123");
    });

    it("should not throw on non-existent ID", async () => {
      const mockDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null, // Supabase returns no error for non-existent rows
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockDeleteChain);

      await expect(deleteMemory("non-existent-uuid")).resolves.not.toThrow();
    });

    it("should throw error on database failure", async () => {
      const mockDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: { message: "Foreign key constraint violation" },
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockDeleteChain);

      await expect(deleteMemory("memory-uuid")).rejects.toThrow(
        "Failed to delete memory: Foreign key constraint violation"
      );
    });

    it("should handle multiple delete calls independently", async () => {
      const mockDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockDeleteChain);

      await deleteMemory("uuid-1");
      await deleteMemory("uuid-2");
      await deleteMemory("uuid-3");

      expect(mockDeleteChain.delete).toHaveBeenCalledTimes(3);
      expect(mockDeleteChain.eq).toHaveBeenCalledWith("id", "uuid-1");
      expect(mockDeleteChain.eq).toHaveBeenCalledWith("id", "uuid-2");
      expect(mockDeleteChain.eq).toHaveBeenCalledWith("id", "uuid-3");
    });
  });

  describe("Integration scenarios", () => {
    it("should add and retrieve memory in sequence", async () => {
      // Add memory
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "new-memory-id",
            telegram_user_id: 123456789,
            content: "Integration test memory",
            category: "other",
            embedding: JSON.stringify(Array(1024).fill(0.1)),
            source_message: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      const addedMemory = await addMemory(
        123456789,
        "Integration test memory",
        "other"
      );

      expect(addedMemory.id).toBe("new-memory-id");

      // Retrieve all memories
      vi.clearAllMocks();

      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "new-memory-id",
              telegram_user_id: 123456789,
              content: "Integration test memory",
              category: "other",
              source_message: null,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockSelectChain);

      const allMemories = await getAllMemories(123456789);

      expect(allMemories).toHaveLength(1);
      expect(allMemories[0]?.id).toBe("new-memory-id");
    });

    it("should search and delete memory by ID", async () => {
      // Search memories
      const mockRpcResponse = {
        data: [
          {
            id: "memory-to-delete",
            content: "Memory that will be deleted",
            category: "other",
            similarity: 0.9,
          },
        ],
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      const searchResults = await searchMemories(123456789, "test", 5);
      const memoryId = searchResults[0]?.id;

      expect(memoryId).toBe("memory-to-delete");

      // Delete memory
      vi.clearAllMocks();

      const mockDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      getMockedSupabase().from.mockReturnValue(mockDeleteChain);

      await deleteMemory(memoryId!);

      expect(mockDeleteChain.eq).toHaveBeenCalledWith("id", "memory-to-delete");
    });
  });

  describe("Edge cases", () => {
    it("should handle very long content strings", async () => {
      const longContent = "A".repeat(10000);

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "test-uuid",
            telegram_user_id: 123456789,
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

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      const result = await addMemory(123456789, longContent, "other");

      expect(result.content).toBe(longContent);
      expect(result.content).toHaveLength(10000);
    });

    it("should handle special characters in content", async () => {
      const specialContent = "User's email: test@example.com, phone: +1-234-567-8900, note: 'special' \"quotes\"";

      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "test-uuid",
            telegram_user_id: 123456789,
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

      getMockedSupabase().from.mockReturnValue(mockInsertChain);

      const result = await addMemory(123456789, specialContent, "personal_info");

      expect(result.content).toBe(specialContent);
    });

    it("should handle empty search results gracefully", async () => {
      const mockRpcResponse = {
        data: [],
        error: null,
      };

      getMockedSupabase().rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "non-matching query", 10);

      expect(results).toEqual([]);
      expect(results).toBeInstanceOf(Array);
    });

    it("should handle limit of 0 (edge case)", async () => {
      const mockRpcResponse = {
        data: [],
        error: null,
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      const results = await searchMemories(123456789, "test", 0);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          match_limit: 0,
        })
      );
      expect(results).toEqual([]);
    });

    it("should handle very large limit values", async () => {
      const mockRpcResponse = {
        data: [],
        error: null,
      };

      const mockSupabase = getMockedSupabase();
      mockSupabase.rpc.mockResolvedValue(mockRpcResponse);

      await searchMemories(123456789, "test", 1000);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "search_user_memories",
        expect.objectContaining({
          match_limit: 1000,
        })
      );
    });
  });
});
