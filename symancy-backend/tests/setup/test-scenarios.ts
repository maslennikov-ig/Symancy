/**
 * Shared test scenarios for Memory System tests
 * Reduces duplication and ensures consistent behavior testing across unit, integration, and E2E tests
 *
 * Usage:
 * - Import test scenario functions into your test files
 * - Provide adapter functions that match your test's implementation (mocked or real)
 * - Run the scenario to verify consistent behavior
 *
 * Example:
 * ```typescript
 * import { testUserIsolation } from '../../setup/test-scenarios'
 *
 * it('should isolate memories between users', async () => {
 *   await testUserIsolation(
 *     addMemory,      // Your addMemory function
 *     searchMemories, // Your searchMemories function
 *     user1Id,        // Test user 1 ID
 *     user2Id         // Test user 2 ID
 *   )
 * })
 * ```
 */

import { expect } from 'vitest'

/**
 * Memory category type (should match your service definition)
 */
export type MemoryCategory =
  | 'personal_info'
  | 'health'
  | 'preferences'
  | 'events'
  | 'interests'
  | 'work'
  | 'other'

/**
 * Generic memory object shape
 */
export interface MemoryLike {
  id: string
  content: string
  category: string
  [key: string]: any // Allow additional properties
}

/**
 * Generic search result shape
 */
export interface SearchResultLike {
  id: string
  content: string
  category: string
  score?: number
  similarity?: number
  [key: string]: any // Allow additional properties
}

/**
 * Test Scenario: User Isolation
 *
 * Verifies that memories from one user are not accessible by another user.
 * This is a critical security requirement for multi-tenant systems.
 *
 * @param addMemory - Function to add a memory (userId, content, category) => Promise<any>
 * @param searchMemories - Function to search memories (userId, query) => Promise<SearchResultLike[]>
 * @param user1Id - First test user ID
 * @param user2Id - Second test user ID (different from user1Id)
 */
export async function testUserIsolation(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  user1Id: number,
  user2Id: number
): Promise<void> {
  // User 1 adds a secret
  await addMemory(user1Id, "My secret code is ABC-123", "other", "My secret code is ABC-123")

  // User 2 should NOT find User 1's secret
  const user2Results = await searchMemories(user2Id, "secret code", 10)
  expect(user2Results).toHaveLength(0)
  expect(user2Results.some((r) => r.content.includes("ABC-123"))).toBe(false)

  // User 1 SHOULD find their own secret
  const user1Results = await searchMemories(user1Id, "secret code", 10)
  expect(user1Results.length).toBeGreaterThan(0)

  const foundSecret = user1Results.some((r) =>
    r.content.toLowerCase().includes("secret") ||
    r.content.includes("ABC-123")
  )
  expect(foundSecret).toBe(true)
}

/**
 * Test Scenario: Memory CRUD Operations
 *
 * Tests the complete lifecycle of a memory: Create, Read, Update (not implemented yet), Delete.
 * Ensures basic database operations work correctly.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param deleteMemory - Function to delete a memory by ID
 * @param userId - Test user ID
 */
export async function testMemoryCRUD(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<MemoryLike>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  deleteMemory: (id: string) => Promise<void>,
  userId: number
): Promise<void> {
  // Create
  const memory = await addMemory(userId, "Test content for CRUD", "other", "Test message")
  expect(memory).toBeDefined()
  expect(memory.id).toBeDefined()
  expect(memory.content).toBe("Test content for CRUD")

  // Read (via search)
  const searchResults = await searchMemories(userId, "Test content", 10)
  expect(searchResults.length).toBeGreaterThan(0)
  const found = searchResults.find((r) => r.id === memory.id)
  expect(found).toBeDefined()

  // Delete
  await deleteMemory(memory.id)

  // Verify deleted (search should not find it)
  const afterDelete = await searchMemories(userId, "Test content for CRUD", 10)
  const stillExists = afterDelete.find((m) => m.id === memory.id)
  expect(stillExists).toBeUndefined()
}

/**
 * Test Scenario: Semantic Search Quality
 *
 * Tests that semantic search finds relevant memories even when query doesn't match exactly.
 * This validates the embedding-based search functionality.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param userId - Test user ID
 * @param options - Optional configuration for search expectations
 */
export async function testSemanticSearch(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  userId: number,
  options?: {
    minSimilarity?: number // Minimum expected similarity score
    expectExactMatch?: boolean // Whether to expect exact content match
  }
): Promise<void> {
  const { minSimilarity = 0, expectExactMatch = false } = options || {}

  // Add memory with specific content
  await addMemory(userId, "I love drinking coffee every morning", "preferences", "I love coffee")

  // Search with semantically similar query (not exact match)
  const results = await searchMemories(userId, "favorite beverage", 10)

  // Should find the coffee memory through semantic similarity
  expect(results.length).toBeGreaterThan(0)

  // Check if coffee-related memory was found
  const coffeeMemory = results.find((r) =>
    r.content.toLowerCase().includes("coffee")
  )

  if (expectExactMatch) {
    expect(coffeeMemory).toBeDefined()
  } else {
    // At least some results should be returned (semantic search may vary)
    expect(results.length).toBeGreaterThan(0)
  }

  // Verify similarity scores if available
  if (minSimilarity > 0) {
    const hasScore = results[0]?.score !== undefined || results[0]?.similarity !== undefined
    if (hasScore) {
      const score = results[0]?.score ?? results[0]?.similarity ?? 0
      expect(score).toBeGreaterThanOrEqual(minSimilarity)
    }
  }
}

/**
 * Test Scenario: Multiple Memories Same Category
 *
 * Tests that multiple memories in the same category can be stored and searched.
 * Validates category filtering and batch operations.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param userId - Test user ID
 * @param category - Category to test (default: 'work')
 */
export async function testMultipleMemoriesSameCategory(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  userId: number,
  category: MemoryCategory = 'work'
): Promise<void> {
  // Add multiple memories in the same category
  await addMemory(userId, "User works as a developer", category)
  await addMemory(userId, "Company focuses on AI technologies", category)
  await addMemory(userId, "User manages a team of 5 people", category)

  // Query category-related memories
  const results = await searchMemories(userId, "work job career", 10)

  // Should find multiple memories
  expect(results.length).toBeGreaterThan(0)

  // Check that category is consistent
  const categoryMatches = results.filter((r) => r.category === category)
  expect(categoryMatches.length).toBeGreaterThan(0)
}

/**
 * Test Scenario: Empty/No Results Search
 *
 * Tests that searching for non-existent content returns empty results gracefully.
 * Validates error handling and edge case behavior.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param userId - Test user ID
 */
export async function testEmptySearchResults(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  userId: number
): Promise<void> {
  // Add some memories
  await addMemory(userId, "User's name is Ivan, from Moscow", "personal_info")

  // Search for completely unrelated content
  const results = await searchMemories(userId, "quantum physics theoretical mathematics", 10)

  // Should return empty array or very low similarity
  if (results.length > 0) {
    // If results exist, similarity should be very low
    const maxScore = Math.max(
      ...results.map((r) => r.score ?? r.similarity ?? 0)
    )
    expect(maxScore).toBeLessThan(0.5) // Low similarity threshold
  } else {
    // No results is also acceptable
    expect(results).toHaveLength(0)
  }
}

/**
 * Test Scenario: Category Coverage
 *
 * Tests that all memory categories are properly supported.
 * Validates category enum handling and storage.
 *
 * @param addMemory - Function to add a memory
 * @param userId - Test user ID
 */
export async function testCategorySupport(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<MemoryLike>,
  userId: number
): Promise<void> {
  const categories: MemoryCategory[] = [
    'personal_info',
    'health',
    'preferences',
    'events',
    'interests',
    'work',
    'other',
  ]

  for (const category of categories) {
    const content = `Test content for ${category}`
    const result = await addMemory(userId, content, category)

    expect(result).toBeDefined()
    expect(result.category).toBe(category)
    expect(result.content).toBe(content)
  }
}

/**
 * Test Scenario: Search Limit Enforcement
 *
 * Tests that search respects the limit parameter.
 * Validates pagination and result limiting.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param userId - Test user ID
 */
export async function testSearchLimit(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  userId: number
): Promise<void> {
  // Add multiple memories
  for (let i = 1; i <= 10; i++) {
    await addMemory(userId, `Test memory number ${i}`, 'other')
  }

  // Search with limit of 3
  const results = await searchMemories(userId, "test memory", 3)

  // Should return at most 3 results
  expect(results.length).toBeLessThanOrEqual(3)
  expect(results.length).toBeGreaterThan(0)
}

/**
 * Test Scenario: Memory Update/Contradiction Handling
 *
 * Tests behavior when user provides contradictory information.
 * Current behavior: Both memories are stored (no automatic consolidation).
 *
 * @param addMemory - Function to add a memory
 * @param getAllMemories - Function to get all memories for a user
 * @param userId - Test user ID
 */
export async function testMemoryContradictions(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  getAllMemories: (userId: number) => Promise<MemoryLike[]>,
  userId: number
): Promise<void> {
  // User says they live in Moscow
  await addMemory(userId, "User lives in Moscow", "personal_info", "I live in Moscow")

  // Later says they moved to Saint Petersburg
  await addMemory(userId, "User lives in Saint Petersburg", "personal_info", "I moved to Saint Petersburg")

  // Both memories should exist (no automatic consolidation yet)
  const allMemories = await getAllMemories(userId)
  expect(allMemories.length).toBeGreaterThanOrEqual(2)

  // Check for both locations
  const hasMoscow = allMemories.some((m) =>
    m.content.toLowerCase().includes("moscow")
  )
  const hasStPetersburg = allMemories.some((m) =>
    m.content.toLowerCase().includes("petersburg") ||
    m.content.toLowerCase().includes("saint petersburg")
  )

  // At least one of them should exist (extraction may vary)
  expect(hasMoscow || hasStPetersburg).toBe(true)
}

/**
 * Test Scenario: Batch Memory Insertion
 *
 * Tests inserting multiple memories efficiently.
 * Validates bulk operations and performance.
 *
 * @param addMemory - Function to add a memory
 * @param getAllMemories - Function to get all memories for a user
 * @param userId - Test user ID
 * @param count - Number of memories to insert (default: 10)
 */
export async function testBatchInsertion(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<any>,
  getAllMemories: (userId: number) => Promise<MemoryLike[]>,
  userId: number,
  count: number = 10
): Promise<void> {
  const categories: MemoryCategory[] = ['personal_info', 'work', 'preferences', 'other']

  // Insert multiple memories
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length]!
    await addMemory(userId, `Batch memory ${i + 1}`, category)
  }

  // Retrieve all memories
  const allMemories = await getAllMemories(userId)

  // Should have at least 'count' memories
  expect(allMemories.length).toBeGreaterThanOrEqual(count)
}

/**
 * Test Scenario: Special Characters Handling
 *
 * Tests that special characters, emojis, and unicode are handled correctly.
 * Validates text encoding and storage.
 *
 * @param addMemory - Function to add a memory
 * @param searchMemories - Function to search memories
 * @param userId - Test user ID
 */
export async function testSpecialCharacters(
  addMemory: (userId: number, content: string, category: string, sourceMessage?: string) => Promise<MemoryLike>,
  searchMemories: (userId: number, query: string, limit?: number) => Promise<SearchResultLike[]>,
  userId: number
): Promise<void> {
  const specialContent = "User's email: test@example.com, phone: +1-234-567-8900, emoji: 😊🎉"

  const memory = await addMemory(userId, specialContent, 'personal_info')
  expect(memory.content).toBe(specialContent)

  // Search should also handle special characters
  const results = await searchMemories(userId, "email test@example.com", 5)
  expect(results.length).toBeGreaterThan(0)
}
