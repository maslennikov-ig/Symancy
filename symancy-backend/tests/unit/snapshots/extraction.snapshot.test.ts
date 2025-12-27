/**
 * Snapshot Tests for Memory Extraction Results
 *
 * These tests verify that memory extraction results maintain consistent
 * structure and format across different scenarios.
 *
 * Snapshots capture:
 * - Extraction result structure
 * - Multi-memory extraction format
 * - Category distribution
 * - Edge cases (empty, malformed)
 */
import { describe, it, expect } from 'vitest';
import {
  createMockExtractionResponse,
  MEMORY_CATEGORIES,
} from '../../setup/mock-factories.js';
import {
  mockExtractionResult,
  mockEmptyExtractionResult,
  mockPersonalInfoResult,
  mockHealthResult,
  mockMultiCategoryResult,
  createMockExtractionResult,
} from '../../setup/mocks/memory-extraction.mock.js';
import type { MemoryCategory } from '@/services/memory.service.js';

describe('Memory Extraction Snapshots', () => {
  describe('Single extraction result structure', () => {
    it('should match basic extraction result structure', () => {
      const extraction = mockExtractionResult;

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        memoriesIsArray: Array.isArray(extraction.memories),
        allMemoriesHaveContent: extraction.memories.every(m => !!m.content),
        allMemoriesHaveCategory: extraction.memories.every(m => !!m.category),
        contentTypes: extraction.memories.map(m => typeof m.content),
        categoryTypes: extraction.memories.map(m => typeof m.category),
      }).toMatchSnapshot();
    });

    it('should match empty extraction result structure', () => {
      const extraction = mockEmptyExtractionResult;

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        isEmpty: extraction.memories.length === 0,
        consistentFlags: extraction.hasMemories === (extraction.memories.length > 0),
      }).toMatchSnapshot();
    });

    it('should match single-memory extraction', () => {
      const extraction = mockPersonalInfoResult;

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        firstMemory: {
          hasContent: !!extraction.memories[0]?.content,
          contentLength: extraction.memories[0]?.content.length,
          category: extraction.memories[0]?.category,
        },
      }).toMatchSnapshot();
    });
  });

  describe('Multi-memory extraction format', () => {
    it('should match multi-category extraction structure', () => {
      const extraction = mockMultiCategoryResult;

      const categories = extraction.memories.map(m => m.category);
      const uniqueCategories = [...new Set(categories)];

      expect({
        hasMemories: extraction.hasMemories,
        totalMemories: extraction.memories.length,
        uniqueCategoriesCount: uniqueCategories.length,
        categories: categories,
        uniqueCategories: uniqueCategories,
        allMemoriesComplete: extraction.memories.every(m =>
          m.content && m.category
        ),
      }).toMatchSnapshot();
    });

    it('should match batch extraction result format', () => {
      const batchSize = 5;
      const memories = Array.from({ length: batchSize }, (_, i) => ({
        content: `Memory ${i + 1}`,
        category: MEMORY_CATEGORIES[i % MEMORY_CATEGORIES.length] as MemoryCategory,
      }));

      const extraction = createMockExtractionResult(memories);

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        expectedCount: batchSize,
        matches: extraction.memories.length === batchSize,
        allValid: extraction.memories.every(m =>
          m.content && m.category && MEMORY_CATEGORIES.includes(m.category as any)
        ),
      }).toMatchSnapshot();
    });

    it('should match LLM response wrapper structure', () => {
      const memories = [
        { content: "User's name is Alice", category: 'personal_info' as MemoryCategory },
        { content: "User prefers technical explanations", category: 'preferences' as MemoryCategory },
      ];

      const llmResponse = createMockExtractionResponse(memories);

      // Parse the content as JSON
      const parsed = JSON.parse(llmResponse.content);

      expect({
        hasContent: !!llmResponse.content,
        contentType: typeof llmResponse.content,
        isValidJSON: (() => {
          try {
            JSON.parse(llmResponse.content);
            return true;
          } catch {
            return false;
          }
        })(),
        parsed: {
          hasMemories: parsed.hasMemories,
          memoriesCount: parsed.memories.length,
          structure: {
            hasMemoriesField: 'memories' in parsed,
            hasHasMemoriesField: 'hasMemories' in parsed,
          },
        },
      }).toMatchSnapshot();
    });
  });

  describe('Category-specific extraction', () => {
    it('should match personal_info extraction', () => {
      const extraction = mockPersonalInfoResult;

      expect({
        hasMemories: extraction.hasMemories,
        category: extraction.memories[0]?.category,
        isPersonalInfo: extraction.memories[0]?.category === 'personal_info',
        contentPattern: {
          hasContent: !!extraction.memories[0]?.content,
          mentionsUser: extraction.memories[0]?.content.toLowerCase().includes('user'),
        },
      }).toMatchSnapshot();
    });

    it('should match health extraction', () => {
      const extraction = mockHealthResult;

      expect({
        hasMemories: extraction.hasMemories,
        category: extraction.memories[0]?.category,
        isHealth: extraction.memories[0]?.category === 'health',
        contentPattern: {
          hasContent: !!extraction.memories[0]?.content,
        },
      }).toMatchSnapshot();
    });

    it('should match all category types', () => {
      const extractionsByCategory = MEMORY_CATEGORIES.map(category => ({
        category,
        extraction: createMockExtractionResult([
          { content: `Test ${category}`, category: category as MemoryCategory },
        ]),
      }));

      expect({
        totalCategories: MEMORY_CATEGORIES.length,
        categories: extractionsByCategory.map(e => ({
          category: e.category,
          hasMemories: e.extraction.hasMemories,
          memoriesCount: e.extraction.memories.length,
        })),
        allValid: extractionsByCategory.every(e =>
          e.extraction.hasMemories &&
          e.extraction.memories.length === 1 &&
          e.extraction.memories[0].category === e.category
        ),
      }).toMatchSnapshot();
    });
  });

  describe('Extraction edge cases', () => {
    it('should match extraction with very long content', () => {
      const longContent = 'This is a very long memory content. '.repeat(50);
      const extraction = createMockExtractionResult([
        { content: longContent, category: 'other' },
      ]);

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        contentLength: extraction.memories[0].content.length,
        isLong: extraction.memories[0].content.length > 1000,
      }).toMatchSnapshot();
    });

    it('should match extraction with special characters', () => {
      const specialContent = "User's name is José 🎉 (lives in São Paulo)";
      const extraction = createMockExtractionResult([
        { content: specialContent, category: 'personal_info' },
      ]);

      expect({
        hasMemories: extraction.hasMemories,
        contentLength: extraction.memories[0].content.length,
        hasEmoji: /\p{Emoji}/u.test(extraction.memories[0].content),
        hasAccents: /[àáâãäåèéêëìíîïòóôõöùúûü]/i.test(extraction.memories[0].content),
        hasApostrophe: extraction.memories[0].content.includes("'"),
      }).toMatchSnapshot();
    });

    it('should match extraction with minimal content', () => {
      const minimalContent = "Alice";
      const extraction = createMockExtractionResult([
        { content: minimalContent, category: 'personal_info' },
      ]);

      expect({
        hasMemories: extraction.hasMemories,
        contentLength: extraction.memories[0].content.length,
        isMinimal: extraction.memories[0].content.length < 10,
      }).toMatchSnapshot();
    });

    it('should match extraction with duplicate memories', () => {
      const duplicateMemories = [
        { content: "User likes coffee", category: 'preferences' as MemoryCategory },
        { content: "User likes coffee", category: 'preferences' as MemoryCategory },
      ];

      const extraction = createMockExtractionResult(duplicateMemories);

      expect({
        hasMemories: extraction.hasMemories,
        memoriesCount: extraction.memories.length,
        hasDuplicates: extraction.memories[0].content === extraction.memories[1].content,
        uniqueContents: [...new Set(extraction.memories.map(m => m.content))].length,
      }).toMatchSnapshot();
    });
  });

  describe('Extraction result validation', () => {
    it('should match valid extraction schema', () => {
      const extraction = mockExtractionResult;

      const isValid = {
        hasRequiredFields: 'memories' in extraction && 'hasMemories' in extraction,
        memoriesIsArray: Array.isArray(extraction.memories),
        hasMemoriesIsBoolean: typeof extraction.hasMemories === 'boolean',
        allMemoriesValid: extraction.memories.every(m =>
          typeof m.content === 'string' &&
          typeof m.category === 'string' &&
          MEMORY_CATEGORIES.includes(m.category as any)
        ),
        flagsConsistent: extraction.hasMemories === (extraction.memories.length > 0),
      };

      expect(isValid).toMatchSnapshot();
    });

    it('should match extraction with invalid category (error case)', () => {
      const extraction = createMockExtractionResult([
        { content: "Test", category: 'invalid_category' as any },
      ]);

      expect({
        hasMemories: extraction.hasMemories,
        category: extraction.memories[0].category,
        isValidCategory: MEMORY_CATEGORIES.includes(extraction.memories[0].category as any),
      }).toMatchSnapshot();
    });

    it('should match extraction consistency flags', () => {
      const testCases = [
        { memories: [], expectedHasMemories: false },
        { memories: [{ content: "Test", category: 'other' as MemoryCategory }], expectedHasMemories: true },
        { memories: Array(5).fill(null).map((_, i) => ({
          content: `Memory ${i}`,
          category: 'other' as MemoryCategory,
        })), expectedHasMemories: true },
      ];

      const results = testCases.map(tc => {
        const extraction = createMockExtractionResult(tc.memories);
        return {
          memoriesCount: extraction.memories.length,
          hasMemories: extraction.hasMemories,
          expectedHasMemories: tc.expectedHasMemories,
          isConsistent: extraction.hasMemories === tc.expectedHasMemories,
        };
      });

      expect({
        testCasesCount: testCases.length,
        allConsistent: results.every(r => r.isConsistent),
        results,
      }).toMatchSnapshot();
    });
  });

  describe('JSON serialization', () => {
    it('should match serialized extraction result', () => {
      const extraction = mockExtractionResult;
      const serialized = JSON.stringify(extraction);
      const deserialized = JSON.parse(serialized);

      expect({
        canSerialize: true,
        serializedLength: serialized.length,
        deserializedMatches: JSON.stringify(deserialized) === serialized,
        structure: {
          hasMemories: deserialized.hasMemories,
          memoriesCount: deserialized.memories.length,
        },
      }).toMatchSnapshot();
    });

    it('should match LLM response JSON format', () => {
      const memories = [
        { content: "User's name is Bob", category: 'personal_info' as MemoryCategory },
      ];
      const llmResponse = createMockExtractionResponse(memories);

      expect({
        hasContent: !!llmResponse.content,
        isString: typeof llmResponse.content === 'string',
        canParse: (() => {
          try {
            const parsed = JSON.parse(llmResponse.content);
            return 'memories' in parsed && 'hasMemories' in parsed;
          } catch {
            return false;
          }
        })(),
      }).toMatchSnapshot();
    });
  });

  describe('Multi-batch extraction', () => {
    it('should match large batch extraction structure', () => {
      const largeBatch = Array.from({ length: 20 }, (_, i) => ({
        content: `Memory ${i + 1}`,
        category: MEMORY_CATEGORIES[i % MEMORY_CATEGORIES.length] as MemoryCategory,
      }));

      const extraction = createMockExtractionResult(largeBatch);

      const categoryDistribution = MEMORY_CATEGORIES.map(cat => ({
        category: cat,
        count: extraction.memories.filter(m => m.category === cat).length,
      }));

      expect({
        hasMemories: extraction.hasMemories,
        totalMemories: extraction.memories.length,
        expectedCount: largeBatch.length,
        categoryDistribution,
        allCategoriesPresent: categoryDistribution.every(cd => cd.count > 0),
      }).toMatchSnapshot();
    });

    it('should match extraction metadata', () => {
      const extraction = mockMultiCategoryResult;

      const metadata = {
        totalMemories: extraction.memories.length,
        hasMemories: extraction.hasMemories,
        categories: {
          unique: [...new Set(extraction.memories.map(m => m.category))],
          distribution: extraction.memories.reduce((acc, m) => {
            acc[m.category] = (acc[m.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        content: {
          totalLength: extraction.memories.reduce((sum, m) => sum + m.content.length, 0),
          avgLength: Math.round(
            extraction.memories.reduce((sum, m) => sum + m.content.length, 0) / extraction.memories.length
          ),
          minLength: Math.min(...extraction.memories.map(m => m.content.length)),
          maxLength: Math.max(...extraction.memories.map(m => m.content.length)),
        },
      };

      expect(metadata).toMatchSnapshot();
    });
  });
});
