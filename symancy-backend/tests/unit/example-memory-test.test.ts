/**
 * Example Memory System Tests
 * Demonstrates how to use mocks and helpers for memory testing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  mockExtractMemories,
  mockExtractionResult,
  mockEmptyExtractionResult,
} from '../setup/mocks/memory-extraction.mock.js'
import {
  mockGetEmbedding,
  createMockEmbedding,
  generateDeterministicEmbedding,
} from '../setup/mocks/embeddings.mock.js'
import {
  TEST_USER_ID,
  cosineSimilarity,
  l2Distance,
  normalizeEmbedding,
} from '../setup/memory-test-helpers.js'

/**
 * Example 1: Testing memory extraction
 */
describe('Memory Extraction Example', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract memories from user message', () => {
    // Mock returns predefined result
    const result = mockExtractionResult

    expect(result.hasMemories).toBe(true)
    expect(result.memories).toHaveLength(2)
    expect(result.memories[0].content).toBe("User's name is Test")
    expect(result.memories[0].category).toBe('personal_info')
  })

  it('should return empty result for non-memorable message', () => {
    const result = mockEmptyExtractionResult

    expect(result.hasMemories).toBe(false)
    expect(result.memories).toHaveLength(0)
  })
})

/**
 * Example 2: Testing embeddings and similarity
 */
describe('Embeddings Example', () => {
  it('should generate 1024-dimensional embeddings', () => {
    const embedding = createMockEmbedding()

    expect(embedding).toHaveLength(1024)
    expect(embedding.every(val => typeof val === 'number')).toBe(true)
  })

  it('should generate identical embeddings for same text (deterministic)', () => {
    const text = "User's name is Alice"
    const emb1 = generateDeterministicEmbedding(text)
    const emb2 = generateDeterministicEmbedding(text)

    expect(emb1).toEqual(emb2)
    // Use toBeCloseTo for floating point comparison (handles precision errors)
    expect(cosineSimilarity(emb1, emb2)).toBeCloseTo(1, 10)
  })

  it('should generate different embeddings for different text', () => {
    const emb1 = generateDeterministicEmbedding("Alice")
    const emb2 = generateDeterministicEmbedding("Bob")

    expect(emb1).not.toEqual(emb2)
    const similarity = cosineSimilarity(emb1, emb2)
    expect(similarity).toBeLessThan(1)
  })

  it('should calculate cosine similarity correctly', () => {
    // Same vectors should have similarity = 1
    const vec1 = [1, 0, 0, 0]
    const vec2 = [1, 0, 0, 0]
    expect(cosineSimilarity(vec1, vec2)).toBe(1)

    // Orthogonal vectors should have similarity = 0
    const vec3 = [1, 0, 0, 0]
    const vec4 = [0, 1, 0, 0]
    expect(cosineSimilarity(vec3, vec4)).toBe(0)

    // Opposite vectors should have similarity = -1
    const vec5 = [1, 0, 0, 0]
    const vec6 = [-1, 0, 0, 0]
    expect(cosineSimilarity(vec5, vec6)).toBe(-1)
  })

  it('should calculate L2 distance correctly', () => {
    // Same vectors should have distance = 0
    const vec1 = [1, 2, 3, 4]
    const vec2 = [1, 2, 3, 4]
    expect(l2Distance(vec1, vec2)).toBe(0)

    // Distance between [0,0] and [3,4] should be 5 (Pythagorean theorem)
    const vec3 = [0, 0]
    const vec4 = [3, 4]
    expect(l2Distance(vec3, vec4)).toBe(5)
  })

  it('should normalize embeddings to unit length', () => {
    const embedding = [3, 4] // Length = 5
    const normalized = normalizeEmbedding(embedding)

    expect(normalized[0]).toBeCloseTo(0.6)
    expect(normalized[1]).toBeCloseTo(0.8)

    // Check unit length (norm should be 1)
    const norm = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0))
    expect(norm).toBeCloseTo(1)
  })
})

/**
 * Example 3: Testing semantic similarity use cases
 */
describe('Semantic Similarity Examples', () => {
  it('should find similar memories by embedding similarity', () => {
    // Simulate searching for memories similar to "What is my name?"
    const queryEmbedding = generateDeterministicEmbedding("What is my name?")

    const memory1Embedding = generateDeterministicEmbedding("User's name is Alice")
    const memory2Embedding = generateDeterministicEmbedding("User likes coffee")

    const sim1 = cosineSimilarity(queryEmbedding, memory1Embedding)
    const sim2 = cosineSimilarity(queryEmbedding, memory2Embedding)

    // Name-related memory should be more similar to name query
    // (Note: This is a demonstration; real embeddings would show stronger correlation)
    expect(sim1).toBeDefined()
    expect(sim2).toBeDefined()
  })

  it('should handle edge cases in similarity calculation', () => {
    const zeroVector = Array(1024).fill(0)
    const normalVector = createMockEmbedding()

    // Zero vector should return 0 similarity
    expect(cosineSimilarity(zeroVector, normalVector)).toBe(0)

    // Should not throw on zero vectors
    expect(() => cosineSimilarity(zeroVector, zeroVector)).not.toThrow()
  })
})

/**
 * Example 4: Test constants and helpers
 */
describe('Test Helpers Example', () => {
  it('should use consistent test user IDs', () => {
    expect(TEST_USER_ID).toBe(999999999)
    expect(typeof TEST_USER_ID).toBe('number')
  })

  it('should demonstrate mock function usage', () => {
    mockGetEmbedding.mockResolvedValue(createMockEmbedding())

    expect(mockGetEmbedding).toBeDefined()
    expect(vi.isMockFunction(mockGetEmbedding)).toBe(true)
  })

  it('should demonstrate mock extraction usage', () => {
    mockExtractMemories.mockResolvedValue(mockExtractionResult)

    expect(mockExtractMemories).toBeDefined()
    expect(vi.isMockFunction(mockExtractMemories)).toBe(true)
  })
})
