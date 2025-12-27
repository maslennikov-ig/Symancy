#!/bin/bash
# Run real API tests (requires .env with API keys)
# Usage: ./scripts/run-real-api-tests.sh

set -e

echo "🔬 Memory System Real API Integration Tests"
echo "=============================================="
echo ""
echo "⚠️  WARNING: These tests will:"
echo "  • Consume OpenRouter API credits (~$0.01-0.05)"
echo "  • Write to real Supabase database"
echo "  • Take 5-10 minutes to complete"
echo ""
echo "Required environment variables:"
echo "  • OPENROUTER_API_KEY"
echo "  • SUPABASE_URL"
echo "  • SUPABASE_SERVICE_KEY"
echo ""

# Load environment variables from .env if it exists
if [ -f .env ]; then
  echo "✓ Loading environment from .env"
  set -a
  source .env
  set +a
else
  echo "⚠️  .env file not found, using existing environment variables"
fi

# Verify required env vars
REQUIRED_VARS=("OPENROUTER_API_KEY" "SUPABASE_URL" "SUPABASE_SERVICE_KEY")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo ""
  echo "❌ ERROR: Missing required environment variables:"
  for VAR in "${MISSING_VARS[@]}"; do
    echo "  • $VAR"
  done
  echo ""
  echo "Please set these in your .env file or environment."
  exit 1
fi

echo "✓ All required environment variables are set"
echo ""

# Ask for confirmation
read -p "Continue with real API tests? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Running tests..."
echo ""

# Run tests with REAL_API_TESTS flag
REAL_API_TESTS=true pnpm test tests/integration/memory/memory-real-api.test.ts

echo ""
echo "✅ Real API tests completed!"
echo ""
echo "💡 Tip: Review test output above for any warnings or errors"
