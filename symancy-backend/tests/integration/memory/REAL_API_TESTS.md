# Real API Integration Tests

This directory contains optional integration tests that run against real APIs (OpenRouter, Supabase) for pre-production validation.

## Purpose

These tests are designed to:
- Validate the memory system against real APIs before production deployment
- Catch API compatibility issues that mocks might miss
- Verify end-to-end flows with actual network latency and API responses
- Test multilingual capabilities with real LLM and embedding models

## Files

- `memory-real-api.test.ts` - Real API integration test suite
- `run-real-api-tests.sh` - Helper script to run tests with environment setup

## Running Tests

### Option 1: Using Helper Script (Recommended)

```bash
./scripts/run-real-api-tests.sh
```

The script will:
1. Load environment variables from `.env`
2. Verify required credentials are present
3. Show warnings about API costs and database writes
4. Ask for confirmation before running
5. Execute tests with proper flags

### Option 2: Direct Execution

```bash
REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts
```

### Option 3: Run Specific Test

```bash
REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts -t "should generate real 1024-dim embedding"
```

## Requirements

### Environment Variables

The following must be set in your `.env` file or environment:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### Database Setup

The tests expect:
- `user_memories` table with pgvector support
- `search_user_memories` RPC function for vector search
- Proper indexes on embeddings

See migration files in `supabase/migrations/` for setup.

## Test Coverage

### 1. BGE Embeddings Tests
- Generate real 1024-dim embeddings from OpenRouter
- Verify embedding consistency for same text
- Test multilingual support (Russian, English, Chinese)

### 2. Memory Extraction Tests
- Extract memories from Russian text using real LLM
- Handle greetings and non-memorable content
- Categorize health, work, and personal information

### 3. Supabase Storage Tests
- Store memories with embeddings in database
- Search memories by semantic similarity
- Test vector search accuracy

### 4. End-to-End Flow Tests
- Complete lifecycle: extract → store → search
- Multilingual extraction and cross-language search
- Real-world conversation scenarios

### 5. Error Handling Tests
- Rate limiting with retry logic
- Malformed API responses
- Edge case inputs

## Cost & Performance

### Estimated Costs (per full test run)
- OpenRouter API calls: ~$0.01-0.05
  - BGE embeddings: ~10-15 calls (~$0.001 each)
  - Qwen 2.5 72B extraction: ~5-8 calls (~$0.002-0.005 each)
- Supabase: Free tier (unless excessive usage)

### Execution Time
- Full test suite: 5-10 minutes
- Individual test: 30-120 seconds (depends on API latency)

## CI/CD Integration

### Default Behavior (CI)
Tests are **skipped by default** in CI/CD pipelines because `REAL_API_TESTS` is not set.

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: pnpm test  # Real API tests are skipped
```

### Manual CI Run (Optional)
To run in CI manually:

```yaml
- name: Run Real API Tests
  if: github.event_name == 'workflow_dispatch'  # Manual trigger only
  env:
    REAL_API_TESTS: true
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: pnpm test tests/integration/memory/memory-real-api.test.ts
```

### Pre-Production Validation
Recommended to run before major releases:

```bash
# Before production deploy
./scripts/run-real-api-tests.sh

# If all pass, deploy with confidence
pnpm build && pnpm deploy
```

## Cleanup

Tests automatically clean up created data in `afterAll` hook:
- All test memories are deleted from database
- Uses unique test user ID (888888888) to avoid conflicts
- Cleanup runs even if tests fail

## Troubleshooting

### "Missing required environment variables"
- Ensure `.env` file exists with all required keys
- Check variable names match exactly (case-sensitive)
- Run `source .env` manually and retry

### "Failed to generate embedding after X attempts"
- Check OpenRouter API key is valid
- Verify API quota/credits are available
- Check network connectivity

### "Failed to search memories"
- Verify Supabase URL and service key
- Check `search_user_memories` RPC function exists
- Ensure pgvector extension is enabled

### Tests timeout
- Increase timeout in vitest.config.ts if needed
- Check API latency (OpenRouter may be slow during peak hours)
- Run tests with fewer parallel tests: `pnpm test --poolOptions.threads.singleThread`

## Best Practices

1. **Run before production deploys** - Catch API issues early
2. **Monitor costs** - Check OpenRouter usage after test runs
3. **Review logs** - Tests output detailed execution traces
4. **Update regularly** - Keep tests in sync with API changes
5. **Don't run in CI by default** - Save costs, use mocks instead

## Example Output

```
🔬 Memory System Real API Integration Tests
==============================================

⚠️  WARNING: These tests will:
  • Consume OpenRouter API credits (~$0.01-0.05)
  • Write to real Supabase database
  • Take 5-10 minutes to complete

✓ Loading environment from .env
✓ All required environment variables are set

Continue with real API tests? (y/N) y

Running tests...

 ✓ tests/integration/memory/memory-real-api.test.ts (12)
   ✓ Memory System - Real API Integration (12)
     ✓ Real BGE Embeddings (3)
       ✓ should generate real 1024-dim embedding from OpenRouter
       ✓ should generate consistent embeddings for same text
       ✓ should handle Russian, English, and Chinese text
     ✓ Real Memory Extraction (4)
       ✓ should extract memories from Russian text using real LLM
          Extracted memories:
            [personal_info] User's name is Алексей
            [personal_info] User is 35 years old
            [work] User works as a programmer
       ✓ should return empty for greetings
       ✓ should extract health information
       ✓ should categorize work-related information
     ✓ Real Supabase Memory Storage (2)
       ✓ should store and retrieve memory from real database
       ✓ should search memories by semantic similarity
     ✓ Real End-to-End Flow (2)
       ✓ should complete full memory lifecycle with real APIs
       ✓ should handle multilingual extraction and search
     ✓ Real Error Handling (2)
       ✓ should handle rate limiting gracefully
       ✓ should handle malformed extraction responses

🧹 Cleaning up 15 test memories...
✓ Test cleanup completed

Test Files  1 passed (1)
     Tests  12 passed (12)
  Start at  15:30:00
  Duration  8m 23s

✅ Real API tests completed!

💡 Tip: Review test output above for any warnings or errors
```

## See Also

- `tests/integration/memory/memory-pipeline.test.ts` - Mock-based integration tests (fast, free)
- `tests/unit/embeddings/` - Unit tests for embedding client
- `tests/unit/chains/memory-extraction.chain.test.ts` - Unit tests for extraction logic
