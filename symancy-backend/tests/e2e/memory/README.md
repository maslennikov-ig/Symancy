# Memory System Performance Tests

Comprehensive performance test suite for the Memory System in Symancy Backend.

## Overview

This test suite validates latency and throughput requirements for production deployment using **mocked external APIs** to focus on code path efficiency.

## Test Coverage

### PERF-001: Embedding Generation Latency
- **Purpose**: Measure embedding generation performance
- **Method**: Generate embeddings for 5 different text inputs
- **Target**: Average < 100ms, Max < 200ms
- **Notes**: Uses mocked OpenRouter API

### PERF-002: Memory Extraction Latency
- **Purpose**: Measure LLM-based memory extraction performance
- **Method**: Extract memories from 3 different messages (Russian + English)
- **Target**: Average < 100ms, Max < 200ms
- **Notes**: Uses mocked Qwen 2.5 72B LLM

### PERF-003: Memory Search with Large Datasets
- **Purpose**: Validate vector search performance with many memories
- **Method**: Add 50 memories, then perform 3 searches
- **Target**: Average < 100ms, Max < 200ms
- **Notes**: Tests pgvector search efficiency

### PERF-004: Concurrent Memory Operations
- **Purpose**: Measure parallel operation performance
- **Method**: 10 concurrent adds + 10 concurrent searches
- **Target**: Both < 500ms total
- **Notes**: Tests Promise.all parallelism

### PERF-005: End-to-End Flow Latency
- **Purpose**: Measure complete memory lifecycle
- **Method**: Extract → Add → Search for 3 scenarios
- **Target**: Average < 300ms, Max < 500ms
- **Notes**: Real-world usage pattern

### PERF-006: Memory Retrieval with Large Result Sets
- **Purpose**: Test getAllMemories with many records
- **Method**: Retrieve 100 memories, 5 iterations
- **Target**: Average < 100ms, Max < 200ms
- **Notes**: Database pagination efficiency

### PERF-007: Batch Embedding Generation
- **Purpose**: Measure sequential embedding generation
- **Method**: Generate 20 embeddings
- **Target**: Total < 2s, Average < 100ms per embedding
- **Notes**: Tests current sequential implementation

### PERF-008: Stress Test - High Concurrency
- **Purpose**: Validate system under high load
- **Method**: 50 concurrent operations (25 adds + 25 searches)
- **Target**: All succeed, total < 1s
- **Notes**: Error handling and race condition testing

### PERF-009: Rapid Sequential Additions
- **Purpose**: Check for performance degradation over time
- **Method**: 20 rapid sequential memory additions
- **Target**: < 50% degradation between first/second half
- **Notes**: Memory leak and resource exhaustion detection

### PERF-010: Search with Varying Result Limits
- **Purpose**: Measure search performance with different limit values
- **Method**: Search with limits: 5, 10, 20, 50
- **Target**: All < 100ms
- **Notes**: Validates limit parameter doesn't significantly impact performance

## Running Tests

```bash
# Run all performance tests
pnpm test tests/e2e/memory/memory-performance.test.ts

# Run with verbose output
pnpm test tests/e2e/memory/memory-performance.test.ts --reporter=verbose

# Run specific test
pnpm test tests/e2e/memory/memory-performance.test.ts -t "PERF-001"
```

## Mock Strategy

All external APIs are mocked to ensure tests are:
1. **Fast**: No real network calls
2. **Reliable**: No external service dependencies
3. **Deterministic**: Consistent results
4. **Focused**: Testing code path efficiency only

### Mocked Components

- **OpenRouter API** (BGE-M3 embeddings): 5-10ms simulated delay
- **Qwen 2.5 72B LLM** (memory extraction): 20-30ms simulated delay
- **Supabase PostgreSQL** (vector search, CRUD): 2-5ms simulated delay

### Realistic Delays

Mocks include small delays to simulate real-world conditions:
- Embedding generation: 5-10ms
- Memory extraction: 20-30ms
- Database insert: 2-5ms
- Vector search: 5-10ms

## Performance Baselines

These are **target baselines** for mocked performance:

| Test | Average | Max |
|------|---------|-----|
| PERF-001 | < 100ms | < 200ms |
| PERF-002 | < 100ms | < 200ms |
| PERF-003 | < 100ms | < 200ms |
| PERF-004 | < 500ms | < 1s |
| PERF-005 | < 300ms | < 500ms |
| PERF-006 | < 100ms | < 200ms |
| PERF-007 | < 2s total | < 100ms/each |
| PERF-008 | < 1s total | 100% success |
| PERF-009 | < 100ms avg | < 50% degradation |
| PERF-010 | < 100ms | < 200ms |

## CI/CD Integration

Performance tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run Performance Tests
  run: pnpm test tests/e2e/memory/memory-performance.test.ts
```

## Notes

- **Production Latency**: Real-world latency will be higher due to:
  - Actual OpenRouter API latency (50-200ms for embeddings)
  - Actual LLM inference latency (500-2000ms for Qwen 2.5 72B)
  - Network latency (10-100ms depending on region)
  - Database latency (5-50ms depending on load)

- **Optimization Opportunities**:
  - Batch embedding generation (PERF-007) could use `getEmbeddings()` for parallel processing
  - Caching frequently used embeddings
  - Connection pooling optimization
  - Query optimization for getAllMemories

- **Monitoring**: Consider adding these tests to performance regression tracking tools (e.g., Lighthouse CI, Grafana)

## Related Documentation

- [Memory Service](/home/me/code/coffee/symancy-backend/src/services/memory.service.ts)
- [Memory Extraction Chain](/home/me/code/coffee/symancy-backend/src/chains/memory-extraction.chain.ts)
- [BGE-M3 Embeddings Client](/home/me/code/coffee/symancy-backend/src/core/embeddings/bge-client.ts)
- [Unit Tests - Memory Service](/home/me/code/coffee/symancy-backend/tests/unit/services/memory.service.test.ts)
