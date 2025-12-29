/**
 * Chat Chain with Memory Integration Tests
 *
 * Verifies that the chat chain properly integrates with the memory service
 * during response generation, including:
 * - Searching relevant memories based on user message
 * - Including memory context in prompt
 * - Graceful fallback when memory search fails
 * - Proper formatting of memory context
 *
 * Test Strategy:
 * - Spy on memory service functions to verify integration
 * - Mock LangChain model for deterministic responses
 * - Mock Supabase for chat history and analysis data
 * - Mock file system for prompt loading
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateChatResponseDirect } from "../../../src/chains/chat.chain.js";
import * as memoryService from "../../../src/services/memory.service.js";

// =============================================================================
// Mock Setup
// =============================================================================

/**
 * Mock Supabase client with chainable methods
 */
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

/**
 * Mock LangChain model to control responses
 */
const mockModelInvoke = vi.fn();

vi.mock("../../../src/core/langchain/models.js", () => ({
  createArinaModel: vi.fn(() => ({
    invoke: mockModelInvoke,
  })),
}));

/**
 * Mock file system for prompt loading
 * Handles all Arina prompt files
 */
vi.mock("fs/promises", () => ({
  readFile: vi.fn((path: string) => {
    if (path.includes("system.txt")) {
      return Promise.resolve("You are Arina, a psychologist and coffee ground reader.");
    }
    if (path.includes("chat.txt")) {
      return Promise.resolve(`You are continuing a conversation with {{USER_NAME}}.

## Context from last reading

{{LAST_ANALYSIS}}

## Language
{{LANGUAGE}}

Respond warmly and concisely.`);
    }
    if (path.includes("interpretation.txt")) {
      return Promise.resolve("Interpret the coffee grounds for {{USER_NAME}}.");
    }
    if (path.includes("invalid-image.txt")) {
      return Promise.resolve("The image provided is not valid for reading.");
    }
    // Default fallback for any other prompt file
    return Promise.resolve("Mock prompt content for testing.");
  }),
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Mock successful chat history load
 */
function mockChatHistory(messages: Array<{ role: string; content: string }> = []) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: messages.map(m => ({
        ...m,
        created_at: new Date().toISOString(),
      })),
      error: null,
    }),
  };

  mockSupabaseClient.from.mockReturnValue(selectChain);
  return selectChain;
}

/**
 * Mock last analysis load
 */
function mockLastAnalysis(interpretation: string | null = null) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: interpretation ? { interpretation } : null,
      error: interpretation ? null : { message: "No analysis found" },
    }),
  };

  // Second call to .from() should return analysis chain
  mockSupabaseClient.from.mockReturnValueOnce({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: [],
      error: null,
    }),
  }).mockReturnValueOnce(selectChain);
}

/**
 * Mock LangChain model response
 */
function mockModelResponse(content: string, tokens: number = 100) {
  mockModelInvoke.mockResolvedValue({
    content,
    usage_metadata: {
      total_tokens: tokens,
    },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("Chat Chain with Memory Integration", () => {
  const TEST_USER_ID = 999999997;
  const TEST_MESSAGE = "Привет, напомни как меня зовут";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Memory Search Integration
  // ===========================================================================

  describe("Memory Search Integration", () => {
    it("should call searchMemories with correct parameters", async () => {
      // Spy on searchMemories
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User's name is TestBot",
          category: "personal_info",
          score: 0.9,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Привет, TestBot! 👋");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(searchSpy).toHaveBeenCalledWith(TEST_USER_ID, TEST_MESSAGE, 5);
      expect(searchSpy).toHaveBeenCalledTimes(1);
    });

    it("should search memories with message as query", async () => {
      const customMessage = "Какие у меня есть интересы?";
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Ваши интересы...");

      await generateChatResponseDirect(customMessage, TEST_USER_ID);

      expect(searchSpy).toHaveBeenCalledWith(TEST_USER_ID, customMessage, 5);
    });

    it("should request exactly 5 memories by default", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(searchSpy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        5
      );
    });
  });

  // ===========================================================================
  // Memory Context Formatting
  // ===========================================================================

  describe("Memory Context Formatting", () => {
    it("should include relevant memories in response context", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const mockMemories = [
        {
          id: "mem-1",
          content: "User's name is TestBot",
          category: "personal_info",
          score: 0.9,
        },
        {
          id: "mem-2",
          content: "User likes coffee",
          category: "preferences",
          score: 0.85,
        },
      ];

      searchSpy.mockResolvedValueOnce(mockMemories);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Привет, TestBot! Да, ты любишь кофе ☕");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      // Verify model was invoked with messages including memory context
      expect(mockModelInvoke).toHaveBeenCalled();
      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      expect(invokeArgs).toBeDefined();

      // Check that memory context is formatted correctly in system messages
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages.find((msg: any) =>
        msg.content.includes("Relevant memories")
      );

      expect(chatPrompt).toBeDefined();
      expect(chatPrompt.content).toContain("## Relevant memories about this user:");
      expect(chatPrompt.content).toContain("- User's name is TestBot");
      expect(chatPrompt.content).toContain("- User likes coffee");
    });

    it("should format memory context as bulleted list", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const mockMemories = [
        { id: "1", content: "First memory", category: "other", score: 0.9 },
        { id: "2", content: "Second memory", category: "other", score: 0.8 },
        { id: "3", content: "Third memory", category: "other", score: 0.7 },
      ];

      searchSpy.mockResolvedValueOnce(mockMemories);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response based on memories");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1]; // Second system message is chat prompt
      expect(chatPrompt.content).toMatch(/- First memory\n/);
      expect(chatPrompt.content).toMatch(/- Second memory\n/);
      expect(chatPrompt.content).toMatch(/- Third memory/);
    });

    it("should append memory context to last analysis context", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User prefers morning coffee",
          category: "preferences",
          score: 0.9,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis("You saw a spiral pattern in the coffee grounds.");
      mockModelResponse("Based on the reading and your preferences...");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];

      // Should contain both last analysis and memory context
      expect(chatPrompt.content).toContain("spiral pattern");
      expect(chatPrompt.content).toContain("## Relevant memories about this user:");
      expect(chatPrompt.content).toContain("- User prefers morning coffee");
    });

    it("should not include memory context when no memories found", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response without memories");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];

      // Should NOT contain memory context section
      expect(chatPrompt.content).not.toContain("Relevant memories");
      expect(chatPrompt.content).toContain("No previous analysis available");
    });

    it("should preserve memory content exactly as returned", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const specialContent = "User's email: test@example.com, age: 25, hobby: 'coffee tasting' ☕";

      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: specialContent,
          category: "personal_info",
          score: 0.95,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Got it!");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain(specialContent);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    it("should handle memory search failure gracefully", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      searchSpy.mockRejectedValueOnce(new Error("Database connection failed"));

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response without memories (after error)");

      // Should not throw, just continue without memories
      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result.text).toBe("Response without memories (after error)");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Memory search failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should log error but still generate response on memory failure", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      searchSpy.mockRejectedValueOnce(new Error("Embedding service timeout"));

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Successful response despite memory error");

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result.text).toBe("Successful response despite memory error");
      expect(result.tokensUsed).toBe(100);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Memory search failed:",
        expect.objectContaining({
          message: "Embedding service timeout",
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle network timeout in memory search", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      searchSpy.mockRejectedValueOnce(new Error("ETIMEDOUT"));

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response after timeout");

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(mockModelInvoke).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Memory search failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should continue if memory search returns undefined", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      // @ts-expect-error - Testing edge case
      searchSpy.mockResolvedValueOnce(undefined);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response");

      // Should not throw
      await expect(
        generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID)
      ).resolves.toBeDefined();
    });

    it("should handle malformed memory objects gracefully", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");

      // Mock memories with missing fields
      searchSpy.mockResolvedValueOnce([
        // @ts-expect-error - Testing malformed data
        { id: "1", content: null, category: "other", score: 0.9 },
        { id: "2", content: "Valid memory", category: "other", score: 0.8 },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response");

      // Should handle gracefully without throwing
      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);
      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // Integration with Chat History
  // ===========================================================================

  describe("Integration with Chat History", () => {
    it("should include both memories and chat history in context", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User is a software engineer",
          category: "work",
          score: 0.9,
        },
      ]);

      // Mock chat history
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                role: "user",
                content: "Привет!",
                created_at: "2024-01-01T00:00:00Z",
              },
              {
                role: "assistant",
                content: "Здравствуй! ✨",
                created_at: "2024-01-01T00:01:00Z",
              },
            ],
            error: null,
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "No analysis" },
          }),
        });

      mockModelResponse("Response with both context types");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];

      // Should have: system prompt, chat prompt, history (2 messages), user message
      expect(invokeArgs).toHaveLength(5);

      // Verify memory in chat prompt
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );
      expect(systemMessages[1].content).toContain("User is a software engineer");

      // Verify chat history messages
      const humanMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "HumanMessage"
      );
      const aiMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "AIMessage"
      );

      expect(humanMessages).toHaveLength(2); // Previous + current
      expect(aiMessages).toHaveLength(1); // Previous response
    });

    it("should work with empty chat history but with memories", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User's favorite color is blue",
          category: "preferences",
          score: 0.85,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("First message with memory context");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];

      // Should have: system prompt, chat prompt (with memory), user message
      expect(invokeArgs).toHaveLength(3);

      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );
      expect(systemMessages[1].content).toContain("User's favorite color is blue");
    });
  });

  // ===========================================================================
  // Memory Content Scenarios
  // ===========================================================================

  describe("Memory Content Scenarios", () => {
    it("should handle single memory", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User prefers decaf coffee",
          category: "preferences",
          score: 0.95,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("## Relevant memories about this user:");
      expect(chatPrompt.content).toContain("- User prefers decaf coffee");
    });

    it("should handle maximum memories (5)", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const mockMemories = [
        { id: "1", content: "Memory 1", category: "other", score: 0.95 },
        { id: "2", content: "Memory 2", category: "other", score: 0.90 },
        { id: "3", content: "Memory 3", category: "other", score: 0.85 },
        { id: "4", content: "Memory 4", category: "other", score: 0.80 },
        { id: "5", content: "Memory 5", category: "other", score: 0.75 },
      ];

      searchSpy.mockResolvedValueOnce(mockMemories);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response with all memories");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];

      // All 5 memories should be included
      for (let i = 1; i <= 5; i++) {
        expect(chatPrompt.content).toContain(`Memory ${i}`);
      }
    });

    it("should handle memories with various categories", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "1",
          content: "User's name is Alex",
          category: "personal_info",
          score: 0.95,
        },
        {
          id: "2",
          content: "User has anxiety about deadlines",
          category: "health",
          score: 0.90,
        },
        {
          id: "3",
          content: "User loves hiking",
          category: "interests",
          score: 0.85,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Personalized response");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("User's name is Alex");
      expect(chatPrompt.content).toContain("anxiety about deadlines");
      expect(chatPrompt.content).toContain("loves hiking");
    });

    it("should handle memories with unicode and emojis", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "Пользователь любит кофе ☕ и чай 🍵",
          category: "preferences",
          score: 0.9,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Ответ с учетом памяти");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("Пользователь любит кофе ☕ и чай 🍵");
    });
  });

  // ===========================================================================
  // Response Verification
  // ===========================================================================

  describe("Response Verification", () => {
    it("should return complete ChatResponseResult with memories", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User's favorite time is morning",
          category: "preferences",
          score: 0.88,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Good morning response", 250);

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result).toEqual({
        text: "Good morning response",
        tokensUsed: 250,
      });
    });

    it("should return valid response even when memory search fails", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      searchSpy.mockRejectedValueOnce(new Error("Service unavailable"));

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Fallback response", 150);

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result).toEqual({
        text: "Fallback response",
        tokensUsed: 150,
      });

      expect(result.text).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
    });

    it("should include token usage from model", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User works remotely",
          category: "work",
          score: 0.87,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response about remote work", 320);

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result.tokensUsed).toBe(320);
    });
  });

  // ===========================================================================
  // Language and User Options
  // ===========================================================================

  describe("Language and User Options", () => {
    it("should work with custom language option", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([
        {
          id: "mem-1",
          content: "User speaks English",
          category: "personal_info",
          score: 0.9,
        },
      ]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("English response");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID, {
        language: "en",
      });

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("en"); // Language placeholder replaced
    });

    it("should work with custom userName option", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID, {
        userName: "Alexey",
      });

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("Alexey"); // User name placeholder replaced
    });

    it("should use default language (ru) when not specified", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Русский ответ");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("ru"); // Default language
    });

    it("should use default userName when not specified", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      searchSpy.mockResolvedValueOnce([]);

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Ответ");

      await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      const invokeArgs = mockModelInvoke.mock.calls[0]?.[0];
      const systemMessages = invokeArgs.filter(
        (msg: any) => msg.constructor.name === "SystemMessage"
      );

      const chatPrompt = systemMessages[1];
      expect(chatPrompt.content).toContain("дорогой друг"); // Default userName
    });
  });

  // ===========================================================================
  // Non-blocking Memory Search
  // ===========================================================================

  describe("Non-blocking Memory Search", () => {
    it("should not block response generation if memory search is slow", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");

      // Simulate slow memory search (but still completes)
      searchSpy.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve([
                  {
                    id: "mem-1",
                    content: "Delayed memory",
                    category: "other",
                    score: 0.8,
                  },
                ]),
              10
            );
          })
      );

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response with delayed memory");

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result.text).toBe("Response with delayed memory");

      // Memory search should still complete
      expect(searchSpy).toHaveBeenCalled();
    });

    it("should continue even if memory promise rejects", async () => {
      const searchSpy = vi.spyOn(memoryService, "searchMemories");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      searchSpy.mockRejectedValue(new Error("Promise rejection"));

      mockChatHistory([]);
      mockLastAnalysis(null);
      mockModelResponse("Response continues");

      const result = await generateChatResponseDirect(TEST_MESSAGE, TEST_USER_ID);

      expect(result.text).toBe("Response continues");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
