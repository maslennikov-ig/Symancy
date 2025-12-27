/**
 * Unit tests for Memory Extraction Chain
 * Tests extraction of memorable facts from user messages using Qwen 2.5 72B
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractMemories,
  type ExtractionResult,
  type ExtractedMemory,
} from "../../../src/chains/memory-extraction.chain.js";

// Import ChatOpenAI at module level to ensure proper mocking
import { ChatOpenAI } from "@langchain/openai";

// Mock ChatOpenAI
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn(),
  })),
}));

// Mock env
vi.mock("../../../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    OPENROUTER_API_KEY: "test-key",
  })),
}));

describe("memory-extraction.chain", () => {
  let mockInvoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked ChatOpenAI class (no dynamic import needed)
    const MockedChatOpenAI = vi.mocked(ChatOpenAI);

    // Create a mock instance and get its invoke method
    mockInvoke = vi.fn();
    MockedChatOpenAI.mockImplementation(() => ({
      invoke: mockInvoke,
    }) as any);
  });

  describe("personal_info category", () => {
    it("should extract name from Russian message", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user's name is Alexey",
              category: "personal_info",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Меня зовут Алексей");

      expect(result).toMatchObject<Partial<ExtractionResult>>({
        hasMemories: true,
      });
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toMatchObject<Partial<ExtractedMemory>>({
        category: "personal_info",
        content: expect.stringContaining("Alexey"),
      });
    });

    it("should extract location from message", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user lives in Moscow",
              category: "personal_info",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Я живу в Москве");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("personal_info");
      expect(result.memories[0].content).toContain("Moscow");
    });

    it("should extract age from message", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user is 28 years old",
              category: "personal_info",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Мне 28 лет");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("personal_info");
      expect(result.memories[0].content).toContain("28");
    });
  });

  describe("health category", () => {
    it("should extract health symptoms", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user has back pain",
              category: "health",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("У меня болит спина");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("health");
      expect(result.memories[0].content).toContain("back pain");
    });

    it("should extract chronic conditions", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user has diabetes",
              category: "health",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("У меня диабет");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("health");
      expect(result.memories[0].content).toContain("diabetes");
    });

    it("should extract allergies", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user is allergic to nuts",
              category: "health",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("У меня аллергия на орехи");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("health");
      expect(result.memories[0].content).toContain("allergic to nuts");
    });
  });

  describe("preferences category", () => {
    it("should extract communication style preference", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user prefers brief responses",
              category: "preferences",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Я предпочитаю краткие ответы");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("preferences");
      expect(result.memories[0].content).toContain("brief");
    });

    it("should extract food preferences", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user likes green tea",
              category: "preferences",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Я люблю зеленый чай");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("preferences");
      expect(result.memories[0].content).toContain("green tea");
    });
  });

  describe("events category", () => {
    it("should extract upcoming events", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user has an important meeting next week",
              category: "events",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories(
        "На следующей неделе важная встреча"
      );

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("events");
      expect(result.memories[0].content).toContain("meeting next week");
    });

    it("should extract deadlines", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user needs to submit a project by Friday",
              category: "events",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories(
        "Мне нужно сдать проект до пятницы"
      );

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("events");
      expect(result.memories[0].content).toContain("Friday");
    });
  });

  describe("work category", () => {
    it("should extract job information", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user works as a programmer at Yandex",
              category: "work",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories(
        "Я работаю программистом в Яндексе"
      );

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("work");
      expect(result.memories[0].content).toContain("programmer");
      expect(result.memories[0].content).toContain("Yandex");
    });

    it("should extract project information", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user is working on an EdTech startup",
              category: "work",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Работаю над стартапом в EdTech");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("work");
      expect(result.memories[0].content).toContain("EdTech");
    });
  });

  describe("interests category", () => {
    it("should extract hobbies", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user practices yoga in the morning",
              category: "interests",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Я занимаюсь йогой по утрам");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("interests");
      expect(result.memories[0].content).toContain("yoga");
    });

    it("should extract topics of interest", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user is interested in cryptocurrency",
              category: "interests",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Интересуюсь криптовалютами");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("interests");
      expect(result.memories[0].content).toContain("cryptocurrency");
    });
  });

  describe("no memories cases", () => {
    it("should return empty for greetings", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [],
          hasMemories: false,
        }),
      });

      const result = await extractMemories("Привет! Как дела?");

      expect(result).toMatchObject<Partial<ExtractionResult>>({
        hasMemories: false,
        memories: [],
      });
    });

    it("should return empty for questions", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [],
          hasMemories: false,
        }),
      });

      const result = await extractMemories("Что ты думаешь?");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should return empty for small talk", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [],
          hasMemories: false,
        }),
      });

      const result = await extractMemories("Да, согласен");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });
  });

  describe("multiple memories", () => {
    it("should extract multiple facts from complex message", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user's name is Maria",
              category: "personal_info",
            },
            {
              content: "The user works as a designer",
              category: "work",
            },
            {
              content: "The user likes minimalist style",
              category: "preferences",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories(
        "Меня зовут Мария, я работаю дизайнером и предпочитаю минималистичный стиль"
      );

      expect(result).toMatchObject<Partial<ExtractionResult>>({
        hasMemories: true,
        memories: expect.arrayContaining([
          expect.objectContaining<Partial<ExtractedMemory>>({
            category: "personal_info",
          }),
          expect.objectContaining<Partial<ExtractedMemory>>({
            category: "work",
          }),
          expect.objectContaining<Partial<ExtractedMemory>>({
            category: "preferences",
          }),
        ]),
      });
      expect(result.memories).toHaveLength(3);
    });

    it("should extract mixed category memories", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user has back pain",
              category: "health",
            },
            {
              content: "The user has a doctor appointment on Friday",
              category: "events",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories(
        "У меня болит спина, записался к врачу на пятницу"
      );

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(2);
      expect(result.memories[0].category).toBe("health");
      expect(result.memories[1].category).toBe("events");
    });
  });

  describe("error handling", () => {
    it("should handle malformed LLM response gracefully", async () => {
      // Suppress console.error to avoid noise in this test
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: "This is not JSON at all!",
      });

      const result = await extractMemories("Test message");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle response with no JSON", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: "Some text without JSON structure",
      });

      const result = await extractMemories("Test message");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle JSON in markdown code block", async () => {
      mockInvoke.mockResolvedValue({
        content: `\`\`\`json
{
  "memories": [
    {
      "content": "The user's name is Alex",
      "category": "personal_info"
    }
  ],
  "hasMemories": true
}
\`\`\``,
      });

      const result = await extractMemories("Меня зовут Алекс");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toContain("Alex");
    });

    it("should handle invalid category and fail gracefully", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "Some fact",
              category: "invalid_category",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Test message");

      // Should return empty due to Zod validation failure
      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle missing required fields", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "Some fact",
              // Missing category
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("Test message");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle network errors and propagate", async () => {
      mockInvoke.mockRejectedValue(new Error("Network error"));

      await expect(extractMemories("Test message")).rejects.toThrow(
        "Network error"
      );
    });

    it("should handle empty response content", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: "",
      });

      const result = await extractMemories("Test message");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should handle partial JSON", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockResolvedValue({
        content: '{"memories": [{"content": "Incomplete',
      });

      const result = await extractMemories("Test message");

      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);
    });

    it("should log parse errors to console", async () => {
      // Mock console.error to verify it's called
      const originalError = console.error;
      const errorCalls: any[] = [];
      console.error = (...args: any[]) => {
        errorCalls.push(args);
      };

      // Provide JSON-like content that will match the regex but fail JSON.parse
      mockInvoke.mockResolvedValue({
        content: '{"memories": [{"content": "test", "category": "personal_info"}], "hasMemories": true,}', // Trailing comma will cause parse error
      });

      const result = await extractMemories("Test message");

      // Verify error was logged
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][0]).toBe("Memory extraction parse error:");

      // Verify fallback behavior
      expect(result.hasMemories).toBe(false);
      expect(result.memories).toHaveLength(0);

      // Restore console.error
      console.error = originalError;
    });
  });

  describe("other category", () => {
    it("should use 'other' category for uncategorized facts", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [
            {
              content: "The user has a pet cat",
              category: "other",
            },
          ],
          hasMemories: true,
        }),
      });

      const result = await extractMemories("У меня есть кот");

      expect(result.hasMemories).toBe(true);
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].category).toBe("other");
    });
  });

  describe("model configuration", () => {
    it("should use correct model and configuration", async () => {
      const MockedChatOpenAI = vi.mocked(ChatOpenAI);

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [],
          hasMemories: false,
        }),
      });

      await extractMemories("Test");

      expect(MockedChatOpenAI).toHaveBeenCalledWith({
        model: "qwen/qwen-2.5-72b-instruct",
        temperature: 0.1,
        maxTokens: 500,
        configuration: {
          apiKey: "test-key",
          baseURL: "https://openrouter.ai/api/v1",
        },
      });
    });

    it("should invoke model with correct messages", async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          memories: [],
          hasMemories: false,
        }),
      });

      await extractMemories("Test message");

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            lc_namespace: ["langchain_core", "messages"],
            content: expect.stringContaining("memory extraction assistant"),
          }),
          expect.objectContaining({
            lc_namespace: ["langchain_core", "messages"],
            content: expect.stringContaining("Test message"),
          }),
        ])
      );
    });
  });
});
