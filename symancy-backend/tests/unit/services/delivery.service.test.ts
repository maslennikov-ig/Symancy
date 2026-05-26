/**
 * Unit tests for DeliveryService.deliverToTelegram — reply_markup threading (sym-xcq)
 *
 * Verifies (Trial follow-up, approach B — backend delivery layer):
 *   - When options.reply_markup is provided, it is forwarded to api.sendMessage.
 *   - When options.reply_markup is NOT provided, the field is absent/undefined
 *     in the api.sendMessage call (backward compatibility preserved).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InlineKeyboardMarkup } from "grammy/types";

// Mock logger (relative path used by DeliveryService). child() is recursive
// because DeliveryService chains getLogger().child().child().
vi.mock("../../../src/core/logger.js", () => {
  const makeLogger = (): Record<string, unknown> => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => makeLogger()),
  });
  return { getLogger: vi.fn(() => makeLogger()) };
});

// Mock telegram core — capture api.sendMessage args without hitting Telegram.
const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

vi.mock("../../../src/core/telegram.js", () => ({
  getBotApi: vi.fn(() => ({
    sendMessage: mockSendMessage,
  })),
}));

// Mock database core — DeliveryService imports getSupabase at module load.
vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(),
}));

import { DeliveryService } from "../../../src/services/delivery/DeliveryService.js";

const CHAT_ID = 12345;
const CONTENT = "Hello with a keyboard";

const SAMPLE_MARKUP: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🎁 Купить", callback_data: "buy:open" }],
  ],
};

describe("DeliveryService.deliverToTelegram — reply_markup threading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful send returning a fake message.
    mockSendMessage.mockResolvedValue({
      message_id: 999,
      date: Math.floor(Date.now() / 1000),
    });
  });

  it("forwards reply_markup to api.sendMessage when provided", async () => {
    const service = DeliveryService.getInstance();

    const result = await service.deliverToTelegram(CHAT_ID, CONTENT, {
      parse_mode: "HTML",
      reply_markup: SAMPLE_MARKUP,
    });

    expect(result.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const [, , passedOptions] = mockSendMessage.mock.calls[0];
    expect(passedOptions.reply_markup).toEqual(SAMPLE_MARKUP);
  });

  it("does not set reply_markup when not provided (backward compatible)", async () => {
    const service = DeliveryService.getInstance();

    const result = await service.deliverToTelegram(CHAT_ID, CONTENT, {
      parse_mode: "HTML",
    });

    expect(result.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const [, , passedOptions] = mockSendMessage.mock.calls[0];
    expect(passedOptions.reply_markup).toBeUndefined();
  });

  it("does not set reply_markup when options omitted entirely", async () => {
    const service = DeliveryService.getInstance();

    const result = await service.deliverToTelegram(CHAT_ID, CONTENT);

    expect(result.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const [, , passedOptions] = mockSendMessage.mock.calls[0];
    expect(passedOptions.reply_markup).toBeUndefined();
  });
});
