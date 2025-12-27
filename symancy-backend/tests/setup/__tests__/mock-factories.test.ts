/**
 * Tests for Mock Factories
 *
 * Verifies that all factory functions produce valid mock objects
 * with correct structure, types, and default values.
 */
import { describe, it, expect } from 'vitest'
import {
  createMockSupabaseClient,
  createMockInsertChain,
  createMockSelectChain,
  createMockDeleteChain,
  createMockEmbeddingResult,
  createMockEmbeddingsResponse,
  createMockMemory,
  createMockMemoryDbRow,
  createMockSearchResult,
  createMockMemories,
  createMockLLMResponse,
  createMockExtractionResponse,
  createMockAPIError,
  createMockOpenAIClient,
  createMockChatHistory,
  createMockAnalysis,
  generateTestUUID,
  TEST_USER_IDS,
  MEMORY_CATEGORIES,
} from '../mock-factories.js'

describe('Mock Factories', () => {
  describe('Database Factories', () => {
    it('should create mock Supabase client', () => {
      const client = createMockSupabaseClient({
        insertData: { id: 'test' },
        selectData: [{ id: '1' }],
        rpcData: [{ result: 'test' }],
        error: null,
      })

      expect(client).toHaveProperty('from')
      expect(client).toHaveProperty('rpc')
      expect(typeof client.from).toBe('function')
      expect(typeof client.rpc).toBe('function')
    })

    it('should create mock insert chain', () => {
      const chain = createMockInsertChain({ id: 'test' }, null)

      expect(chain).toHaveProperty('insert')
      expect(chain).toHaveProperty('select')
      expect(chain).toHaveProperty('single')
    })

    it('should create mock select chain', () => {
      const chain = createMockSelectChain([{ id: 'test' }], null)

      expect(chain).toHaveProperty('select')
      expect(chain).toHaveProperty('eq')
      expect(chain).toHaveProperty('order')
    })

    it('should create mock delete chain', () => {
      const chain = createMockDeleteChain(null)

      expect(chain).toHaveProperty('delete')
      expect(chain).toHaveProperty('eq')
    })
  })

  describe('Embedding Factories', () => {
    it('should create mock embedding result with correct dimensions', () => {
      const embedding = createMockEmbeddingResult()

      expect(embedding).toBeInstanceOf(Array)
      expect(embedding).toHaveLength(1024)
      expect(embedding.every((val) => typeof val === 'number')).toBe(true)
    })

    it('should create deterministic embedding with seed', () => {
      const emb1 = createMockEmbeddingResult(1024, 42)
      const emb2 = createMockEmbeddingResult(1024, 42)

      expect(emb1).toEqual(emb2)
    })

    it('should create different embeddings without seed', () => {
      const emb1 = createMockEmbeddingResult()
      const emb2 = createMockEmbeddingResult()

      expect(emb1).not.toEqual(emb2)
    })

    it('should create mock embeddings response', () => {
      const embeddings = [
        createMockEmbeddingResult(),
        createMockEmbeddingResult(),
      ]
      const response = createMockEmbeddingsResponse(embeddings)

      expect(response).toHaveProperty('data')
      expect(response.data).toHaveLength(2)
      expect(response.data[0]).toHaveProperty('embedding')
      expect(response.data[0]).toHaveProperty('index', 0)
      expect(response.data[1]).toHaveProperty('index', 1)
    })
  })

  describe('Memory Factories', () => {
    it('should create mock memory with defaults', () => {
      const memory = createMockMemory()

      expect(memory).toHaveProperty('id')
      expect(memory).toHaveProperty('telegramUserId')
      expect(memory).toHaveProperty('content')
      expect(memory).toHaveProperty('category')
      expect(memory).toHaveProperty('embedding')
      expect(memory).toHaveProperty('createdAt')
      expect(memory).toHaveProperty('updatedAt')
      expect(memory).toHaveProperty('importance')
      expect(memory).toHaveProperty('sourceMessage')

      expect(memory.id).toMatch(/^test-uuid-/)
      expect(memory.telegramUserId).toBe(999999999)
      expect(memory.category).toBe('other')
      expect(memory.embedding).toHaveLength(1024)
      expect(memory.createdAt).toBeInstanceOf(Date)
      expect(memory.updatedAt).toBeInstanceOf(Date)
    })

    it('should create mock memory with overrides', () => {
      const memory = createMockMemory({
        content: 'Custom content',
        category: 'preferences',
        telegramUserId: 123456789,
      })

      expect(memory.content).toBe('Custom content')
      expect(memory.category).toBe('preferences')
      expect(memory.telegramUserId).toBe(123456789)
    })

    it('should create mock memory database row', () => {
      const dbRow = createMockMemoryDbRow({
        content: 'Test content',
        category: 'personal_info',
      })

      expect(dbRow).toHaveProperty('id')
      expect(dbRow).toHaveProperty('telegram_user_id')
      expect(dbRow).toHaveProperty('content', 'Test content')
      expect(dbRow).toHaveProperty('category', 'personal_info')
      expect(dbRow).toHaveProperty('embedding')
      expect(dbRow).toHaveProperty('source_message')
      expect(dbRow).toHaveProperty('created_at')
      expect(dbRow).toHaveProperty('updated_at')

      // Verify embedding is valid JSON
      const embedding = JSON.parse(dbRow.embedding)
      expect(embedding).toBeInstanceOf(Array)
      expect(embedding).toHaveLength(1024)
    })

    it('should create mock search result', () => {
      const result = createMockSearchResult({
        content: 'User loves coffee',
        score: 0.95,
      })

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('content', 'User loves coffee')
      expect(result).toHaveProperty('category')
      expect(result).toHaveProperty('score', 0.95)
    })

    it('should create multiple mock memories', () => {
      const memories = createMockMemories(5, { category: 'work' })

      expect(memories).toHaveLength(5)
      expect(memories.every((m) => m.category === 'work')).toBe(true)

      // Each memory should have unique content
      const contents = memories.map((m) => m.content)
      const uniqueContents = new Set(contents)
      expect(uniqueContents.size).toBe(5)
    })
  })

  describe('LLM Factories', () => {
    it('should create mock LLM response', () => {
      const response = createMockLLMResponse('Hello, world!', 50)

      expect(response).toHaveProperty('content', 'Hello, world!')
      expect(response).toHaveProperty('usage_metadata')
      expect(response.usage_metadata).toHaveProperty('total_tokens', 50)
    })

    it('should create mock extraction response', () => {
      const extraction = createMockExtractionResponse([
        { content: "User's name is Alice", category: 'personal_info' },
        { content: 'User loves coffee', category: 'preferences' },
      ])

      expect(extraction).toHaveProperty('content')

      const parsed = JSON.parse(extraction.content)
      expect(parsed).toHaveProperty('memories')
      expect(parsed).toHaveProperty('hasMemories', true)
      expect(parsed.memories).toHaveLength(2)
      expect(parsed.memories[0]).toEqual({
        content: "User's name is Alice",
        category: 'personal_info',
      })
    })

    it('should create empty extraction response', () => {
      const extraction = createMockExtractionResponse([])

      const parsed = JSON.parse(extraction.content)
      expect(parsed.hasMemories).toBe(false)
      expect(parsed.memories).toHaveLength(0)
    })
  })

  describe('API Factories', () => {
    it('should create mock API error', () => {
      const error = createMockAPIError(429, 'Rate limit exceeded')

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Rate limit exceeded')
      expect(error).toHaveProperty('status', 429)
      expect(error).toHaveProperty('name', 'APIError')
    })

    it('should create mock OpenAI client', () => {
      const client = createMockOpenAIClient()

      expect(client).toHaveProperty('embeddings')
      expect(client.embeddings).toHaveProperty('create')
      expect(typeof client.embeddings.create).toBe('function')
    })
  })

  describe('Utility Factories', () => {
    it('should create mock chat history', () => {
      const history = createMockChatHistory([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ])

      expect(history).toHaveLength(2)
      expect(history[0]).toHaveProperty('role', 'user')
      expect(history[0]).toHaveProperty('content', 'Hello')
      expect(history[0]).toHaveProperty('created_at')
      expect(history[1]).toHaveProperty('role', 'assistant')
      expect(history[1]).toHaveProperty('content', 'Hi!')
    })

    it('should create mock analysis', () => {
      const analysis = createMockAnalysis('You saw a spiral pattern')

      expect(analysis).toHaveProperty('interpretation', 'You saw a spiral pattern')
      expect(analysis).toHaveProperty('created_at')
    })
  })

  describe('Test Data Generators', () => {
    it('should provide test user IDs', () => {
      expect(TEST_USER_IDS.PRIMARY).toBe(999999999)
      expect(TEST_USER_IDS.SECONDARY).toBe(999999998)
      expect(TEST_USER_IDS.TERTIARY).toBe(999999997)
    })

    it('should provide memory categories', () => {
      expect(MEMORY_CATEGORIES).toEqual([
        'personal_info',
        'health',
        'preferences',
        'events',
        'interests',
        'work',
        'other',
      ])
    })

    it('should generate test UUIDs', () => {
      const uuid1 = generateTestUUID()
      const uuid2 = generateTestUUID()

      expect(uuid1).toMatch(/^test-uuid-/)
      expect(uuid2).toMatch(/^test-uuid-/)
      expect(uuid1).not.toBe(uuid2)
    })
  })

  describe('Factory Integration', () => {
    it('should combine factories for complex scenarios', () => {
      // Create embedding
      const embedding = createMockEmbeddingResult(1024, 42)

      // Create memory with embedding
      const memory = createMockMemory({
        content: 'User loves coffee',
        category: 'preferences',
        embedding,
      })

      // Create database row
      const dbRow = createMockMemoryDbRow({
        content: memory.content,
        category: memory.category,
        embedding: JSON.stringify(embedding),
      })

      // Create Supabase client with this data
      const supabase = createMockSupabaseClient({
        insertData: dbRow,
        selectData: [dbRow],
      })

      expect(supabase).toBeDefined()
      expect(memory.content).toBe('User loves coffee')
      expect(dbRow.content).toBe('User loves coffee')
      expect(JSON.parse(dbRow.embedding)).toEqual(embedding)
    })
  })
})
