import { vi } from 'vitest'

/**
 * Test user IDs (use high numbers to avoid conflicts with real data)
 * Use these consistently across tests for isolation
 */
export const TEST_USER_ID = 999999999
export const TEST_USER_ID_2 = 999999998
export const TEST_USER_ID_3 = 999999997

/**
 * Test memory IDs (UUIDs for consistency)
 */
export const TEST_MEMORY_ID_1 = '00000000-0000-0000-0000-000000000001'
export const TEST_MEMORY_ID_2 = '00000000-0000-0000-0000-000000000002'
export const TEST_MEMORY_ID_3 = '00000000-0000-0000-0000-000000000003'

/**
 * Create test profile in mock Supabase
 * For unit tests, this is a no-op (mocked)
 * For integration tests, this inserts real data
 */
export async function createTestProfile(telegramUserId: number): Promise<void> {
  // No-op in unit tests (mocked Supabase)
  // Integration tests should override this
}

/**
 * Delete all memories for user (cleanup)
 * For unit tests, this is a no-op (mocked)
 * For integration tests, this deletes real data
 */
export async function deleteAllMemoriesForUser(telegramUserId: number): Promise<void> {
  // No-op in unit tests (mocked Supabase)
  // Integration tests should override this
}

/**
 * Full cleanup after tests
 * Deletes all test data for the given user
 */
export async function cleanupTestData(telegramUserId: number): Promise<void> {
  await deleteAllMemoriesForUser(telegramUserId)
}

/**
 * Cosine similarity for embedding comparison
 * Used to test semantic similarity between embeddings
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Generate deterministic mock embedding based on text hash
 * Same text will always produce the same embedding
 * Useful for testing similarity and consistency
 *
 * @param text - Input text to generate embedding from
 * @returns 1024-dimensional embedding vector
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return Array(1024).fill(0).map((_, i) => Math.sin(hash + i) * 0.5)
}

/**
 * Normalize an embedding vector to unit length
 * Useful for consistent similarity comparisons
 *
 * @param embedding - Embedding vector to normalize
 * @returns Normalized embedding vector
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (norm === 0) return embedding
  return embedding.map(val => val / norm)
}

/**
 * Calculate L2 (Euclidean) distance between two embeddings
 * Lower is more similar (0 = identical)
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns L2 distance
 */
export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Mock Supabase search result for testing
 * Creates a realistic search result object
 */
export function createMockSearchResult(
  id: string,
  content: string,
  category: string,
  similarity: number
) {
  return {
    id,
    content,
    category,
    similarity,
  }
}

/**
 * Mock user memory for testing
 * Creates a realistic user memory object
 */
export function createMockUserMemory(
  id: string,
  telegramUserId: number,
  content: string,
  category: string,
  sourceMessage?: string
) {
  return {
    id,
    telegram_user_id: telegramUserId,
    content,
    category,
    source_message: sourceMessage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
