# Chat Chain with Memory Integration Tests

**Test File**: `/home/me/code/coffee/symancy-backend/tests/integration/memory/chat-memory.test.ts`
**Test Type**: Integration Tests
**Status**: ✅ All 28 tests passing
**Created**: 2025-12-27

---

## Overview

Comprehensive integration tests verifying that the chat chain (`chat.chain.ts`) properly integrates with the memory service (`memory.service.ts`) during response generation. These tests ensure that user memories are searched, formatted, and included in the LLM prompt context.

## Test Coverage

### 1. Memory Search Integration (3 tests)

Tests that verify the chat chain calls `searchMemories` with correct parameters:

- **✅ Should call searchMemories with correct parameters**
  - Verifies `searchMemories(userId, message, 5)` is called
  - Ensures memory search happens during response generation

- **✅ Should search memories with message as query**
  - Verifies the user's message is used as the search query
  - Tests with custom messages in Russian

- **✅ Should request exactly 5 memories by default**
  - Verifies the default limit of 5 memories is used
  - Ensures consistent memory retrieval behavior

### 2. Memory Context Formatting (6 tests)

Tests that verify memory results are properly formatted and included in the prompt:

- **✅ Should include relevant memories in response context**
  - Verifies memories are formatted in prompt with header
  - Checks bulleted list format: `"## Relevant memories about this user:\n- Memory 1\n- Memory 2"`

- **✅ Should format memory context as bulleted list**
  - Validates each memory is prefixed with `"- "`
  - Ensures proper newline separation

- **✅ Should append memory context to last analysis context**
  - Verifies memories are appended after last coffee reading analysis
  - Tests integration of multiple context sources

- **✅ Should not include memory context when no memories found**
  - Ensures no "Relevant memories" section when empty
  - Falls back to "No previous analysis available"

- **✅ Should preserve memory content exactly as returned**
  - Verifies special characters, emails, emojis are preserved
  - Tests: `"User's email: test@example.com, age: 25, hobby: 'coffee tasting' ☕"`

- **✅ Should handle single memory**
  - Tests formatting with just one memory
  - Ensures section header is still included

### 3. Error Handling (6 tests)

Tests that verify graceful degradation when memory service fails:

- **✅ Should handle memory search failure gracefully**
  - Mock error: `"Database connection failed"`
  - Verifies response is still generated
  - Checks error is logged to console

- **✅ Should log error but still generate response on memory failure**
  - Mock error: `"Embedding service timeout"`
  - Ensures `console.error` is called with error
  - Verifies response includes text and token usage

- **✅ Should handle network timeout in memory search**
  - Mock error: `"ETIMEDOUT"`
  - Tests resilience to network failures
  - Ensures model is still invoked

- **✅ Should continue if memory search returns undefined**
  - Tests edge case of malformed response
  - Verifies no crash occurs

- **✅ Should handle malformed memory objects gracefully**
  - Tests memories with `null` content field
  - Ensures invalid data doesn't break response generation

- **✅ Should continue even if memory promise rejects**
  - Tests async rejection handling
  - Verifies promise rejection is caught and logged

### 4. Integration with Chat History (2 tests)

Tests that verify memories work alongside chat history:

- **✅ Should include both memories and chat history in context**
  - Verifies memories are in system prompt
  - Ensures chat history messages are preserved
  - Tests complete message sequence: system prompt → chat prompt (with memories) → history → user message

- **✅ Should work with empty chat history but with memories**
  - Tests first-time users with existing memories
  - Verifies memories are included even without chat history
  - Expected structure: 3 messages (system, chat prompt, user)

### 5. Memory Content Scenarios (4 tests)

Tests various memory result scenarios:

- **✅ Should handle maximum memories (5)**
  - Verifies all 5 memories are included when returned
  - Tests: Memory 1, Memory 2, Memory 3, Memory 4, Memory 5

- **✅ Should handle memories with various categories**
  - Tests: `personal_info`, `health`, `interests`
  - Verifies category doesn't affect inclusion

- **✅ Should handle memories with unicode and emojis**
  - Tests Russian text: `"Пользователь любит кофе ☕ и чай 🍵"`
  - Ensures unicode characters are preserved

- **✅ Should preserve special characters in memory content**
  - Tests quotes, apostrophes, symbols
  - Verifies exact content preservation

### 6. Response Verification (3 tests)

Tests that verify complete response structure:

- **✅ Should return complete ChatResponseResult with memories**
  - Verifies response includes `{ text, tokensUsed }`
  - Tests token usage tracking

- **✅ Should return valid response even when memory search fails**
  - Ensures response structure is maintained
  - Verifies `tokensUsed > 0`

- **✅ Should include token usage from model**
  - Tests various token counts (150, 250, 320)
  - Ensures usage_metadata is extracted correctly

### 7. Language and User Options (4 tests)

Tests custom language and user name options:

- **✅ Should work with custom language option**
  - Tests `language: "en"` parameter
  - Verifies language placeholder is replaced in prompt

- **✅ Should work with custom userName option**
  - Tests `userName: "Alexey"` parameter
  - Verifies user name placeholder replacement

- **✅ Should use default language (ru) when not specified**
  - Ensures Russian is default
  - Checks prompt contains `"ru"`

- **✅ Should use default userName when not specified**
  - Ensures `"дорогой друг"` (dear friend) is default
  - Tests fallback behavior

### 8. Non-blocking Memory Search (2 tests)

Tests that memory search doesn't block response:

- **✅ Should not block response generation if memory search is slow**
  - Simulates 10ms delay in memory search
  - Verifies response is still generated
  - Tests async behavior

- **✅ Should continue even if memory promise rejects**
  - Tests promise rejection handling
  - Ensures error is logged but response continues

---

## Mock Strategy

### Mocked Dependencies

1. **Supabase Client** (`getSupabase`)
   - Mocks chat history loading
   - Mocks last analysis loading
   - Chainable methods: `.from().select().eq().order().limit()`

2. **LangChain Model** (`createArinaModel`)
   - Mocks `invoke()` method
   - Returns configurable response with token usage
   - Allows verification of prompt structure

3. **File System** (`fs/promises`)
   - Mocks `readFile()` for prompt loading
   - Returns mock Arina system and chat prompts
   - Enables placeholder verification

4. **Memory Service** (`memory.service.ts`)
   - Uses `vi.spyOn()` for real function spying
   - Allows verification of call parameters
   - Enables mock return values and errors

### Test Helpers

```typescript
// Mock chat history with custom messages
mockChatHistory([
  { role: "user", content: "Привет!" },
  { role: "assistant", content: "Здравствуй! ✨" }
])

// Mock last analysis with interpretation text
mockLastAnalysis("You saw a spiral pattern in the coffee grounds.")

// Mock model response with custom content and tokens
mockModelResponse("Response text", 250)
```

---

## Key Test Patterns

### 1. Spy Pattern (Verification)

```typescript
const searchSpy = vi.spyOn(memoryService, 'searchMemories');
searchSpy.mockResolvedValueOnce([...memories]);

await generateChatResponseDirect(message, userId);

expect(searchSpy).toHaveBeenCalledWith(userId, message, 5);
```

### 2. Error Simulation (Resilience)

```typescript
searchSpy.mockRejectedValueOnce(new Error("Database connection failed"));

const result = await generateChatResponseDirect(message, userId);

expect(result).toBeDefined(); // Should still return response
expect(consoleErrorSpy).toHaveBeenCalled(); // Error logged
```

### 3. Prompt Verification (Integration)

```typescript
await generateChatResponseDirect(message, userId);

const invokeArgs = mockModelInvoke.mock.calls[0][0];
const systemMessages = invokeArgs.filter(
  msg => msg.constructor.name === "SystemMessage"
);

expect(systemMessages[1].content).toContain("## Relevant memories");
expect(systemMessages[1].content).toContain("- User's name is TestBot");
```

---

## Test Data

### Test User ID
```typescript
const TEST_USER_ID = 999999997;
```

### Sample Messages
```typescript
const TEST_MESSAGE = "Привет, напомни как меня зовут";
const CUSTOM_MESSAGE = "Какие у меня есть интересы?";
```

### Sample Memories
```typescript
[
  {
    id: "mem-1",
    content: "User's name is TestBot",
    category: "personal_info",
    score: 0.9,
  },
  {
    id: "mem-2",
    content: "User likes coffee",
    category: "preferences",
    score: 0.85,
  }
]
```

---

## Integration Points Tested

### 1. Chat Chain → Memory Service
- ✅ `searchMemories()` called with correct parameters
- ✅ Search query matches user message
- ✅ Limit defaults to 5 memories

### 2. Memory Service → LangChain Prompt
- ✅ Memories formatted as bulleted list
- ✅ Memory context appended to last analysis
- ✅ Section header included: `"## Relevant memories about this user:"`

### 3. Error Propagation
- ✅ Memory errors logged but don't block response
- ✅ Response generation continues on failure
- ✅ Console.error called with error details

### 4. Options Propagation
- ✅ Language option passed to prompt template
- ✅ UserName option passed to prompt template
- ✅ Defaults applied when options not provided

---

## Test Results

```
 ✓ tests/integration/memory/chat-memory.test.ts (28 tests) 59ms

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  603ms
```

### Test Breakdown by Category

| Category | Tests | Status |
|----------|-------|--------|
| Memory Search Integration | 3 | ✅ All passing |
| Memory Context Formatting | 6 | ✅ All passing |
| Error Handling | 6 | ✅ All passing |
| Integration with Chat History | 2 | ✅ All passing |
| Memory Content Scenarios | 4 | ✅ All passing |
| Response Verification | 3 | ✅ All passing |
| Language and User Options | 4 | ✅ All passing |
| Non-blocking Memory Search | 2 | ✅ All passing |
| **Total** | **28** | **✅ All passing** |

---

## Source Files Tested

1. **`/home/me/code/coffee/symancy-backend/src/chains/chat.chain.ts`**
   - `generateChatResponseDirect()` function
   - Lines 205-269 (memory integration section)

2. **`/home/me/code/coffee/symancy-backend/src/services/memory.service.ts`**
   - `searchMemories()` function
   - Integration with chat chain

3. **`/home/me/code/coffee/symancy-backend/prompts/arina/chat.txt`**
   - Placeholder replacement: `{{LAST_ANALYSIS}}`, `{{USER_NAME}}`, `{{LANGUAGE}}`
   - Memory context formatting

---

## Code Coverage

### Functions Tested

- ✅ `generateChatResponseDirect()` - Main integration point
- ✅ Memory search invocation (lines 230-241)
- ✅ Memory context formatting (lines 235-237)
- ✅ Error handling (lines 238-241)
- ✅ Placeholder replacement (lines 244-248)

### Edge Cases Covered

- ✅ Empty memory results
- ✅ Memory service errors (network, database, timeout)
- ✅ Malformed memory data (null, undefined)
- ✅ Special characters and unicode
- ✅ Single vs multiple memories
- ✅ Integration with empty/full chat history

### Error Scenarios

- ✅ Database connection failure
- ✅ Embedding service timeout
- ✅ Network timeout (ETIMEDOUT)
- ✅ Promise rejection
- ✅ Undefined/null responses
- ✅ Malformed memory objects

---

## Usage Example

Run the tests:

```bash
# Run only chat-memory integration tests
pnpm test tests/integration/memory/chat-memory.test.ts

# Run with coverage
pnpm test:coverage tests/integration/memory/chat-memory.test.ts

# Run in watch mode
pnpm test:watch tests/integration/memory/chat-memory.test.ts
```

---

## Related Documentation

- **Source Code**: `/home/me/code/coffee/symancy-backend/src/chains/chat.chain.ts`
- **Memory Service**: `/home/me/code/coffee/symancy-backend/src/services/memory.service.ts`
- **Unit Tests**: `/home/me/code/coffee/symancy-backend/tests/unit/services/memory.service.test.ts`
- **Handler Tests**: `/home/me/code/coffee/symancy-backend/tests/integration/handlers/chat.handler.test.ts`

---

## Future Improvements

### Potential Enhancements

1. **Performance Testing**
   - Measure memory search latency impact on response time
   - Test with varying memory counts (1, 5, 10, 100)

2. **Semantic Testing**
   - Verify memories with high similarity scores are prioritized
   - Test memory relevance to specific queries

3. **Multi-language Testing**
   - Test memory search with English, Russian, Chinese queries
   - Verify cross-language memory retrieval

4. **Concurrency Testing**
   - Test multiple simultaneous requests with memory search
   - Verify no race conditions in memory retrieval

5. **Integration with Memory Extraction Chain**
   - End-to-end test: chat → extract memory → search memory → use in response
   - Verify full memory lifecycle

---

## Maintenance Notes

### When to Update Tests

1. **When chat chain changes**:
   - Memory search parameters modified
   - Memory context formatting changed
   - Error handling updated

2. **When memory service changes**:
   - Search function signature modified
   - Return value structure changed
   - New error types introduced

3. **When prompt structure changes**:
   - New placeholders added
   - Memory context section format modified
   - Prompt template structure changed

### Test Stability

All tests use mocked dependencies and deterministic responses, ensuring:
- ✅ No external API calls
- ✅ No database dependencies
- ✅ Consistent execution time (<100ms)
- ✅ Parallel execution safe
- ✅ No test interdependencies

---

**Report Generated**: 2025-12-27
**Test Framework**: Vitest 3.2.4
**Node Version**: 20.x
**Total Test Coverage**: 28 tests, 100% passing
