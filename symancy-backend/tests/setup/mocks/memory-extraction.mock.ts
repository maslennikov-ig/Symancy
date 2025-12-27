import { vi } from 'vitest'
import type { ExtractionResult, ExtractedMemory } from '@/chains/memory-extraction.chain.js'

/**
 * Mock extraction result with memories
 */
export const mockExtractionResult: ExtractionResult = {
  memories: [
    { content: "User's name is Test", category: "personal_info" },
    { content: "User prefers technical explanations", category: "preferences" },
  ],
  hasMemories: true,
}

/**
 * Mock empty extraction result (no memories found)
 */
export const mockEmptyExtractionResult: ExtractionResult = {
  memories: [],
  hasMemories: false,
}

/**
 * Mock extraction result with single personal info memory
 */
export const mockPersonalInfoResult: ExtractionResult = {
  memories: [
    { content: "User's name is Alice", category: "personal_info" },
  ],
  hasMemories: true,
}

/**
 * Mock extraction result with health memory
 */
export const mockHealthResult: ExtractionResult = {
  memories: [
    { content: "User has headache symptoms", category: "health" },
  ],
  hasMemories: true,
}

/**
 * Mock extraction result with multiple categories
 */
export const mockMultiCategoryResult: ExtractionResult = {
  memories: [
    { content: "User works as a developer", category: "work" },
    { content: "User enjoys reading sci-fi books", category: "interests" },
    { content: "User has a meeting on Monday", category: "events" },
  ],
  hasMemories: true,
}

/**
 * Mock for extractMemories function
 * Returns mockExtractionResult by default, can be customized
 */
export const mockExtractMemories = vi.fn(() => Promise.resolve(mockExtractionResult))

/**
 * Mock the memory extraction chain module
 * Call this in beforeEach to mock the extraction chain
 */
export function mockMemoryExtractionModule() {
  vi.mock('@/chains/memory-extraction.chain.js', () => ({
    extractMemories: mockExtractMemories,
    MemoryCategory: {
      enum: () => ['personal_info', 'health', 'preferences', 'events', 'interests', 'work', 'other'],
    },
    ExtractionResult: {},
    ExtractedMemory: {},
    EXTRACTION_MODEL: 'qwen/qwen-2.5-72b-instruct',
  }))
}

/**
 * Helper to create custom extraction result
 */
export function createMockExtractionResult(
  memories: ExtractedMemory[]
): ExtractionResult {
  return {
    memories,
    hasMemories: memories.length > 0,
  }
}
