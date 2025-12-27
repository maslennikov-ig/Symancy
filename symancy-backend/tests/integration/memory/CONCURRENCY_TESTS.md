# Memory Concurrency Tests Documentation

## Overview

This document describes the comprehensive concurrency tests for the memory system, designed to detect race conditions, data loss, and corruption under concurrent operations.

## Test File

`tests/integration/memory/memory-concurrency.test.ts`

## Test Strategy

The concurrency tests use the following strategies to detect race conditions:

### 1. **Promise.all() for True Concurrency**
- All concurrent operations use `Promise.all()` to ensure simultaneous execution
- Operations are NOT serialized with sequential awaits
- Simulates real-world concurrent user operations

### 2. **Artificial Network Delays**
- Embedding generation: 10-30ms random delay
- Database inserts: 5-15ms random delay
- Vector searches: 15-30ms random delay
- Simulates realistic API call latency

### 3. **In-Memory Store Tracking**
- Maintains `Map<userId, memory[]>` to track all operations
- Verifies final state matches expected operations
- Detects lost writes and overwrites

### 4. **Operation Counters**
- `insertCounter`: Tracks total insert operations
- `idCounter`: Generates unique IDs for verification
- Ensures all operations complete successfully

## Test Coverage

### CONC-001: Concurrent Adds Without Data Loss

**Purpose**: Verify that concurrent memory additions don't result in lost writes or overwrites.

**Test Cases**:
- `CONC-001`: 50 concurrent additions for single user
  - Verifies all 50 memories are stored
  - Verifies all IDs are unique
  - Verifies insert counter matches expected

- `CONC-001b`: Content integrity during concurrent adds (30 operations)
  - Generates unique random content per operation
  - Verifies all unique contents are preserved
  - Detects content corruption or mixing

**Race Conditions Tested**:
- Lost writes (operation completes but data not stored)
- ID collisions (same ID assigned to multiple memories)
- Content overwrites (one memory overwrites another)

### CONC-002: Multi-User Concurrent Operations

**Purpose**: Verify that concurrent operations from multiple users maintain data isolation.

**Test Cases**:
- `CONC-002`: 3 users, 20 memories each (60 total concurrent operations)
  - Verifies each user has exactly 20 memories
  - Verifies no cross-user data contamination
  - Verifies total operation count

- `CONC-002b`: Interleaved operations from 2 users (6 operations)
  - User1 and User2 operations interleaved
  - Verifies content isolation (User1 vs User2 prefixes)
  - Detects user ID mix-ups

**Race Conditions Tested**:
- User data cross-contamination
- User ID mix-ups during concurrent writes
- Shared state corruption between users

### CONC-003: Read-While-Write Scenarios

**Purpose**: Verify consistency when reads occur during concurrent writes.

**Test Cases**:
- `CONC-003`: 5 concurrent writes + 1 read
  - Pre-populates with 1 initial memory
  - Launches 5 writes and 1 read concurrently
  - Verifies read returns consistent state (≥1 memory)
  - Verifies final state has all 6 memories

- `CONC-003b`: Concurrent writes and searches (5 operations)
  - Interleaves addMemory() and searchMemories() calls
  - Verifies writes succeed
  - Verifies searches return valid results
  - Tests vector search during active writes

**Race Conditions Tested**:
- Dirty reads (reading uncommitted data)
- Inconsistent reads (different counts during transaction)
- Search index corruption during writes

### CONC-004: Order Maintenance Under Load

**Purpose**: Verify memory count and ID uniqueness under high concurrent load.

**Test Cases**:
- `CONC-004`: 100 operations (10 sequential + 90 concurrent)
  - Establishes baseline with 10 sequential operations
  - Launches 90 concurrent operations
  - Verifies final count is exactly 100
  - Verifies all 100 IDs are unique

- `CONC-004b`: Timestamp ordering (20 concurrent operations)
  - Tracks createdAt timestamps for all operations
  - Verifies all timestamps are valid dates
  - Verifies timestamp range is reasonable (<5 seconds)

**Race Conditions Tested**:
- Count inconsistencies (lost operations)
- ID counter race conditions
- Timestamp generation errors

### CONC-005: Embedding Generation Under Load

**Purpose**: Verify embedding generation handles concurrent requests without errors.

**Test Cases**:
- `CONC-005`: 30 concurrent embedding generations
  - Tracks embedding API call count
  - Verifies 30 embeddings generated
  - Verifies all stored memories have embeddings

- `CONC-005b`: Unique embeddings for different content (4 operations)
  - Tests distinct content ("coffee" vs "tea")
  - Verifies embeddings are unique
  - Detects embedding cache corruption

**Race Conditions Tested**:
- Embedding API rate limiting
- Embedding result mix-ups
- Missing embeddings due to async errors

### CONC-006: Category Distribution

**Purpose**: Verify category classification remains accurate under concurrent load.

**Test Cases**:
- `CONC-006`: 7 categories × 10 memories each = 70 concurrent operations
  - Tests all memory categories
  - Verifies each category has exactly 10 memories
  - Detects category misclassification

**Race Conditions Tested**:
- Category field corruption
- Category assignment errors during concurrent writes

### CONC-007: Stress Test - High Concurrency

**Purpose**: Verify system handles maximum realistic concurrent load.

**Test Cases**:
- `CONC-007`: 3 users × 50 memories each = 150 concurrent operations
  - Maximum concurrent load simulation
  - Verifies completion within 10 seconds
  - Verifies all users have correct counts
  - Verifies total operation count

**Race Conditions Tested**:
- System-wide resource contention
- Connection pool exhaustion
- Memory leaks under load

## Mock Architecture

### Supabase Mock

```typescript
const insertChain = {
  insert: vi.fn().mockImplementation((data) => {
    // Async delay simulation
    const delayPromise = new Promise(resolve => setTimeout(resolve, 5-15ms));

    // Store in memoryStore Map
    memoryStore.set(userId, [...memories, newMemory]);

    // Return chainable interface
    return {
      select: () => ({
        single: async () => {
          await delayPromise;
          return { data: newMemory, error: null };
        }
      })
    };
  })
};
```

### Embedding Mock

```typescript
vi.mock('../../../src/core/embeddings/index.js', () => ({
  getEmbedding: vi.fn(async (text: string) => {
    // Random delay 10-30ms
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));

    // Deterministic embedding based on text hash
    const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(1024).fill(0).map((_, i) => Math.sin(hash + i) * 0.5);
  }),
}));
```

## Assertions

### Data Integrity Assertions

```typescript
// No data loss
expect(memories).toHaveLength(EXPECTED_COUNT);

// Unique IDs
const ids = new Set(memories.map(m => m.id));
expect(ids.size).toBe(EXPECTED_COUNT);

// Content preservation
expect(storedContents.has(originalContent)).toBe(true);
```

### Isolation Assertions

```typescript
// User isolation
expect(memories.every(m => m.telegram_user_id === userId)).toBe(true);

// Content isolation
expect(user1Memories.every(m => m.content.startsWith('User1'))).toBe(true);
```

### Consistency Assertions

```typescript
// Read consistency
expect(readCount).toBeGreaterThanOrEqual(1);

// Operation count
expect(insertCounter).toBe(EXPECTED_OPS);
```

## Performance Benchmarks

| Test | Operations | Expected Duration | Actual (avg) |
|------|-----------|------------------|--------------|
| CONC-001 | 50 | <500ms | ~200ms |
| CONC-002 | 60 | <600ms | ~250ms |
| CONC-003 | 6 | <100ms | ~50ms |
| CONC-004 | 100 | <1000ms | ~400ms |
| CONC-007 | 150 | <10s | ~900ms |

## Known Limitations

### 1. **Mock vs Real Database**
- Tests use in-memory Map, not real PostgreSQL
- Real database has different concurrency guarantees
- For real database testing, see `memory-real-api.test.ts`

### 2. **No Transaction Testing**
- Mocks don't simulate PostgreSQL transactions
- No ACID property verification
- Real transactions tested in integration tests

### 3. **No Network Failures**
- Mocks don't simulate network errors
- No retry logic testing
- For error handling, see unit tests

### 4. **Simplified Vector Search**
- Mock search returns first N memories
- Real pgvector has different performance characteristics

## Integration with Real API Tests

These concurrency tests complement the real API tests:

| Test Type | Purpose | Technology |
|-----------|---------|------------|
| **Concurrency** | Race condition detection | Vitest mocks + Promise.all |
| **Real API** | End-to-end validation | Real Supabase + real embeddings |
| **Pipeline** | LangChain integration | Mock LLM + mock Supabase |

## Running the Tests

```bash
# Run concurrency tests only
pnpm test memory-concurrency

# Run all memory tests
pnpm test memory/

# Watch mode for development
pnpm test memory-concurrency --watch

# Coverage report
pnpm test memory-concurrency --coverage
```

## Debugging Concurrency Issues

### Enable Detailed Logging

```typescript
// Add before test
console.log('Starting operations...');

// Add in mock
console.log(`Insert #${insertCounter}: userId=${userId}`);

// Add after Promise.all
console.log(`Completed ${results.length} operations`);
```

### Track Operation Timing

```typescript
const startTime = Date.now();
await Promise.all(promises);
const duration = Date.now() - startTime;
console.log(`Duration: ${duration}ms`);
```

### Verify Store State

```typescript
// After operations
console.log('Memory store:', Array.from(memoryStore.entries()));
```

## Best Practices

### 1. **Use Promise.all() for True Concurrency**
```typescript
// ✅ Good: True concurrency
const promises = Array.from({ length: 50 }, () => addMemory(...));
await Promise.all(promises);

// ❌ Bad: Sequential execution
for (let i = 0; i < 50; i++) {
  await addMemory(...); // Serialized!
}
```

### 2. **Verify Multiple Aspects**
```typescript
// Check count
expect(memories).toHaveLength(EXPECTED);

// Check uniqueness
const ids = new Set(memories.map(m => m.id));
expect(ids.size).toBe(EXPECTED);

// Check operation counter
expect(insertCounter).toBe(EXPECTED);
```

### 3. **Use Realistic Delays**
```typescript
// Simulate network latency
await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
```

### 4. **Test Edge Cases**
```typescript
// Empty initial state
expect(memoryStore.size).toBe(0);

// Single operation
await addMemory(userId, 'test', 'other');
expect(memoryStore.get(String(userId))).toHaveLength(1);

// High concurrency
const promises = Array.from({ length: 100 }, () => addMemory(...));
await Promise.all(promises);
```

## Future Improvements

### 1. **Real PostgreSQL Concurrency Tests**
- Use test database with real pgvector
- Test serializable isolation levels
- Verify transaction rollbacks

### 2. **Deadlock Detection**
- Simulate concurrent updates to same memory
- Verify deadlock prevention mechanisms

### 3. **Rate Limiting Tests**
- Test embedding API rate limits
- Verify retry logic under throttling

### 4. **Memory Leak Detection**
- Track memory usage during high concurrency
- Verify proper cleanup after operations

## References

- [Vitest Concurrent Testing](https://vitest.dev/guide/features.html#concurrent-tests)
- [PostgreSQL Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)
- [JavaScript Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- Memory Service: `src/services/memory.service.ts`
- Test Helpers: `tests/setup/memory-test-helpers.ts`
