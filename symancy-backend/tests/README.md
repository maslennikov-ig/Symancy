# Symancy Backend Tests

Comprehensive test suite for the Symancy backend, including unit tests, integration tests, and optional real API tests.

## Quick Start

```bash
# Run all tests (mocked - fast, free)
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

## Directory Structure

```
tests/
├── README.md                          # This file
├── unit/                              # Unit tests (isolated, fast)
│   ├── chains/                        # Chain tests (memory extraction)
│   ├── embeddings/                    # BGE-M3 embedding client tests
│   └── services/                      # Service layer tests
├── integration/                       # Integration tests (multiple components)
│   └── memory/                        # Memory system integration tests
│       ├── README.md                  # Memory tests documentation
│       ├── memory-pipeline.test.ts    # Mocked pipeline tests
│       ├── chat-memory.test.ts        # Chat + memory integration
│       └── memory-real-api.test.ts    # Real API tests (optional)
├── e2e/                               # End-to-end tests (coming soon)
└── setup/                             # Test utilities and mocks
    ├── README.md                      # Setup documentation
    ├── vitest.setup.ts               # Global test setup
    ├── test-constants.ts             # Centralized test constants
    ├── memory-test-helpers.ts        # Memory testing utilities
    ├── mock-factories.ts             # Factory functions for mocks
    └── mocks/                        # Mock implementations
        ├── embeddings.mock.ts        # BGE-M3 embeddings mock
        ├── memory-extraction.mock.ts # Memory extraction mock
        ├── openrouter.mock.ts        # OpenRouter API mock
        ├── supabase.mock.ts          # Supabase client mock
        └── telegram.mock.ts          # Telegram bot mock
```

## Test Types

### Unit Tests (Default)

Fast, isolated tests with all external dependencies mocked.

```bash
pnpm test:unit
```

**Characteristics:**
- Run in < 1 second
- No API costs
- Run in CI automatically
- Test individual functions/modules

### Integration Tests (Default)

Tests that verify multiple components work together, with external APIs mocked.

```bash
pnpm test:integration
```

**Characteristics:**
- Run in < 5 seconds
- No API costs
- Run in CI automatically
- Test component interactions

### Real API Tests (Optional)

Tests that run against actual APIs for pre-production validation.

```bash
# Using helper script (recommended)
./scripts/run-real-api-tests.sh

# Direct execution
REAL_API_TESTS=true pnpm vitest run tests/integration/memory/memory-real-api.test.ts
```

**Characteristics:**
- Run in 5-10 minutes
- Consume API credits (~$0.01-0.05 per run)
- Write to real Supabase database
- **Skipped in CI by default**
- Run manually before production deploys

**Prerequisites:**
```env
# Required in .env file
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

**See:** [`tests/integration/memory/README.md`](./integration/memory/README.md) for detailed documentation.

## Test Configuration

### Vitest Setup

Tests use Vitest with the following configuration:

- **Test timeout**: 5s (unit), 15s (integration), 60s (real API)
- **Parallel execution**: Enabled for mocked tests
- **Path aliases**: `@/` maps to `src/`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REAL_API_TESTS` | No | Set to `true` to enable real API tests |
| `DEBUG_TESTS` | No | Set to `true` for verbose test output |

### Test Constants

All magic numbers and thresholds are centralized in `tests/setup/test-constants.ts`:

```typescript
import {
  TIMEOUT_UNIT,           // 5000ms
  TIMEOUT_INTEGRATION,    // 15000ms
  TIMEOUT_REAL_API,       // 60000ms
  EMBEDDING_DIMS,         // 1024
  TEST_USER_ID,           // 999999999
} from '../setup/test-constants.js'
```

## Writing Tests

### Use Mock Factories

Prefer factory functions over inline mock objects:

```typescript
import {
  createMockSupabaseClient,
  createMockMemory,
  createMockEmbeddingResult,
} from '../setup/mock-factories.js'

const supabase = createMockSupabaseClient({
  selectData: [createMockMemory({ content: "Test" })],
})
```

### Use Test Helpers

```typescript
import {
  TEST_USER_ID,
  cosineSimilarity,
  generateDeterministicEmbedding,
} from '../setup/memory-test-helpers.js'
```

### Test User IDs

Use dedicated test user IDs to avoid conflicts:

| ID | Purpose |
|----|---------|
| `999999999` | Primary test user |
| `999999998` | Secondary test user |
| `888888888` | Real API tests only |

## CI/CD Integration

### Default CI Behavior

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: pnpm test  # Runs mocked tests only
```

### Manual Real API Tests (Optional)

```yaml
- name: Run Real API Tests
  if: github.event_name == 'workflow_dispatch'
  env:
    REAL_API_TESTS: true
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: pnpm test tests/integration/memory/memory-real-api.test.ts
```

## Troubleshooting

### Tests Timeout

```bash
# Increase timeout for specific tests
pnpm vitest run --testTimeout=30000 tests/integration/

# Run with single thread
pnpm vitest run --poolOptions.threads.singleThread
```

### Real API Tests Skipped

Ensure `REAL_API_TESTS=true` is set:

```bash
REAL_API_TESTS=true pnpm vitest run tests/integration/memory/memory-real-api.test.ts
```

### Mock Not Working

1. Check import path uses `.js` extension (ESM)
2. Clear Vitest cache: `pnpm vitest --clearCache`
3. Verify mock is hoisted with `vi.mock()` at module level

### Database Cleanup

For real API tests, manually clean test data if needed:

```sql
DELETE FROM user_memories WHERE telegram_user_id = 888888888;
```

## Documentation

- [`tests/setup/README.md`](./setup/README.md) - Mock factories and helpers
- [`tests/integration/memory/README.md`](./integration/memory/README.md) - Memory tests
- [`tests/integration/memory/REAL_API_TESTS.md`](./integration/memory/REAL_API_TESTS.md) - Real API tests
- [`docs/testing/`](../docs/testing/) - Additional testing documentation
