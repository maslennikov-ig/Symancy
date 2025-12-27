/**
 * Snapshot Tests for Embedding Results
 *
 * These tests verify that embedding vectors have consistent structure
 * without asserting exact values (which are non-deterministic).
 *
 * Snapshots capture:
 * - Vector dimensions
 * - Value type (number)
 * - Value ranges (min/max)
 * - Distribution characteristics
 */
import { describe, it, expect } from 'vitest';
import {
  createMockEmbeddingResult,
  createMockMemory,
  createMockEmbeddingsResponse,
} from '../../setup/mock-factories.js';
import { EMBEDDING_DIMS } from '../../setup/test-constants.js';

describe('Embedding Result Snapshots', () => {
  describe('Single embedding structure', () => {
    it('should match embedding vector structure snapshot', () => {
      const embedding = createMockEmbeddingResult(EMBEDDING_DIMS);

      // Snapshot the structure, not exact values (which are random)
      expect({
        length: embedding.length,
        type: typeof embedding[0],
        isArray: Array.isArray(embedding),
        range: {
          hasNegative: embedding.some(v => v < 0),
          hasPositive: embedding.some(v => v > 0),
          hasZero: embedding.some(v => v === 0),
          // Don't snapshot exact min/max as they vary with random values
          minInRange: Math.min(...embedding) >= -1 && Math.min(...embedding) <= 1,
          maxInRange: Math.max(...embedding) >= -1 && Math.max(...embedding) <= 1,
        },
        statistics: {
          allNumbers: embedding.every(v => typeof v === 'number'),
          allFinite: embedding.every(v => Number.isFinite(v)),
          hasNaN: embedding.some(v => Number.isNaN(v)),
        },
      }).toMatchSnapshot();
    });

    it('should match deterministic embedding structure (seeded)', () => {
      const seed = 12345;
      const embedding = createMockEmbeddingResult(EMBEDDING_DIMS, seed);

      // Deterministic embeddings should have consistent properties
      expect({
        length: embedding.length,
        firstValue: embedding[0],
        lastValue: embedding[EMBEDDING_DIMS - 1],
        middleValue: embedding[Math.floor(EMBEDDING_DIMS / 2)],
        // Check reproducibility with same seed
        isReproducible: JSON.stringify(embedding) === JSON.stringify(createMockEmbeddingResult(EMBEDDING_DIMS, seed)),
      }).toMatchSnapshot();
    });

    it('should match embedding value distribution snapshot', () => {
      const embedding = createMockEmbeddingResult(EMBEDDING_DIMS);

      // Analyze distribution characteristics
      const bins = { negative: 0, zero: 0, positive: 0 };
      const magnitudes = { small: 0, medium: 0, large: 0 };

      embedding.forEach(v => {
        if (v < 0) bins.negative++;
        else if (v > 0) bins.positive++;
        else bins.zero++;

        const abs = Math.abs(v);
        if (abs < 0.3) magnitudes.small++;
        else if (abs < 0.7) magnitudes.medium++;
        else magnitudes.large++;
      });

      expect({
        dimensions: EMBEDDING_DIMS,
        signDistribution: {
          negative: bins.negative > 0,
          positive: bins.positive > 0,
          zero: bins.zero > 0,
        },
        magnitudeDistribution: {
          hasSmall: magnitudes.small > 0,
          hasMedium: magnitudes.medium > 0,
          hasLarge: magnitudes.large > 0,
        },
      }).toMatchSnapshot();
    });
  });

  describe('Batch embeddings structure', () => {
    it('should match batch embeddings response structure', () => {
      const batchSize = 3;
      const embeddings = Array.from({ length: batchSize }, () =>
        createMockEmbeddingResult(EMBEDDING_DIMS)
      );

      const response = createMockEmbeddingsResponse(embeddings);

      expect({
        dataLength: response.data.length,
        hasIndexes: response.data.every(item => typeof item.index === 'number'),
        indexesSequential: response.data.every((item, idx) => item.index === idx),
        allEmbeddingsSameLength: response.data.every(item => item.embedding.length === EMBEDDING_DIMS),
        embeddingTypes: {
          firstIsArray: Array.isArray(response.data[0].embedding),
          allArrays: response.data.every(item => Array.isArray(item.embedding)),
        },
      }).toMatchSnapshot();
    });

    it('should match empty batch structure', () => {
      const response = createMockEmbeddingsResponse([]);

      expect({
        dataLength: response.data.length,
        isEmpty: response.data.length === 0,
      }).toMatchSnapshot();
    });

    it('should match large batch structure', () => {
      const largeBatchSize = 100;
      const embeddings = Array.from({ length: largeBatchSize }, () =>
        createMockEmbeddingResult(EMBEDDING_DIMS)
      );

      const response = createMockEmbeddingsResponse(embeddings);

      expect({
        dataLength: response.data.length,
        batchSize: largeBatchSize,
        hasAllIndexes: response.data.length === largeBatchSize,
        indexRange: {
          min: Math.min(...response.data.map(d => d.index)),
          max: Math.max(...response.data.map(d => d.index)),
        },
      }).toMatchSnapshot();
    });
  });

  describe('Memory object with embeddings', () => {
    it('should match memory object structure snapshot', () => {
      const memory = createMockMemory({
        content: 'Test content',
        category: 'preferences',
      });

      // Snapshot structure without dynamic values like IDs and timestamps
      expect({
        hasId: !!memory.id,
        idType: typeof memory.id,
        hasUserId: !!memory.telegramUserId,
        userIdType: typeof memory.telegramUserId,
        hasContent: !!memory.content,
        contentType: typeof memory.content,
        hasCategory: !!memory.category,
        categoryType: typeof memory.category,
        hasEmbedding: Array.isArray(memory.embedding),
        embeddingLength: memory.embedding?.length,
        embeddingValueTypes: memory.embedding?.every(v => typeof v === 'number'),
        hasCreatedAt: !!memory.createdAt,
        createdAtType: typeof memory.createdAt,
        hasImportance: memory.importance !== undefined,
        importanceType: typeof memory.importance,
        hasSourceMessage: memory.sourceMessage !== undefined,
        hasUpdatedAt: !!memory.updatedAt,
        updatedAtType: typeof memory.updatedAt,
      }).toMatchSnapshot();
    });

    it('should match memory with different categories', () => {
      const categories = ['personal_info', 'health', 'preferences', 'events', 'interests', 'work', 'other'] as const;

      const memoriesByCategory = categories.map(category => {
        const memory = createMockMemory({ category });
        return {
          category,
          hasEmbedding: Array.isArray(memory.embedding),
          embeddingLength: memory.embedding?.length,
        };
      });

      expect({
        totalCategories: categories.length,
        allHaveEmbeddings: memoriesByCategory.every(m => m.hasEmbedding),
        allSameDimensions: memoriesByCategory.every(m => m.embeddingLength === EMBEDDING_DIMS),
        categories: memoriesByCategory.map(m => m.category),
      }).toMatchSnapshot();
    });

    it('should match memory without embedding (null case)', () => {
      const memory = createMockMemory({
        content: 'Test content',
        embedding: undefined as any, // Test edge case
      });

      expect({
        hasEmbedding: !!memory.embedding,
        embeddingType: typeof memory.embedding,
        embeddingIsUndefined: memory.embedding === undefined,
        embeddingIsNull: memory.embedding === null,
      }).toMatchSnapshot();
    });
  });

  describe('Embedding dimensions edge cases', () => {
    it('should match small dimension embedding (test case)', () => {
      const smallDims = 8;
      const seed = 999; // Use deterministic seed for reproducible values
      const embedding = createMockEmbeddingResult(smallDims, seed);

      expect({
        length: embedding.length,
        expectedLength: smallDims,
        matches: embedding.length === smallDims,
        values: embedding, // Deterministic values for snapshot
      }).toMatchSnapshot();
    });

    it('should match standard BGE-M3 dimensions (1024)', () => {
      const embedding = createMockEmbeddingResult(1024);

      expect({
        length: embedding.length,
        expectedLength: 1024,
        matches: embedding.length === 1024,
        isBGEM3Standard: true,
      }).toMatchSnapshot();
    });

    it('should match custom dimensions', () => {
      const customDims = 512;
      const embedding = createMockEmbeddingResult(customDims);

      expect({
        length: embedding.length,
        expectedLength: customDims,
        matches: embedding.length === customDims,
      }).toMatchSnapshot();
    });
  });

  describe('Embedding consistency', () => {
    it('should match deterministic embedding reproducibility', () => {
      const seed = 42;
      const embedding1 = createMockEmbeddingResult(EMBEDDING_DIMS, seed);
      const embedding2 = createMockEmbeddingResult(EMBEDDING_DIMS, seed);

      expect({
        areEqual: JSON.stringify(embedding1) === JSON.stringify(embedding2),
        firstValueMatch: embedding1[0] === embedding2[0],
        lastValueMatch: embedding1[EMBEDDING_DIMS - 1] === embedding2[EMBEDDING_DIMS - 1],
        lengthMatch: embedding1.length === embedding2.length,
      }).toMatchSnapshot();
    });

    it('should match random embedding uniqueness', () => {
      const embedding1 = createMockEmbeddingResult(EMBEDDING_DIMS);
      const embedding2 = createMockEmbeddingResult(EMBEDDING_DIMS);

      expect({
        areEqual: JSON.stringify(embedding1) === JSON.stringify(embedding2),
        firstValueMatch: embedding1[0] === embedding2[0],
        // Random embeddings should be different
        areDifferent: JSON.stringify(embedding1) !== JSON.stringify(embedding2),
      }).toMatchSnapshot();
    });
  });
});
