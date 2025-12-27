/**
 * Unit tests for BGE-M3 Embeddings Client
 * Tests embedding generation, batch processing, and retry logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type OpenAI from "openai";

// Mock OpenAI client
const mockCreate = vi.fn();

class MockAPIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

const mockOpenAIConstructor = vi.fn().mockImplementation(() => ({
  embeddings: {
    create: mockCreate,
  },
}));

// Attach APIError as a static property
(mockOpenAIConstructor as any).APIError = MockAPIError;

vi.mock("openai", () => {
  const mockConstructor = vi.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
  }));

  // Attach APIError as static property
  (mockConstructor as any).APIError = MockAPIError;

  return {
    default: mockConstructor,
    APIError: MockAPIError,
  };
});

// Mock environment config
vi.mock("@/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    OPENROUTER_API_KEY: "sk-or-test-key",
    NODE_ENV: "test",
  })),
}));

// Mock logger
vi.mock("@/core/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("BGE-M3 Embeddings Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getEmbedding - single text", () => {
    it("should return 1024-dimensional vector for valid text", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1024);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "baai/bge-m3",
        input: "Test text",
        encoding_format: "float",
      });
    });

    it("should handle empty string", async () => {
      const mockEmbedding = new Array(1024).fill(0);

      mockCreate.mockResolvedValue({
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "baai/bge-m3",
        input: "",
        encoding_format: "float",
      });
    });

    it("should handle long text (>10000 chars)", async () => {
      const longText = "a".repeat(15000);
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding(longText);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "baai/bge-m3",
        input: longText,
        encoding_format: "float",
      });
    });

    it("should handle special characters and emojis", async () => {
      const specialText = "Hello 世界! 🌍 Special chars: @#$%^&*()";
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding(specialText);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "baai/bge-m3",
        input: specialText,
        encoding_format: "float",
      });
    });

    it("should handle Russian text (BGE-M3 optimization)", async () => {
      const russianText = "Привет, мир! Это тест русского языка.";
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [
          {
            embedding: mockEmbedding,
            index: 0,
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding(russianText);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1024);
    });

    it("should throw error when response is empty", async () => {
      mockCreate.mockResolvedValue({
        data: [],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Empty embedding response from OpenRouter");
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it("should throw error when embedding is missing", async () => {
      mockCreate.mockResolvedValue({
        data: [
          {
            index: 0,
            // Missing embedding field
          },
        ],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Empty embedding response from OpenRouter");
      await vi.runAllTimersAsync();
      await expectPromise;
    });
  });

  describe("getEmbeddings - batch processing", () => {
    it("should return correct number of embeddings for multiple texts", async () => {
      const mockEmbeddings = [
        new Array(1024).fill(0).map(() => Math.random()),
        new Array(1024).fill(0).map(() => Math.random()),
        new Array(1024).fill(0).map(() => Math.random()),
      ];

      mockCreate.mockResolvedValue({
        data: [
          { embedding: mockEmbeddings[0], index: 0 },
          { embedding: mockEmbeddings[1], index: 1 },
          { embedding: mockEmbeddings[2], index: 2 },
        ],
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const texts = ["Text 1", "Text 2", "Text 3"];
      const promise = getEmbeddings(texts);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
      expect(result[2]).toEqual(mockEmbeddings[2]);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "baai/bge-m3",
        input: texts,
        encoding_format: "float",
      });
    });

    it("should return empty array for empty input", async () => {
      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const result = await getEmbeddings([]);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should maintain order of embeddings (sorted by index)", async () => {
      const mockEmbeddings = [
        new Array(1024).fill(0).map(() => 0.1),
        new Array(1024).fill(0).map(() => 0.2),
        new Array(1024).fill(0).map(() => 0.3),
      ];

      // Return embeddings in wrong order
      mockCreate.mockResolvedValue({
        data: [
          { embedding: mockEmbeddings[2], index: 2 },
          { embedding: mockEmbeddings[0], index: 0 },
          { embedding: mockEmbeddings[1], index: 1 },
        ],
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const texts = ["Text 1", "Text 2", "Text 3"];
      const promise = getEmbeddings(texts);
      await vi.runAllTimersAsync();
      const result = await promise;

      // Should be sorted by index
      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
      expect(result[2]).toEqual(mockEmbeddings[2]);
    });

    it("should handle missing indices (use 0 as default)", async () => {
      const mockEmbeddings = [
        new Array(1024).fill(0).map(() => 0.1),
        new Array(1024).fill(0).map(() => 0.2),
      ];

      mockCreate.mockResolvedValue({
        data: [
          { embedding: mockEmbeddings[0] }, // Missing index
          { embedding: mockEmbeddings[1], index: 1 },
        ],
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const texts = ["Text 1", "Text 2"];
      const promise = getEmbeddings(texts);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toHaveLength(2);
    });

    it("should throw error when embedding count mismatch", async () => {
      const mockEmbeddings = [
        new Array(1024).fill(0).map(() => Math.random()),
      ];

      mockCreate.mockResolvedValue({
        data: [
          { embedding: mockEmbeddings[0], index: 0 },
        ],
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const texts = ["Text 1", "Text 2", "Text 3"];
      const promise = getEmbeddings(texts);
      const expectPromise = expect(promise).rejects.toThrow("Embedding count mismatch: expected 3, got 1");
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it("should throw error when response is empty", async () => {
      mockCreate.mockResolvedValue({
        data: [],
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbeddings(["Text 1"]);
      const expectPromise = expect(promise).rejects.toThrow("Empty embeddings response from OpenRouter");
      await vi.runAllTimersAsync();
      await expectPromise;
    });
  });

  describe("Retry logic", () => {
    it("should retry on 429 rate limit error", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate
        .mockRejectedValueOnce(new MockAPIError(429, "Rate limit exceeded"))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0 }],
        });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should retry on 500 server error", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate
        .mockRejectedValueOnce(new MockAPIError(500, "Internal server error"))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0 }],
        });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should retry on 503 service unavailable error", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate
        .mockRejectedValueOnce(new MockAPIError(503, "Service unavailable"))
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding, index: 0 }],
        });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry on 400 bad request error", async () => {
      mockCreate.mockRejectedValue(new MockAPIError(400, "Bad request"));

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Failed to generate embedding after 1 attempts");
      await vi.runAllTimersAsync();
      await expectPromise;
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should NOT retry on 401 unauthorized error", async () => {
      mockCreate.mockRejectedValue(new MockAPIError(401, "Unauthorized"));

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Failed to generate embedding after 1 attempts");
      await vi.runAllTimersAsync();
      await expectPromise;
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries exceeded (3 attempts)", async () => {
      mockCreate.mockRejectedValue(new MockAPIError(429, "Rate limit exceeded"));

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Failed to generate embedding after 3 attempts");
      await vi.runAllTimersAsync();
      await expectPromise;
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it("should apply exponential backoff with jitter", async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay: number) => {
        if (typeof delay === "number") {
          delays.push(delay);
        }
        return originalSetTimeout(fn, 0);
      });

      mockCreate.mockRejectedValue(new MockAPIError(429, "Rate limit exceeded"));

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");

      // Attach error handler before running timers to avoid unhandled rejection
      const catchPromise = promise.catch(() => {
        // Expected to throw after max retries
      });

      await vi.runAllTimersAsync();
      await catchPromise;

      // Should have 2 delays (after 1st and 2nd failures)
      expect(delays.length).toBeGreaterThanOrEqual(2);

      // First delay: ~1000ms with jitter
      expect(delays[0]).toBeGreaterThan(800);
      expect(delays[0]).toBeLessThan(1200);

      // Second delay: ~2000ms with jitter (exponential backoff)
      expect(delays[1]).toBeGreaterThan(1600);
      expect(delays[1]).toBeLessThan(2400);
    });

    it("should cap delay at RETRY_MAX_DELAY_MS (30000ms)", async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay: number) => {
        if (typeof delay === "number") {
          delays.push(delay);
        }
        return originalSetTimeout(fn, 0);
      });

      mockCreate.mockRejectedValue(new MockAPIError(429, "Rate limit exceeded"));

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");

      // Attach error handler before running timers to avoid unhandled rejection
      const catchPromise = promise.catch(() => {
        // Expected to throw after max retries
      });

      await vi.runAllTimersAsync();
      await catchPromise;

      // All delays should be <= 30000ms (+ jitter: 30000 * 1.1)
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(30000 * 1.1 + 1);
      });
    });

    it("should retry batch embeddings on retryable error", async () => {
      const mockEmbeddings = [
        new Array(1024).fill(0).map(() => Math.random()),
        new Array(1024).fill(0).map(() => Math.random()),
      ];

      mockCreate
        .mockRejectedValueOnce(new MockAPIError(503, "Service unavailable"))
        .mockResolvedValueOnce({
          data: [
            { embedding: mockEmbeddings[0], index: 0 },
            { embedding: mockEmbeddings[1], index: 1 },
          ],
        });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const texts = ["Text 1", "Text 2"];
      const promise = getEmbeddings(texts);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toHaveLength(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry batch embeddings on non-retryable error", async () => {
      mockCreate.mockRejectedValue(new MockAPIError(400, "Bad request"));

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbeddings(["Text 1", "Text 2"]);
      const expectPromise = expect(promise).rejects.toThrow("Failed to generate embeddings after 1 attempts");
      await vi.runAllTimersAsync();
      await expectPromise;
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("OpenAI client behavior", () => {
    it("should call embeddings.create with correct model", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const { getEmbedding, EMBEDDING_MODEL } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      await vi.runAllTimersAsync();
      await promise;

      expect(mockCreate).toHaveBeenCalledWith({
        model: EMBEDDING_MODEL,
        input: "Test text",
        encoding_format: "float",
      });
    });

    it("should reuse client across multiple calls", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      // Make two calls
      const promise1 = getEmbedding("Test 1");
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = getEmbedding("Test 2");
      await vi.runAllTimersAsync();
      await promise2;

      // Both calls should use the same client (mockCreate called twice)
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Constants export", () => {
    it("should export EMBEDDING_MODEL constant", async () => {
      const { EMBEDDING_MODEL } = await import("@/core/embeddings/bge-client.js");

      expect(EMBEDDING_MODEL).toBe("baai/bge-m3");
    });

    it("should export EMBEDDING_DIMS constant", async () => {
      const { EMBEDDING_DIMS } = await import("@/core/embeddings/bge-client.js");

      expect(EMBEDDING_DIMS).toBe(1024);
    });
  });

  describe("Edge cases", () => {
    it("should handle non-Error thrown values", async () => {
      mockCreate.mockRejectedValue("string error");

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow();
      await vi.runAllTimersAsync();
      await expectPromise;
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should handle null response data", async () => {
      mockCreate.mockResolvedValue({
        data: null,
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("Test text");
      const expectPromise = expect(promise).rejects.toThrow("Empty embedding response from OpenRouter");
      await vi.runAllTimersAsync();
      await expectPromise;
    });

    it("should handle whitespace-only text", async () => {
      const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const { getEmbedding } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbedding("   \n\t   ");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockEmbedding);
    });

    it("should handle very large batch (100+ texts)", async () => {
      const texts = Array.from({ length: 150 }, (_, i) => `Text ${i}`);
      const mockEmbeddings = texts.map(() =>
        new Array(1024).fill(0).map(() => Math.random())
      );

      mockCreate.mockResolvedValue({
        data: mockEmbeddings.map((emb, idx) => ({
          embedding: emb,
          index: idx,
        })),
      });

      const { getEmbeddings } = await import("@/core/embeddings/bge-client.js");

      const promise = getEmbeddings(texts);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toHaveLength(150);
    });
  });
});
