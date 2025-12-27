import { vi } from 'vitest'

/**
 * Mock 1024-dimension embedding (BGE-M3 dimensions)
 * Creates a normalized random vector
 */
export function createMockEmbedding(): number[] {
  return Array(1024).fill(0).map(() => Math.random() * 2 - 1)
}

/**
 * Generate deterministic mock embedding based on text hash
 * Useful for testing similarity between same/different texts
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return Array(1024).fill(0).map((_, i) => Math.sin(hash + i) * 0.5)
}

/**
 * Mock for getEmbedding function
 * Returns random embedding by default, can be customized
 */
export const mockGetEmbedding = vi.fn(() => Promise.resolve(createMockEmbedding()))

/**
 * Mock for getEmbeddings (batch) function
 * Returns array of random embeddings matching input length
 */
export const mockGetEmbeddings = vi.fn((texts: string[]) =>
  Promise.resolve(texts.map(() => createMockEmbedding()))
)

/**
 * Mock the embeddings module
 * Call this in beforeEach to mock the embeddings client
 */
export function mockEmbeddingsModule() {
  vi.mock('@/core/embeddings/index.js', () => ({
    getEmbedding: mockGetEmbedding,
    getEmbeddings: mockGetEmbeddings,
    EMBEDDING_MODEL: 'baai/bge-m3',
    EMBEDDING_DIMS: 1024,
  }))
}

/**
 * Mock the BGE client module directly
 * Use this for testing lower-level embedding functionality
 */
export function mockBGEClientModule() {
  vi.mock('@/core/embeddings/bge-client.js', () => ({
    getEmbedding: mockGetEmbedding,
    getEmbeddings: mockGetEmbeddings,
    EMBEDDING_MODEL: 'baai/bge-m3',
    EMBEDDING_DIMS: 1024,
  }))
}
