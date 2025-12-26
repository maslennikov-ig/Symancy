/**
 * Integration tests for chat handler
 *
 * Test cases:
 * - TC-US2-001: Basic Chat Message
 * - TC-US2-004: Daily Chat Limit
 * - TC-US2-005: Empty or Very Short Message
 * - TC-US2-006: Very Long Message
 * - Command Handling
 * - Text Sanitization
 * - Credit Check
 * - Maintenance Mode
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { handleTextMessage } from '@/modules/chat/handler.js'
import type { BotContext } from '@/types/telegram.js'

// =============================================================================
// Mock Setup
// =============================================================================

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
}

vi.mock('@/core/database.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}))

vi.mock('@/core/queue.js', () => ({
  sendJob: vi.fn(() => Promise.resolve('test-job-id-123')),
}))

vi.mock('@/modules/config/service.js', () => ({
  isMaintenanceMode: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('@/modules/credits/service.js', () => ({
  hasCredits: vi.fn(() => Promise.resolve(true)),
}))

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create mock context for text messages
 */
function createTextContext(text: string, overrides = {}): BotContext {
  return {
    from: { id: 123456789, language_code: 'ru' },
    chat: { id: 123456789 },
    message: { message_id: 1, text },
    reply: vi.fn(() => Promise.resolve({ message_id: 2 })),
    replyWithChatAction: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  } as unknown as BotContext
}

/**
 * Mock daily limit check - not reached
 */
function mockDailyLimitNotReached(count = 10) {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_messages_count: count,
            last_message_date: new Date().toISOString().split('T')[0],
          },
          error: null,
        }),
      }),
    }),
  })
}

/**
 * Mock daily limit check - reached
 */
function mockDailyLimitReached() {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_messages_count: 50,
            last_message_date: new Date().toISOString().split('T')[0],
          },
          error: null,
        }),
      }),
    }),
  })
}

/**
 * Mock daily limit check - new day (reset count)
 */
function mockDailyLimitNewDay() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_messages_count: 50,
            last_message_date: yesterday.toISOString().split('T')[0],
          },
          error: null,
        }),
      }),
    }),
  })
}

/**
 * Mock daily limit check - no user state (new user)
 */
function mockDailyLimitNewUser() {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    }),
  })
}

/**
 * Mock daily limit check - database error (fail open)
 */
function mockDailyLimitDatabaseError() {
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    }),
  })
}

// =============================================================================
// Tests
// =============================================================================

describe('handleTextMessage - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // TC-US2-001: Basic Chat Message
  // ===========================================================================

  describe('TC-US2-001: Basic Chat Message', () => {
    it('should send typing action for valid message', async () => {
      mockDailyLimitNotReached()
      const ctx = createTextContext('Что означает эта чашка?')

      await handleTextMessage(ctx)

      expect(ctx.replyWithChatAction).toHaveBeenCalledWith('typing')
    })

    it('should queue chat job with correct data', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Что означает эта чашка?')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({
          telegramUserId: 123456789,
          chatId: 123456789,
          messageId: 1,
          text: 'Что означает эта чашка?',
        })
      )
    })

    it('should pass sanitized text to job (removes control chars)', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const textWithControlChars = 'Hello\u0000\u0001\u001F world\u007F\u009F'
      const ctx = createTextContext(textWithControlChars)

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({
          text: 'Hello world', // Control chars removed
        })
      )
    })
  })

  // ===========================================================================
  // TC-US2-004: Daily Chat Limit
  // ===========================================================================

  describe('TC-US2-004: Daily Chat Limit', () => {
    it('should allow messages below limit', async () => {
      mockDailyLimitNotReached(10)
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalledWith(
        expect.stringContaining('лимита сообщений')
      )
    })

    it('should block messages at limit (50)', async () => {
      mockDailyLimitReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Вы достигли лимита сообщений на сегодня (50 сообщений)')
      )
    })

    it('should send limit reached message', async () => {
      mockDailyLimitReached()
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Лимит обновится завтра')
      )
    })

    it('should reset limit on new day', async () => {
      mockDailyLimitNewDay()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalledWith(
        expect.stringContaining('лимита сообщений')
      )
    })

    it('should allow new users (no state record)', async () => {
      mockDailyLimitNewUser()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalled()
    })

    it('should fail open on database error', async () => {
      mockDailyLimitDatabaseError()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      // Should allow message on error
      expect(sendJob).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // TC-US2-005: Empty or Very Short Message
  // ===========================================================================

  describe('TC-US2-005: Empty or Very Short Message', () => {
    it('should handle message "."', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('.')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: '.' })
      )
    })

    it('should handle message "ok"', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('ok')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: 'ok' })
      )
    })

    it('should return early for empty messages after sanitization', async () => {
      const { sendJob } = await import('@/core/queue.js')
      // Message contains only control characters
      const ctx = createTextContext('\u0000\u0001\u001F')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalled()
    })

    it('should return early for whitespace-only messages after sanitization', async () => {
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('   \t\n   ')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // TC-US2-006: Very Long Message
  // ===========================================================================

  describe('TC-US2-006: Very Long Message', () => {
    it('should reject messages over 4000 chars', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const longText = 'a'.repeat(4001)
      const ctx = createTextContext(longText)

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Сообщение слишком длинное')
      )
    })

    it('should send length error message with limit', async () => {
      mockDailyLimitNotReached()
      const longText = 'a'.repeat(4001)
      const ctx = createTextContext(longText)

      await handleTextMessage(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Максимум 4000 символов')
      )
    })

    it('should allow messages exactly at limit (4000 chars)', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const maxText = 'a'.repeat(4000)
      const ctx = createTextContext(maxText)

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalledWith(
        expect.stringContaining('слишком длинное')
      )
    })
  })

  // ===========================================================================
  // Command Handling
  // ===========================================================================

  describe('Command Handling', () => {
    it('should skip messages starting with "/"', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('/start')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalled()
    })

    it('should skip /help command', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('/help')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })

    it('should skip /settings command', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('/settings')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Text Sanitization
  // ===========================================================================

  describe('Text Sanitization', () => {
    it('should remove null bytes', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello\u0000World')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: 'HelloWorld' })
      )
    })

    it('should remove control characters (0x00-0x1F)', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Test\u0001\u0002\u001FMessage')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: 'TestMessage' })
      )
    })

    it('should remove control characters (0x7F-0x9F)', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Test\u007F\u009FMessage')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: 'TestMessage' })
      )
    })

    it('should preserve valid unicode characters', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Привет мир! 🎨 Hello 你好')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalledWith(
        'chat-reply',
        expect.objectContaining({ text: 'Привет мир! 🎨 Hello 你好' })
      )
    })
  })

  // ===========================================================================
  // Credit Check
  // ===========================================================================

  describe('Credit Check', () => {
    it('should check hasCredits before queuing', async () => {
      mockDailyLimitNotReached()
      const { hasCredits } = await import('@/modules/credits/service.js')
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(hasCredits).mockResolvedValue(true)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(hasCredits).toHaveBeenCalledWith(123456789, 1)
      expect(sendJob).toHaveBeenCalled()
    })

    it('should send insufficient credits message when needed', async () => {
      mockDailyLimitNotReached()
      const { hasCredits } = await import('@/modules/credits/service.js')
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(hasCredits).mockResolvedValue(false)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('У вас недостаточно кредитов для чата')
      )
    })

    it('should mention balance top-up in credit error', async () => {
      mockDailyLimitNotReached()
      const { hasCredits } = await import('@/modules/credits/service.js')

      vi.mocked(hasCredits).mockResolvedValue(false)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('пополните баланс')
      )
    })
  })

  // ===========================================================================
  // Maintenance Mode
  // ===========================================================================

  describe('Maintenance Mode', () => {
    it('should block during maintenance', async () => {
      mockDailyLimitNotReached()
      const { isMaintenanceMode } = await import('@/modules/config/service.js')
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(isMaintenanceMode).mockResolvedValue(true)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Бот находится на обслуживании')
      )
    })

    it('should allow messages when not in maintenance', async () => {
      mockDailyLimitNotReached()
      const { isMaintenanceMode } = await import('@/modules/config/service.js')
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(isMaintenanceMode).mockResolvedValue(false)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(sendJob).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Invalid Context Handling
  // ===========================================================================

  describe('Invalid Context Handling', () => {
    it('should handle missing message gracefully', async () => {
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello', { message: undefined })

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
      expect(ctx.reply).not.toHaveBeenCalled()
    })

    it('should handle missing message.text gracefully', async () => {
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello', { message: { message_id: 1 } })

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })

    it('should handle missing from gracefully', async () => {
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello', { from: undefined })

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })

    it('should handle missing chat gracefully', async () => {
      const { sendJob } = await import('@/core/queue.js')
      const ctx = createTextContext('Hello', { chat: undefined })

      await handleTextMessage(ctx)

      expect(sendJob).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Job Queue Error Handling
  // ===========================================================================

  describe('Job Queue Error Handling', () => {
    it('should handle queue failure gracefully', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(sendJob).mockResolvedValue(null)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Не удалось обработать запрос')
      )
    })

    it('should suggest retry on queue failure', async () => {
      mockDailyLimitNotReached()
      const { sendJob } = await import('@/core/queue.js')

      vi.mocked(sendJob).mockResolvedValue(null)

      const ctx = createTextContext('Hello')

      await handleTextMessage(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Попробуйте ещё раз')
      )
    })
  })
})
