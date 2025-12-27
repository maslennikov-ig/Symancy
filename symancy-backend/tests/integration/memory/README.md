# Memory Integration Tests

This directory contains integration tests for the memory system in the chat chain.

## Test Files

### chat-memory.test.ts (28 tests)
Tests the integration between `chat.chain.ts` and `memory.service.ts` using mocks.

**Coverage:**
- Memory search integration (3 tests)
- Memory context formatting (6 tests)
- Error handling (6 tests)
- Chat history integration (2 tests)
- Memory content scenarios (4 tests)
- Response verification (3 tests)
- Language/user options (4 tests)
- Non-blocking behavior (2 tests)

**Run tests:**
```bash
pnpm test tests/integration/memory/chat-memory.test.ts
```

**Status:** ✅ All 28 tests passing (63ms)

### memory-pipeline.test.ts
Tests the complete memory pipeline with mocked external services.

**Run tests:**
```bash
pnpm test tests/integration/memory/memory-pipeline.test.ts
```

### memory-real-api.test.ts (OPTIONAL - Real APIs)
Tests memory system against **real APIs** (OpenRouter, Supabase) for pre-production validation.

**⚠️ WARNING:** These tests:
- Consume OpenRouter API credits (~$0.01-0.05 per run)
- Write to real Supabase database
- Take 5-10 minutes to complete
- **Skip by default in CI/CD**

**Run tests:**
```bash
# Option 1: Using helper script (recommended)
./scripts/run-real-api-tests.sh

# Option 2: Direct execution
REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts
```

**See:** `REAL_API_TESTS.md` for detailed documentation

## Test Strategy

### Mock Tests (Default)
- Fast execution (< 1 second)
- No API costs
- Run in CI/CD automatically
- Test internal logic and integrations

**Files:** `chat-memory.test.ts`, `memory-pipeline.test.ts`

### Real API Tests (Optional)
- Slow execution (5-10 minutes)
- Consumes API credits
- Run manually before production deploys
- Validates against real APIs

**Files:** `memory-real-api.test.ts`

## Documentation

- `REAL_API_TESTS.md` - Real API tests documentation
- `/home/me/code/coffee/symancy-backend/docs/testing/chat-memory-integration-tests.md` - Chat memory tests documentation
