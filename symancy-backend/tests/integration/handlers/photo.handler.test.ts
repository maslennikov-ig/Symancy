/**
 * Integration tests for photo-analysis handler
 * Tests photo message handling, validation, persona detection, and job queuing
 *
 * Test Coverage:
 * - TC-US1-001: Basic Photo Analysis (Arina)
 * - TC-US1-003: Photo Too Large
 * - TC-US1-005: Persona Detection
 * - TC-US4-005: Case Insensitive Keywords
 * - Maintenance Mode handling
 * - Invalid Context scenarios
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotContext } from "../../../src/modules/router/middleware.js";

// Mock dependencies BEFORE importing handler
vi.mock("../../../src/core/queue.js", () => ({
  sendJob: vi.fn(() => Promise.resolve("test-job-id-123")),
}));

vi.mock("../../../src/modules/config/service.js", () => ({
  isMaintenanceMode: vi.fn(() => Promise.resolve(false)),
}));

// Logger is already globally mocked via vitest setup
// Import after mocks
import { handlePhotoMessage } from "../../../src/modules/photo-analysis/handler.js";
import { sendJob } from "../../../src/core/queue.js";
import { isMaintenanceMode } from "../../../src/modules/config/service.js";
import { QUEUE_ANALYZE_PHOTO, TELEGRAM_PHOTO_SIZE_LIMIT } from "../../../src/config/constants.js";

/**
 * Factory function to create mock BotContext for testing
 * Provides sensible defaults with override support
 */
function createPhotoContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    from: {
      id: 123456789,
      language_code: "ru",
      username: "testuser",
      first_name: "Test",
      is_bot: false,
      ...overrides.from,
    },
    chat: {
      id: 123456789,
      type: "private",
      ...overrides.chat,
    },
    message: {
      message_id: 999,
      date: Date.now() / 1000,
      chat: { id: 123456789, type: "private" },
      photo: [
        { file_id: "small", file_unique_id: "small_unique", width: 100, height: 100, file_size: 10000 },
        { file_id: "medium", file_unique_id: "medium_unique", width: 320, height: 320, file_size: 50000 },
        { file_id: "large", file_unique_id: "large_unique", width: 800, height: 800, file_size: 100000 },
      ],
      caption: undefined,
      ...overrides.message,
    },
    profile: {
      name: "Test User",
      ...overrides.profile,
    },
    reply: vi.fn(() => Promise.resolve({ message_id: 42 })),
    api: {
      editMessageText: vi.fn(() => Promise.resolve(true)),
      ...overrides.api,
    },
    ...overrides,
  } as unknown as BotContext;
}

describe("handlePhotoMessage - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset maintenance mode to false before each test
    vi.mocked(isMaintenanceMode).mockResolvedValue(false);
  });

  describe("TC-US1-001: Basic Photo Analysis (Arina)", () => {
    it("should send loading message immediately", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Verify loading message was sent
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("☕️"));
    });

    it("should queue job with correct data", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Verify job was sent to queue
      expect(sendJob).toHaveBeenCalledTimes(1);
      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          telegramUserId: 123456789,
          chatId: 123456789,
          messageId: 42, // Loading message ID
          fileId: "large", // Largest photo selected
          persona: "arina",
          language: "ru",
        })
      );
    });

    it("should use Arina persona by default (no caption)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: undefined, // No caption provided
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "arina",
        })
      );
    });

    it("should use Arina loading message for Russian language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "ru", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith("☕️ Смотрю в гущу...");
    });

    it("should use Arina loading message for English language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "en", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith("☕️ Reading the grounds...");
    });

    it("should use Arina loading message for Chinese language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "zh", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith("☕️ 正在解读咖啡渣...");
    });

    it("should include userName in job data when available", async () => {
      const ctx = createPhotoContext({
        profile: { name: "Мария Иванова" },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          userName: "Мария Иванова",
        })
      );
    });

    it("should fallback to Telegram username if profile name is missing", async () => {
      const ctx = createPhotoContext({
        profile: undefined,
        from: { id: 123, username: "maria_ivanova", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          userName: "maria_ivanova",
        })
      );
    });

    it("should fallback to first_name if username is missing", async () => {
      const ctx = createPhotoContext({
        profile: undefined,
        from: { id: 123, first_name: "Мария", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          userName: "Мария",
        })
      );
    });
  });

  describe("TC-US1-003: Photo Too Large", () => {
    it("should reject photos exceeding 10MB limit", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            {
              file_id: "oversized",
              file_unique_id: "oversized_unique",
              width: 4096,
              height: 4096,
              file_size: TELEGRAM_PHOTO_SIZE_LIMIT + 1000, // 10MB + 1KB
            },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      // Verify error message was sent
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("слишком большое")
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("10 МБ")
      );

      // Verify NO job was queued
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should send error message to user", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            {
              file_id: "huge",
              file_unique_id: "huge_unique",
              width: 8000,
              height: 8000,
              file_size: 15 * 1024 * 1024, // 15MB
            },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "📸 Изображение слишком большое. Максимальный размер: 10 МБ.\n" +
        "Попробуйте сжать фото или отправить другое."
      );
    });

    it("should NOT queue any job when photo is too large", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            { file_id: "oversized", file_unique_id: "oversized_unique", width: 4096, height: 4096, file_size: TELEGRAM_PHOTO_SIZE_LIMIT + 1 },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should proceed when file_size is undefined (unknown)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            {
              file_id: "unknown_size",
              file_unique_id: "unknown_unique",
              width: 800,
              height: 800,
              // file_size is undefined (not provided by Telegram)
            },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      // Should proceed and queue job
      expect(sendJob).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("☕️"));
    });

    it("should accept photos at exactly 10MB limit", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            {
              file_id: "max_size",
              file_unique_id: "max_unique",
              width: 2048,
              height: 2048,
              file_size: TELEGRAM_PHOTO_SIZE_LIMIT, // Exactly 10MB
            },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      // Should accept and queue job
      expect(sendJob).toHaveBeenCalledTimes(1);
      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          fileId: "max_size",
        })
      );
    });
  });

  describe("TC-US1-005: Persona Detection", () => {
    it("should detect 'cassandra' keyword in caption (lowercase)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "cassandra please analyze this",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should detect 'кассандра' (Russian) keyword", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "кассандра посмотри пожалуйста",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should detect 'premium' keyword", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "premium analysis please",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should detect 'премиум' (Russian) keyword", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "премиум анализ",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should be case-insensitive for keywords", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "CaSsAnDrA analyze",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should use Cassandra loading message when persona is detected", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "ru", is_bot: false },
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "cassandra",
        },
      });

      await handlePhotoMessage(ctx);

      // Cassandra should have different loading message (🔮 instead of ☕️)
      expect(ctx.reply).toHaveBeenCalledWith("🔮 Всматриваюсь в знаки судьбы...");
    });
  });

  describe("TC-US4-005: Case Insensitive Keywords", () => {
    it("should trigger Cassandra with 'CASSANDRA' (uppercase)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "CASSANDRA",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should trigger Cassandra with 'CasSanDrA' (mixed case)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "CasSanDrA",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should trigger Cassandra with 'ПРЕМИУМ' (uppercase Russian)", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "ПРЕМИУМ",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should detect keyword in middle of caption", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "hey cassandra can you read this?",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });

    it("should trim whitespace before detecting keywords", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: "   cassandra   ",
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });
  });

  describe("Maintenance Mode", () => {
    it("should respond with maintenance message when enabled", async () => {
      vi.mocked(isMaintenanceMode).mockResolvedValue(true);

      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Should send maintenance message
      expect(ctx.reply).toHaveBeenCalledWith(
        "⚙️ Бот находится на обслуживании. Попробуйте позже."
      );

      // Should NOT queue job
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should NOT queue job during maintenance", async () => {
      vi.mocked(isMaintenanceMode).mockResolvedValue(true);

      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should check maintenance mode before processing", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Maintenance check should be called
      expect(isMaintenanceMode).toHaveBeenCalledTimes(1);
    });
  });

  describe("Invalid Context", () => {
    it("should return early if no photo in message", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: undefined, // No photo
          text: "Hello bot",
        },
      });

      await handlePhotoMessage(ctx);

      // Should not send any reply or queue job
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should return early if no chat ID", async () => {
      const ctx = createPhotoContext({
        chat: undefined,
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).not.toHaveBeenCalled();
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should return early if no from ID", async () => {
      const ctx = createPhotoContext({
        from: undefined,
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).not.toHaveBeenCalled();
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should return early if photo array is empty", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [], // Empty array
        },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).not.toHaveBeenCalled();
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should handle missing message gracefully", async () => {
      const ctx = createPhotoContext({
        message: undefined,
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).not.toHaveBeenCalled();
      expect(sendJob).not.toHaveBeenCalled();
    });
  });

  describe("Photo Selection", () => {
    it("should select largest photo for best quality", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            { file_id: "small_100", file_unique_id: "s100", width: 100, height: 100, file_size: 5000 },
            { file_id: "medium_320", file_unique_id: "m320", width: 320, height: 320, file_size: 25000 },
            { file_id: "large_800", file_unique_id: "l800", width: 800, height: 800, file_size: 100000 },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      // Should use the largest photo (last in array)
      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          fileId: "large_800",
        })
      );
    });

    it("should handle single photo in array", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            { file_id: "only_one", file_unique_id: "only", width: 640, height: 480, file_size: 80000 },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          fileId: "only_one",
        })
      );
    });
  });

  describe("Job Queue Error Handling", () => {
    it("should handle failed job enqueue", async () => {
      vi.mocked(sendJob).mockResolvedValue(null); // Simulate failure

      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Should edit loading message with error
      expect(ctx.api.editMessageText).toHaveBeenCalledWith(
        123456789,
        42,
        "❌ Не удалось обработать запрос. Попробуйте ещё раз."
      );
    });

    it("should send loading message before job queue failure", async () => {
      vi.mocked(sendJob).mockResolvedValue(null);

      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Loading message should be sent first
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("☕️"));

      // Then error message via editMessageText
      expect(ctx.api.editMessageText).toHaveBeenCalled();
    });
  });

  describe("Caption Length Validation", () => {
    it("should default to Arina for caption exceeding MAX_CAPTION_LENGTH", async () => {
      const longCaption = "a".repeat(1001); // Exceeds MAX_CAPTION_LENGTH (1000)

      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: longCaption,
        },
      });

      await handlePhotoMessage(ctx);

      // Should default to arina due to caption length
      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "arina",
        })
      );
    });

    it("should process normal length caption with keywords", async () => {
      const normalCaption = "cassandra please analyze";

      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [{ file_id: "test", file_unique_id: "test_unique", width: 100, height: 100, file_size: 50000 }],
          caption: normalCaption,
        },
      });

      await handlePhotoMessage(ctx);

      expect(sendJob).toHaveBeenCalledWith(
        QUEUE_ANALYZE_PHOTO,
        expect.objectContaining({
          persona: "cassandra",
        })
      );
    });
  });
});
