/**
 * Integration tests for photo-analysis handler
 * Tests photo message handling, validation, and topic selection keyboard
 *
 * NOTE: Photo handler now shows topic selection keyboard instead of queuing job directly.
 * Persona detection and job queuing tests are in topic-handler.test.ts
 *
 * Test Coverage:
 * - TC-US1-001: Basic Photo Analysis - Topic Selection Keyboard
 * - TC-US1-003: Photo Too Large
 * - Maintenance Mode handling
 * - Invalid Context scenarios
 * - Topic Selection Keyboard display
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

  describe("TC-US1-001: Basic Photo Analysis - Topic Selection", () => {
    it("should show topic selection prompt with keyboard", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Verify topic selection prompt was sent with keyboard
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("☕️"),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      );
    });

    it("should NOT queue job directly - job is queued after topic selection", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Job is queued by topic-handler after user selects topic
      expect(sendJob).not.toHaveBeenCalled();
    });

    it("should show Russian topic selection message for Russian language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "ru", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "☕️ Фото получено!\n\nВыберите тему (1 Basic-кредит) или получите полный анализ (1 Pro-кредит):",
        expect.any(Object)
      );
    });

    it("should show English topic selection message for English language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "en", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "☕️ Photo received!\n\nChoose a topic (1 Basic credit) or get full analysis (1 Pro credit):",
        expect.any(Object)
      );
    });

    it("should show Chinese topic selection message for Chinese language", async () => {
      const ctx = createPhotoContext({
        from: { id: 123, language_code: "zh", is_bot: false },
      });

      await handlePhotoMessage(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "☕️ 照片已收到！\n\n选择主题（1个Basic积分）或获取完整分析（1个Pro积分）:",
        expect.any(Object)
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

      // Should proceed and show topic selection keyboard
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("☕️"),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
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

      // Should accept and show topic selection keyboard
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("☕️"),
        expect.objectContaining({ reply_markup: expect.any(Object) })
      );
    });
  });

  // NOTE: Persona detection tests moved to topic-handler.test.ts
  // Photo handler now shows topic selection keyboard instead of queuing job directly

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

  describe("Topic Selection Keyboard", () => {
    it("should show topic selection keyboard with correct message", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // Should show topic selection prompt
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("☕️"),
        expect.objectContaining({
          reply_markup: expect.any(Object),
        })
      );
    });

    it("should include short ID reference in keyboard callback data", async () => {
      const ctx = createPhotoContext({
        message: {
          message_id: 999,
          date: Date.now() / 1000,
          chat: { id: 123456789, type: "private" },
          photo: [
            { file_id: "test_file_id", file_unique_id: "test", width: 800, height: 800, file_size: 100000 },
          ],
        },
      });

      await handlePhotoMessage(ctx);

      // Keyboard should be passed to reply with short ID format (topic:{key}:{shortId})
      // Short IDs are used instead of file_id due to Telegram's 64-byte callback_data limit
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  // Format: topic:{topicKey}:{shortId} where shortId is 10 chars
                  callback_data: expect.stringMatching(/^topic:[a-z]+:[A-Za-z0-9_-]{10}$/),
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it("should NOT call sendJob directly (job is queued by topic-handler)", async () => {
      const ctx = createPhotoContext();

      await handlePhotoMessage(ctx);

      // sendJob is now called by topic-handler, not photo-handler
      expect(sendJob).not.toHaveBeenCalled();
    });
  });
});
