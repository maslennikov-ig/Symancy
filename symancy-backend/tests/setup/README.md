# Test Setup and Mocks

This directory contains test setup files, mocks, and helpers for the Symancy backend test suite.

## Structure

```
tests/setup/
├── vitest.setup.ts              # Global test setup (logger mocks, etc.)
├── memory-test-helpers.ts       # Helper functions for memory testing
└── mocks/
    ├── embeddings.mock.ts       # Mock embeddings client (BGE-M3)
    ├── memory-extraction.mock.ts # Mock memory extraction chain
    ├── openrouter.mock.ts       # Mock OpenRouter API
    ├── supabase.mock.ts         # Mock Supabase client
    └── telegram.mock.ts         # Mock Telegram bot
```

## Usage Examples

### Testing Memory Extraction

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockExtractMemories, mockExtractionResult } from '../setup/mocks/memory-extraction.mock.js'
import { extractMemories } from '@/chains/memory-extraction.chain.js'

// Mock the module
vi.mock('@/chains/memory-extraction.chain.js', () => ({
  extractMemories: mockExtractMemories,
}))

describe('Memory Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractMemories.mockResolvedValue(mockExtractionResult)
  })

  it('should extract memories from message', async () => {
    const result = await extractMemories("My name is Alice")

    expect(mockExtractMemories).toHaveBeenCalledWith("My name is Alice")
    expect(result.hasMemories).toBe(true)
    expect(result.memories).toHaveLength(2)
  })
})
```

### Testing Embeddings

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockGetEmbedding, generateDeterministicEmbedding } from '../setup/mocks/embeddings.mock.js'
import { cosineSimilarity } from '../setup/memory-test-helpers.js'

vi.mock('@/core/embeddings/index.js', () => ({
  getEmbedding: mockGetEmbedding,
}))

describe('Embeddings', () => {
  it('should generate consistent embeddings for same text', () => {
    const emb1 = generateDeterministicEmbedding("test")
    const emb2 = generateDeterministicEmbedding("test")

    expect(cosineSimilarity(emb1, emb2)).toBe(1)
  })

  it('should generate different embeddings for different text', () => {
    const emb1 = generateDeterministicEmbedding("test")
    const emb2 = generateDeterministicEmbedding("different")

    const similarity = cosineSimilarity(emb1, emb2)
    expect(similarity).toBeLessThan(1)
  })
})
```

### Testing Memory Service

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockGetEmbedding, createMockEmbedding } from '../setup/mocks/embeddings.mock.js'
import { mockSupabaseClient } from '../setup/mocks/supabase.mock.js'
import { TEST_USER_ID, createMockUserMemory } from '../setup/memory-test-helpers.js'
import { addMemory } from '@/services/memory.service.js'

vi.mock('@/core/embeddings/index.js', () => ({
  getEmbedding: mockGetEmbedding,
}))

vi.mock('@/core/database.js', () => ({
  getSupabase: () => mockSupabaseClient,
}))

describe('Memory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEmbedding.mockResolvedValue(createMockEmbedding())
  })

  it('should add memory with embedding', async () => {
    const mockMemory = createMockUserMemory(
      'uuid-1',
      TEST_USER_ID,
      "User's name is Alice",
      'personal_info'
    )

    mockSupabaseClient.from().insert().select().single.mockResolvedValue({
      data: mockMemory,
      error: null,
    })

    const result = await addMemory(TEST_USER_ID, "User's name is Alice", 'personal_info')

    expect(mockGetEmbedding).toHaveBeenCalledWith("User's name is Alice")
    expect(result.content).toBe("User's name is Alice")
  })
})
```

## Test Constants

Use these constants for consistent test data:

- `TEST_USER_ID` (999999999) - Primary test user
- `TEST_USER_ID_2` (999999998) - Secondary test user
- `TEST_USER_ID_3` (999999997) - Tertiary test user
- `TEST_MEMORY_ID_1/2/3` - UUID constants for memory IDs

## Helper Functions

### Embedding Helpers

- `createMockEmbedding()` - Random 1024-dim embedding
- `generateDeterministicEmbedding(text)` - Deterministic embedding based on text hash
- `cosineSimilarity(a, b)` - Calculate cosine similarity (-1 to 1)
- `l2Distance(a, b)` - Calculate Euclidean distance
- `normalizeEmbedding(embedding)` - Normalize to unit length

### Mock Data Helpers

- `createMockSearchResult(id, content, category, similarity)` - Mock search result
- `createMockUserMemory(id, userId, content, category, source?)` - Mock memory object

### Cleanup Helpers

- `cleanupTestData(userId)` - Delete all test data for user
- `deleteAllMemoriesForUser(userId)` - Delete memories only

## Mock Customization

All mocks use Vitest's `vi.fn()` and can be customized per test:

```typescript
beforeEach(() => {
  // Reset to default behavior
  mockExtractMemories.mockResolvedValue(mockExtractionResult)
})

it('should handle empty extraction', async () => {
  // Override for this test
  mockExtractMemories.mockResolvedValue(mockEmptyExtractionResult)

  const result = await extractMemories("Hello")
  expect(result.hasMemories).toBe(false)
})
```

## Real API Tests (Optional)

For pre-production validation, optional real API tests are available that hit actual OpenRouter and Supabase APIs:

```bash
# Run real API tests (costs ~$0.01-0.05)
./scripts/run-real-api-tests.sh

# Or directly
REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts
```

**See:** `tests/integration/memory/REAL_API_TESTS.md` for full documentation

**Key differences:**
- **Mock tests** (default): Fast, free, run in CI, use mocks from this directory
- **Real API tests** (optional): Slow, costs money, manual only, validate against real APIs

## ESM Compatibility

All imports use `.js` extension for ESM compatibility:

```typescript
import { mockExtractMemories } from '../setup/mocks/memory-extraction.mock.js'
import { TEST_USER_ID } from '../setup/memory-test-helpers.js'
```
