import { vi } from 'vitest'

export function createMockTelegramContext(overrides = {}) {
  return {
    from: {
      id: 123456789,
      language_code: 'ru',
      username: 'testuser',
      first_name: 'Test',
    },
    chat: { id: 123456789 },
    message: {
      message_id: 1,
      photo: [{ file_id: 'test-file-id', file_size: 50000 }],
      caption: undefined,
      text: undefined,
    },
    profile: { name: 'Test User', credits: 10 },
    reply: vi.fn(() => Promise.resolve({ message_id: 2 })),
    replyWithChatAction: vi.fn(() => Promise.resolve(true)),
    api: {
      editMessageText: vi.fn(() => Promise.resolve(true)),
      getFile: vi.fn(() => Promise.resolve({ file_path: 'photos/test.jpg' })),
    },
    ...overrides,
  }
}

export const mockTelegramContext = createMockTelegramContext()
