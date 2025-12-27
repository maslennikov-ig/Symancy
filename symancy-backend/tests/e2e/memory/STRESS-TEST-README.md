# Memory System Stress Tests

## Overview

Stress tests validate the memory system's behavior under extreme load conditions. These tests handle **10,000+ memories** to ensure production scalability.

**IMPORTANT**: These tests are automatically **SKIPPED in CI** due to execution time (~66 seconds). Run manually for performance validation.

## Test Coverage

### STRESS-001: 10,000 Memory Insertions
- **Purpose**: Validate insertion performance degradation
- **Method**: Adds 10,000 memories in batches of 100
- **Metrics**: Average batch time, min/max time, degradation %
- **Success Criteria**: < 50% performance degradation (first quarter vs last quarter)
- **Duration**: ~1.4 seconds

### STRESS-002: Search with 10,000 Memories
- **Purpose**: Verify search efficiency with large datasets
- **Method**: Pre-populate 10,000 memories, perform 10 searches
- **Metrics**: Average/min/max search time
- **Success Criteria**: Average < 500ms, Max < 1000ms
- **Duration**: ~1.1 seconds

### STRESS-003: Concurrent Operations
- **Purpose**: Test system stability under concurrent load
- **Method**: 50 concurrent operations (25 adds + 25 searches)
- **Metrics**: Success/failure count, total time
- **Success Criteria**: 0 failures, < 1000ms total time
- **Duration**: ~113ms

### STRESS-004: Memory Cleanup
- **Purpose**: Validate cleanup performance
- **Method**: Add 5,000 memories, then cleanup
- **Metrics**: Cleanup time
- **Success Criteria**: Cleanup < 100ms
- **Duration**: ~21 seconds

### STRESS-005: Search Performance at Scale
- **Purpose**: Maintain search speed with 10k memories
- **Method**: Add 10,000 memories, perform 10 searches
- **Metrics**: Average/min/max search time
- **Success Criteria**: Average < 500ms, Max < 1000ms
- **Duration**: ~42 seconds

## Running Stress Tests

### Run All Stress Tests
```bash
pnpm test memory-stress
```

### Run Specific Test
```bash
pnpm test memory-stress -t "STRESS-001"
pnpm test memory-stress -t "STRESS-002"
```

### Run with Verbose Output
```bash
pnpm test memory-stress --reporter=verbose
```

### Run in Watch Mode (for development)
```bash
pnpm test memory-stress --watch
```

## Performance Monitoring

### During Test Execution

1. **Console Output**: Live progress updates every 10 batches
2. **Timing Metrics**: Real-time performance measurements
3. **Memory Usage**: Monitor system RAM with `htop` or Activity Monitor

### Example Output

```
📊 STRESS-001: Adding 10000 memories in batches of 100...
   Started at: 2025-12-27T13:23:37.569Z
   Batch 10/100: 12.7ms
   Batch 20/100: 15.7ms
   ...
   Batch 100/100: 14.3ms

📊 STRESS-001 Results:
   Total memories: 10000
   Overall time: 1.42s
   Average batch time: 14.2ms
   Min batch time: 10.6ms
   Max batch time: 20.5ms
   First quarter avg: 15.7ms
   Last quarter avg: 13.5ms
   Performance degradation: -14.1%
   Completed at: 2025-12-27T13:23:38.990Z
```

## Expected Results

### Performance Benchmarks

| Test | Metric | Expected | Actual (Last Run) |
|------|--------|----------|-------------------|
| STRESS-001 | Degradation | < 50% | -14.1% ✅ |
| STRESS-002 | Avg Search | < 500ms | 5.4ms ✅ |
| STRESS-003 | Failures | 0 | 0 ✅ |
| STRESS-004 | Cleanup | < 100ms | 0.0ms ✅ |
| STRESS-005 | Avg Search | < 500ms | 5.3ms ✅ |

### Total Execution Time

- **All 5 tests**: ~66 seconds
- **CI**: Tests are skipped automatically
- **Manual**: Run before production deployments

## System Requirements

### Minimum Specs
- **RAM**: 4GB available
- **CPU**: 4 cores recommended
- **Disk**: 1GB free space

### Recommended Specs
- **RAM**: 8GB+ available
- **CPU**: 8+ cores for optimal performance
- **Disk**: 2GB+ free space

## Troubleshooting

### Test Timeout Errors

```bash
# Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 120_000, // 2 minutes per test
  },
});
```

### Memory Issues (OOM)

```bash
# Reduce MEMORY_COUNT in test file
const MEMORY_COUNT = 5_000; // Instead of 10,000
```

### Concurrent Operation Failures

```bash
# Reduce concurrent ops in STRESS-003
const operations = 25; // Instead of 50
```

## Mock Architecture

### In-Memory Storage
- **memoryStore**: Map<string, any[]> for fast operations
- **mockSupabaseClient**: Simulates Supabase DB with ~1-2ms delay
- **mockGetEmbedding**: Generates random 1024-dim vectors with ~2-5ms delay

### Performance Characteristics
- **Insertion**: ~1ms DB delay + ~3ms embedding
- **Search**: ~2ms RPC delay + random similarity ranking
- **Concurrency**: No locks, parallel operations supported

## CI/CD Integration

### Skip in CI
```typescript
describe.skipIf(process.env.CI === 'true')('Memory Stress Tests', () => {
  // Tests automatically skipped in GitHub Actions
});
```

### Manual Trigger
```bash
# Force run in CI (not recommended)
CI=false pnpm test memory-stress
```

## Best Practices

### Before Production Deployment
1. Run all stress tests: `pnpm test memory-stress`
2. Verify 0 failures
3. Check degradation < 50%
4. Monitor system resources

### Performance Regression
1. Compare results with previous runs
2. Investigate if degradation > 20%
3. Profile slow batches with Vitest profiler

### Scaling Beyond 10k
1. Increase `MEMORY_COUNT` incrementally (20k, 50k, 100k)
2. Monitor RAM usage
3. Adjust `BATCH_SIZE` for optimal throughput

## Related Documentation

- [Memory E2E Tests](./memory-e2e.test.ts)
- [Memory Performance Tests](./memory-performance.test.ts)
- [Memory Edge Cases](./memory-edge-cases.test.ts)
- [Test Constants](../../setup/test-constants.ts)

## Changelog

### 2025-12-27
- ✅ Initial implementation with 5 stress tests
- ✅ All tests passing (66s total runtime)
- ✅ CI skip condition added
- ✅ Performance benchmarks established
