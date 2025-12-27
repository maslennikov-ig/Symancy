import { vi } from 'vitest'
import type { MemoryCategory, UserMemory, MemorySearchResult } from '@/services/memory.service.js'

/**
 * Mock Factories for Test Standardization
 *
 * This file provides factory functions for creating consistent mock objects
 * across all test files. Using factories ensures:
 * - Consistent mocking patterns
 * - Easier maintenance (change once, update everywhere)
 * - Reduced duplication
 * - Type-safe mocks
 *
 * Usage:
 * ```typescript
 * import { createMockSupabaseClient, createMockMemory } from '../setup/mock-factories.js'
 *
 * const supabase = createMockSupabaseClient({
 *   selectData: [mockMemory],
 * })
 * ```
 */

// =============================================================================
// Database Mock Factories
// =============================================================================

/**
 * Create a mock Supabase client with chainable methods
 *
 * @param options - Configuration for mock responses
 * @returns Mock Supabase client
 *
 * @example
 * ```typescript
 * const supabase = createMockSupabaseClient({
 *   selectData: [{ id: '1', content: 'Memory' }],
 *   error: null,
 * })
 * ```
 */
export function createMockSupabaseClient(options: {
  insertData?: any
  selectData?: any[]
  rpcData?: any
  error?: any
} = {}) {
  const { insertData = null, selectData = [], rpcData = null, error = null } = options

  return {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: insertData, error }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error }),
  }
}

/**
 * Create a mock Supabase insert chain
 *
 * @param data - Data to return from insert
 * @param error - Error to return (null for success)
 * @returns Mock insert chain
 *
 * @example
 * ```typescript
 * const insertChain = createMockInsertChain(mockMemory, null)
 * mockSupabaseClient.from.mockReturnValue(insertChain)
 * ```
 */
export function createMockInsertChain(data: any = null, error: any = null) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}

/**
 * Create a mock Supabase select chain
 *
 * @param data - Array of data to return from select
 * @param error - Error to return (null for success)
 * @returns Mock select chain
 *
 * @example
 * ```typescript
 * const selectChain = createMockSelectChain([mockMemory1, mockMemory2], null)
 * mockSupabaseClient.from.mockReturnValue(selectChain)
 * ```
 */
export function createMockSelectChain(data: any[] = [], error: any = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
}

/**
 * Create a mock Supabase delete chain
 *
 * @param error - Error to return (null for success)
 * @returns Mock delete chain
 *
 * @example
 * ```typescript
 * const deleteChain = createMockDeleteChain(null)
 * mockSupabaseClient.from.mockReturnValue(deleteChain)
 * ```
 */
export function createMockDeleteChain(error: any = null) {
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error }),
  }
}

// =============================================================================
// Embedding Mock Factories
// =============================================================================

/**
 * Create a mock embedding result (1024-dimensional vector)
 *
 * @param dims - Embedding dimensions (default: 1024 for BGE-M3)
 * @param seed - Optional seed for deterministic embeddings
 * @returns Mock embedding vector
 *
 * @example
 * ```typescript
 * const embedding = createMockEmbeddingResult()
 * expect(embedding).toHaveLength(1024)
 * ```
 */
export function createMockEmbeddingResult(dims = 1024, seed?: number): number[] {
  if (seed !== undefined) {
    // Deterministic embedding based on seed
    return Array.from({ length: dims }, (_, i) => Math.sin(seed + i * 0.1) * 0.5)
  }
  // Random embedding
  return Array.from({ length: dims }, () => Math.random() * 2 - 1)
}

/**
 * Create a mock embeddings API response
 *
 * @param embeddings - Array of embedding vectors
 * @returns Mock OpenAI embeddings API response
 *
 * @example
 * ```typescript
 * const response = createMockEmbeddingsResponse([
 *   createMockEmbeddingResult(),
 *   createMockEmbeddingResult(),
 * ])
 * ```
 */
export function createMockEmbeddingsResponse(embeddings: number[][]) {
  return {
    data: embeddings.map((embedding, index) => ({
      embedding,
      index,
    })),
  }
}

// =============================================================================
// Memory Mock Factories
// =============================================================================

/**
 * Create a mock UserMemory object
 *
 * @param overrides - Fields to override in the mock memory
 * @returns Mock UserMemory
 *
 * @example
 * ```typescript
 * const memory = createMockMemory({
 *   content: "User's name is Alice",
 *   category: "personal_info",
 * })
 * ```
 */
export function createMockMemory(overrides: Partial<UserMemory> = {}): UserMemory {
  const randomId = Math.random().toString(36).slice(2, 11)

  return {
    id: `test-uuid-${randomId}`,
    telegramUserId: 999999999,
    content: 'Test memory content',
    category: 'other',
    embedding: createMockEmbeddingResult(),
    createdAt: new Date(),
    importance: 0.5,
    sourceMessage: null,
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a mock database row for UserMemory (snake_case fields)
 *
 * @param overrides - Fields to override
 * @returns Mock database row
 *
 * @example
 * ```typescript
 * const dbRow = createMockMemoryDbRow({
 *   content: "User likes coffee",
 *   category: "preferences",
 * })
 * ```
 */
export function createMockMemoryDbRow(overrides: Partial<{
  id: string
  telegram_user_id: number
  content: string
  category: string
  embedding: string
  source_message: string | null
  created_at: string
  updated_at: string
}> = {}) {
  const randomId = Math.random().toString(36).slice(2, 11)

  return {
    id: `test-uuid-${randomId}`,
    telegram_user_id: 999999999,
    content: 'Test memory content',
    category: 'other',
    embedding: JSON.stringify(createMockEmbeddingResult()),
    source_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock MemorySearchResult
 *
 * @param overrides - Fields to override
 * @returns Mock search result
 *
 * @example
 * ```typescript
 * const result = createMockSearchResult({
 *   content: "User loves coffee",
 *   score: 0.95,
 * })
 * ```
 */
export function createMockSearchResult(overrides: Partial<MemorySearchResult> = {}): MemorySearchResult {
  const randomId = Math.random().toString(36).slice(2, 11)

  return {
    id: `test-uuid-${randomId}`,
    content: 'Test memory content',
    category: 'other',
    score: 0.9,
    ...overrides,
  }
}

/**
 * Create multiple mock memories
 *
 * @param count - Number of memories to create
 * @param baseOverrides - Base overrides applied to all memories
 * @returns Array of mock memories
 *
 * @example
 * ```typescript
 * const memories = createMockMemories(5, { category: 'preferences' })
 * expect(memories).toHaveLength(5)
 * ```
 */
export function createMockMemories(
  count: number,
  baseOverrides: Partial<UserMemory> = {}
): UserMemory[] {
  return Array.from({ length: count }, (_, i) =>
    createMockMemory({
      ...baseOverrides,
      content: `${baseOverrides.content || 'Memory'} ${i + 1}`,
    })
  )
}

// =============================================================================
// LLM Mock Factories
// =============================================================================

/**
 * Create a mock LLM response
 *
 * @param content - Response content
 * @param tokens - Token usage (default: 100)
 * @returns Mock LLM response
 *
 * @example
 * ```typescript
 * const response = createMockLLMResponse('Hello, world!', 50)
 * mockInvoke.mockResolvedValue(response)
 * ```
 */
export function createMockLLMResponse(content: string, tokens = 100) {
  return {
    content,
    usage_metadata: {
      total_tokens: tokens,
    },
  }
}

/**
 * Create a mock memory extraction response
 *
 * @param memories - Array of extracted memories
 * @returns Mock extraction result
 *
 * @example
 * ```typescript
 * const extraction = createMockExtractionResponse([
 *   { content: "User's name is Alice", category: "personal_info" },
 * ])
 * ```
 */
export function createMockExtractionResponse(
  memories: Array<{ content: string; category: MemoryCategory }>
) {
  return {
    content: JSON.stringify({
      memories,
      hasMemories: memories.length > 0,
    }),
  }
}

// =============================================================================
// OpenAI API Mock Factories
// =============================================================================

/**
 * Create a mock OpenAI API error
 *
 * @param status - HTTP status code
 * @param message - Error message
 * @returns Mock API error
 *
 * @example
 * ```typescript
 * const error = createMockAPIError(429, 'Rate limit exceeded')
 * mockCreate.mockRejectedValue(error)
 * ```
 */
export function createMockAPIError(status: number, message: string) {
  class MockAPIError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  }

  return new MockAPIError(status, message)
}

/**
 * Create a mock OpenAI client
 *
 * @returns Mock OpenAI client with embeddings.create method
 *
 * @example
 * ```typescript
 * const mockCreate = vi.fn()
 * const client = createMockOpenAIClient(mockCreate)
 * ```
 */
export function createMockOpenAIClient(mockCreate = vi.fn()) {
  return {
    embeddings: {
      create: mockCreate,
    },
  }
}

// =============================================================================
// Utility Mock Factories
// =============================================================================

/**
 * Create a mock chat history
 *
 * @param messages - Array of message objects
 * @returns Array of chat history entries
 *
 * @example
 * ```typescript
 * const history = createMockChatHistory([
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi!' },
 * ])
 * ```
 */
export function createMockChatHistory(
  messages: Array<{ role: string; content: string }>
) {
  return messages.map((msg) => ({
    ...msg,
    created_at: new Date().toISOString(),
  }))
}

/**
 * Create a mock analysis result
 *
 * @param interpretation - Analysis interpretation text
 * @returns Mock analysis object
 *
 * @example
 * ```typescript
 * const analysis = createMockAnalysis('You saw a spiral pattern')
 * ```
 */
export function createMockAnalysis(interpretation: string) {
  return {
    interpretation,
    created_at: new Date().toISOString(),
  }
}

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate test user IDs
 * Uses high numbers to avoid conflicts with real data
 */
export const TEST_USER_IDS = {
  PRIMARY: 999999999,
  SECONDARY: 999999998,
  TERTIARY: 999999997,
} as const

/**
 * Generate memory categories for testing
 */
export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'personal_info',
  'health',
  'preferences',
  'events',
  'interests',
  'work',
  'other',
] as const

/**
 * Generate a random UUID for testing
 *
 * @returns Mock UUID
 *
 * @example
 * ```typescript
 * const id = generateTestUUID()
 * // Returns: "test-uuid-a1b2c3d4e5"
 * ```
 */
export function generateTestUUID(): string {
  return `test-uuid-${Math.random().toString(36).slice(2, 11)}`
}
