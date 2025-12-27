# Memory Pipeline Integration Tests

**Location**: `/home/me/code/coffee/symancy-backend/tests/integration/memory/memory-pipeline.test.ts`

**Test Date**: 2025-12-27

**Status**: ✅ All 22 tests passing

---

## Overview

This test suite validates the complete memory pipeline integration, testing the flow from memory extraction through storage with embeddings to semantic search retrieval.

### Components Tested

1. **Memory Extraction Chain** (`@/chains/memory-extraction.chain.js`)
   - Extracts memorable facts from user messages using Qwen 2.5 72B via OpenRouter
   - Categorizes memories (personal_info, health, preferences, events, interests, work, other)
   - Handles JSON parsing and markdown code blocks

2. **Memory Service** (`@/services/memory.service.js`)
   - Stores memories with embeddings in Supabase
   - Performs vector similarity search via RPC
   - Manages memory CRUD operations

3. **BGE-M3 Embeddings** (`@/core/embeddings/bge-client.js`)
   - Generates 1024-dimensional embeddings via OpenRouter API
   - Supports Russian-optimized semantic search

---

## Test Structure

### 1. Full Pipeline Flow (3 tests)

Tests the complete integration of extraction → storage → search:

#### ✅ Extract and store memories from message
- Extracts memories using LangChain
- Stores memories with embeddings
- Verifies search retrieval with similarity scores

#### ✅ Build context over multiple messages
- Simulates multi-message conversation
- Extracts and stores memories across 3 messages
- Validates category-specific search (personal_info, work, health)

#### ✅ Handle mixed categories in one message
- Tests extraction of multiple categories from single message
- Validates 5 memories across 3 categories (personal_info, work, health)

---

### 2. Embedding Generation (2 tests)

Tests deterministic embedding generation and uniqueness:

#### ✅ Generate unique embeddings for different content
- Creates embeddings for 3 different memory contents
- Validates cosine similarity < 0.95 between different embeddings

#### ✅ Generate consistent embeddings for same content
- Generates embedding twice for identical content
- Verifies cosine similarity ≈ 1.0 (allowing floating point precision)

---

### 3. Semantic Search Relevance (4 tests)

Tests vector search accuracy and ranking:

#### ✅ Return relevant memories for search queries
- Stores multiple memories (name, location, work)
- Validates Russian queries ("как зовут", "где работает")
- Checks similarity scores > 0.9

#### ✅ Rank results by similarity score
- Returns 3 results with different similarity scores
- Validates ordering by similarity (0.95, 0.75, 0.88)

#### ✅ Respect limit parameter in search
- Validates `match_limit` parameter in RPC call
- Confirms result count matches limit

#### ✅ Return empty array when no relevant memories found
- Tests query with no matches
- Validates empty array response

---

### 4. Error Handling (4 tests)

Tests graceful degradation and error recovery:

#### ✅ Handle extraction failure gracefully
- Mocks LLM API error
- Expects rejection with error

#### ✅ Handle malformed extraction response
- Mocks invalid JSON response
- Returns empty result (hasMemories: false)

#### ✅ Handle storage failure
- Mocks database connection error
- Expects rejection with "Failed to add memory"

#### ✅ Handle search failure
- Mocks RPC function error
- Expects rejection with "Failed to search memories"

---

### 5. Edge Cases (5 tests)

Tests boundary conditions and special inputs:

#### ✅ Handle messages with no extractable memories
- Tests greeting message ("Привет! Как дела?")
- Returns empty result (hasMemories: false)

#### ✅ Handle extraction with markdown code blocks
- Tests JSON wrapped in ```json``` markdown
- Correctly parses and extracts memory

#### ✅ Handle very long memory content
- Tests 5000+ character content
- Validates storage without truncation

#### ✅ Handle special characters in content
- Tests email, phone, quotes in content
- Preserves special characters correctly

#### ✅ Handle Cyrillic and mixed language content
- Tests Russian + English mixed content
- Validates extraction preserves mixed text

---

### 6. Category Handling (2 tests)

Tests memory category management:

#### ✅ Handle all memory categories
- Tests all 7 categories: personal_info, health, preferences, events, interests, work, other
- Validates category preservation through storage

#### ✅ Preserve category through extraction-storage-search cycle
- Extracts memory with "health" category
- Stores and searches by category
- Validates category preservation end-to-end

---

### 7. Performance and Limits (2 tests)

Tests batch operations and limits:

#### ✅ Handle batch extraction of multiple memories
- Extracts 10 memories from single message
- Validates all memories extracted

#### ✅ Respect search limit parameter
- Tests limit=5 parameter
- Validates RPC call includes `match_limit: 5`

---

## Mock Strategy

### External API Mocks

1. **Environment Config** (`@/config/env.js`)
   - Mocks all required environment variables
   - Prevents validation errors in tests

2. **LangChain ChatOpenAI** (`@langchain/openai`)
   - Mocks `ChatOpenAI` class with configurable invoke method
   - Returns JSON-formatted extraction results

3. **BGE-M3 Embeddings** (`@/core/embeddings/index.js`)
   - Uses deterministic embedding generation
   - Counter-based unique embeddings per content
   - Cached embeddings for consistency

4. **Supabase Client** (`@/core/database.js`)
   - Mocks `from()` and `rpc()` methods
   - Simulates insert, select, and vector search operations

### Mock Helpers

- `mockExtractionResponse()`: Configures extraction to return specific memories
- `mockMemoryInsert()`: Simulates successful memory insertion
- `mockVectorSearch()`: Returns predefined search results
- `generateUniqueEmbedding()`: Creates deterministic embeddings with uniqueness guarantee

---

## Test Execution

### Run Integration Tests Only
```bash
pnpm test tests/integration/memory/memory-pipeline.test.ts
```

### Run with Verbose Output
```bash
pnpm test tests/integration/memory/memory-pipeline.test.ts --reporter=verbose
```

### Run with Coverage
```bash
pnpm test tests/integration/memory/memory-pipeline.test.ts --coverage
```

---

## Test Results Summary

**Total Tests**: 22
**Passed**: ✅ 22
**Failed**: ❌ 0
**Duration**: ~35ms

### Coverage Areas

- ✅ Memory extraction from user messages
- ✅ Embedding generation and uniqueness
- ✅ Memory storage with vector embeddings
- ✅ Semantic search and ranking
- ✅ Error handling and graceful degradation
- ✅ Edge cases (special characters, long content, Cyrillic)
- ✅ Category management across pipeline
- ✅ Batch operations and limits

---

## Dependencies

### Test Dependencies
- `vitest` 3.0.5 - Test framework
- `@langchain/openai` - Mocked LangChain integration
- `@langchain/core` - Message types

### Production Dependencies
- `@langchain/openai` 1.2.0 - LLM integration
- `@supabase/supabase-js` 2.80.0 - Database client
- `openai` 6.15.0 - OpenRouter API
- `zod` 4.2.1 - Schema validation

---

## Related Files

### Source Files
- `/home/me/code/coffee/symancy-backend/src/chains/memory-extraction.chain.ts` - Memory extraction
- `/home/me/code/coffee/symancy-backend/src/services/memory.service.ts` - Memory CRUD operations
- `/home/me/code/coffee/symancy-backend/src/core/embeddings/bge-client.ts` - BGE-M3 embeddings

### Test Helpers
- `/home/me/code/coffee/symancy-backend/tests/setup/memory-test-helpers.ts` - Test utilities

### Mocks
- `/home/me/code/coffee/symancy-backend/tests/setup/mocks/embeddings.mock.ts`
- `/home/me/code/coffee/symancy-backend/tests/setup/mocks/memory-extraction.mock.ts`
- `/home/me/code/coffee/symancy-backend/tests/setup/mocks/supabase.mock.ts`

---

## Notes

1. **Deterministic Embeddings**: Uses counter-based seeding to ensure unique embeddings while maintaining consistency for same content
2. **Russian Language Support**: Tests include Russian queries and Cyrillic content
3. **Floating Point Precision**: Cosine similarity uses `toBeCloseTo()` to handle precision errors
4. **Mock Isolation**: Each test clears mocks and resets state in `beforeEach()`
5. **No Real API Calls**: All external services (LangChain, OpenRouter, Supabase) are mocked

---

## Future Enhancements

Potential areas for additional testing:

1. **Concurrent Operations**: Test parallel memory insertion and search
2. **Database Transactions**: Test rollback scenarios
3. **Rate Limiting**: Test OpenRouter API rate limit handling
4. **Retry Logic**: Test exponential backoff for embeddings
5. **Memory Deduplication**: Test duplicate memory detection
6. **Context Window**: Test memory retrieval with conversation context

---

**Author**: Claude Code Test Writer Agent
**Last Updated**: 2025-12-27
**Test File Version**: 1.0.0
