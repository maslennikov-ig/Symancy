# Mock Factory Pattern

## Overview

The `mock-factories.ts` file provides standardized factory functions for creating consistent mock objects across all test files.

## Philosophy

**Problem**: Different test files use different mocking approaches, leading to:
- Inconsistent patterns across tests
- Lots of duplicated mock code
- Hard to maintain (change in one place doesn't propagate)
- Easy to make mistakes (wrong types, missing fields)

**Solution**: Centralized factory functions that:
- Provide sensible defaults
- Allow easy customization via overrides
- Are type-safe (TypeScript enforced)
- Reduce code duplication
- Make tests more readable

## When to Use Factories

### ✅ Use Factories When:

- Creating mock Supabase clients
- Creating mock memories (UserMemory, MemorySearchResult)
- Creating mock embeddings (1024-dim vectors)
- Creating mock LLM responses
- Creating mock API errors
- Writing new tests

### ⚠️ Don't Use Factories When:

- Testing edge cases requiring very specific mock behavior
- Mocking third-party libraries not covered by factories
- Test requires inline mock for clarity (rare)

**General Rule**: Prefer factories unless there's a specific reason not to.

## Comparison: Before vs After

### Example 1: Mock Supabase Insert

#### Before (Inline Mock)
```typescript
const mockInsertChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: {
      id: "test-uuid-123",
      telegram_user_id: 999999999,
      content: "User loves coffee",
      category: "preferences",
      embedding: JSON.stringify(Array(1024).fill(0.1)),
      source_message: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    error: null,
  }),
}

mockSupabaseClient.from.mockReturnValue(mockInsertChain)
```

**Lines of code**: 18

#### After (Factory)
```typescript
import { createMockInsertChain, createMockMemoryDbRow } from '../setup/mock-factories.js'

const mockDbRow = createMockMemoryDbRow({
  content: "User loves coffee",
  category: "preferences",
})

const mockInsertChain = createMockInsertChain(mockDbRow, null)
mockSupabaseClient.from.mockReturnValue(mockInsertChain)
```

**Lines of code**: 8

**Benefits**:
- 56% fewer lines
- More readable (focuses on what's unique)
- Type-safe (TypeScript validates fields)
- Easier to maintain (default values managed centrally)

### Example 2: Mock Embeddings

#### Before (Inline)
```typescript
const mockEmbedding = new Array(1024).fill(0).map(() => Math.random())

mockCreate.mockResolvedValue({
  data: [
    {
      embedding: mockEmbedding,
      index: 0,
    },
  ],
})
```

**Lines of code**: 9

#### After (Factory)
```typescript
import { createMockEmbeddingResult, createMockEmbeddingsResponse } from '../setup/mock-factories.js'

const mockEmbedding = createMockEmbeddingResult()

mockCreate.mockResolvedValue(
  createMockEmbeddingsResponse([mockEmbedding])
)
```

**Lines of code**: 6

**Benefits**:
- 33% fewer lines
- Clear intent (factory name describes purpose)
- Can use deterministic embeddings: `createMockEmbeddingResult(1024, 42)`

### Example 3: Multiple Memories

#### Before (Inline)
```typescript
const memories = [
  {
    id: "mem-1",
    telegramUserId: 999999999,
    content: "Memory 1",
    category: "other",
    embedding: Array(1024).fill(0.1),
    createdAt: new Date(),
    updatedAt: new Date(),
    importance: 0.5,
    sourceMessage: null,
  },
  {
    id: "mem-2",
    telegramUserId: 999999999,
    content: "Memory 2",
    category: "other",
    embedding: Array(1024).fill(0.1),
    createdAt: new Date(),
    updatedAt: new Date(),
    importance: 0.5,
    sourceMessage: null,
  },
  // ... repeat 3 more times
]
```

**Lines of code**: ~60 (5 memories × 12 lines each)

#### After (Factory)
```typescript
import { createMockMemories } from '../setup/mock-factories.js'

const memories = createMockMemories(5, { category: "other" })
```

**Lines of code**: 3

**Benefits**:
- 95% fewer lines
- Instantly readable
- Each memory gets unique ID automatically

## Available Factories

### Database Factories

```typescript
// Full Supabase client
const supabase = createMockSupabaseClient({
  insertData: mockMemory,
  selectData: [mockMemory1, mockMemory2],
  rpcData: [mockSearchResult],
  error: null,
})

// Insert chain
const insertChain = createMockInsertChain(mockMemory, null)

// Select chain
const selectChain = createMockSelectChain([mockMemory], null)

// Delete chain
const deleteChain = createMockDeleteChain(null)
```

### Memory Factories

```typescript
// Single memory (camelCase, for service layer)
const memory = createMockMemory({
  content: "User loves coffee",
  category: "preferences",
})

// Database row (snake_case, for DB layer)
const dbRow = createMockMemoryDbRow({
  content: "User loves coffee",
  category: "preferences",
})

// Search result
const result = createMockSearchResult({
  content: "User loves coffee",
  score: 0.95,
})

// Multiple memories
const memories = createMockMemories(5, { category: "work" })
```

### Embedding Factories

```typescript
// Random embedding
const embedding = createMockEmbeddingResult()

// Deterministic embedding (same seed = same output)
const embedding = createMockEmbeddingResult(1024, 42)

// OpenAI API response
const response = createMockEmbeddingsResponse([
  createMockEmbeddingResult(),
  createMockEmbeddingResult(),
])
```

### LLM Factories

```typescript
// LangChain response
const llmResponse = createMockLLMResponse("Hello!", 50)

// Memory extraction response
const extraction = createMockExtractionResponse([
  { content: "User's name is Alice", category: "personal_info" },
])
```

### API Factories

```typescript
// OpenAI API error
const error = createMockAPIError(429, "Rate limit exceeded")

// OpenAI client
const mockCreate = vi.fn()
const client = createMockOpenAIClient(mockCreate)
```

### Utility Factories

```typescript
// Chat history
const history = createMockChatHistory([
  { role: "user", content: "Hello" },
  { role: "assistant", content: "Hi!" },
])

// Analysis result
const analysis = createMockAnalysis("You saw a spiral pattern")
```

## Testing Patterns

### Pattern 1: Unit Test with Factory

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockInsertChain, createMockMemoryDbRow } from '../setup/mock-factories.js'
import { addMemory } from '@/services/memory.service.js'

const mockSupabaseClient = {
  from: vi.fn(),
}

vi.mock('@/core/database.js', () => ({
  getSupabase: () => mockSupabaseClient,
}))

describe('Memory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add memory with correct fields', async () => {
    const mockDbRow = createMockMemoryDbRow({
      content: "User loves coffee",
      category: "preferences",
    })

    const mockInsertChain = createMockInsertChain(mockDbRow, null)
    mockSupabaseClient.from.mockReturnValue(mockInsertChain)

    const result = await addMemory(999999999, "User loves coffee", "preferences")

    expect(result.content).toBe("User loves coffee")
    expect(result.category).toBe("preferences")
  })
})
```

### Pattern 2: Integration Test with Multiple Factories

```typescript
import { describe, it, expect } from 'vitest'
import {
  createMockMemoryDbRow,
  createMockEmbeddingResult,
  createMockSupabaseClient,
} from '../setup/mock-factories.js'

describe('Memory Pipeline', () => {
  it('should extract, store, and search memories', async () => {
    // Setup mocks
    const mockEmbedding = createMockEmbeddingResult(1024, 42)
    const mockDbRow = createMockMemoryDbRow({
      content: "User's name is Alice",
      category: "personal_info",
      embedding: JSON.stringify(mockEmbedding),
    })

    const supabase = createMockSupabaseClient({
      insertData: mockDbRow,
      rpcData: [{
        id: mockDbRow.id,
        content: mockDbRow.content,
        category: mockDbRow.category,
        similarity: 0.95,
      }],
    })

    // Test pipeline...
  })
})
```

### Pattern 3: Error Handling Test

```typescript
import { describe, it, expect } from 'vitest'
import { createMockAPIError } from '../setup/mock-factories.js'

describe('Embedding Error Handling', () => {
  it('should retry on 429 rate limit', async () => {
    const error = createMockAPIError(429, "Rate limit exceeded")

    mockCreate
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        data: [{ embedding: createMockEmbeddingResult(), index: 0 }],
      })

    // Test retry logic...
  })
})
```

## Best Practices

### ✅ DO:

1. **Use factories for new tests**
   ```typescript
   const memory = createMockMemory({ content: "Test" })
   ```

2. **Override only what you need**
   ```typescript
   const memory = createMockMemory({
     content: "Custom content",
     // All other fields use defaults
   })
   ```

3. **Combine factories**
   ```typescript
   const dbRow = createMockMemoryDbRow({
     embedding: JSON.stringify(createMockEmbeddingResult(1024, 42)),
   })
   ```

4. **Use deterministic seeds for consistency tests**
   ```typescript
   const emb1 = createMockEmbeddingResult(1024, 42)
   const emb2 = createMockEmbeddingResult(1024, 42)
   expect(emb1).toEqual(emb2)
   ```

### ❌ DON'T:

1. **Don't duplicate factory logic**
   ```typescript
   // ❌ BAD
   const memory = {
     id: generateTestUUID(),
     content: "Test",
     category: "other",
     // ... lots of fields
   }

   // ✅ GOOD
   const memory = createMockMemory({ content: "Test" })
   ```

2. **Don't override everything (defeats the purpose)**
   ```typescript
   // ❌ BAD (why use factory?)
   const memory = createMockMemory({
     id: "custom",
     content: "custom",
     category: "custom",
     // ... override every field
   })

   // ✅ GOOD (inline mock is fine here)
   const memory = { ... }
   ```

3. **Don't break existing tests**
   - Factories are additive
   - Existing tests continue to work
   - Migrate incrementally

## Migration Strategy

1. **New tests**: Always use factories
2. **Refactoring existing tests**: Use factories when touching the file
3. **No rush**: Existing tests continue to work
4. **Gradual adoption**: Team learns patterns over time

## Future Enhancements

Potential factory additions:
- `createMockTelegramBot()` - Mock Telegram bot
- `createMockN8NWebhook()` - Mock N8N webhook
- `createMockPurchase()` - Mock purchase record
- `createMockUserCredits()` - Mock user credits

Submit PRs or suggestions to expand the factory collection!
