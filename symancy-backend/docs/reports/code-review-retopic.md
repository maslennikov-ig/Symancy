# Code Review: Retopic Feature
## Date: 2026-02-17

## Summary

Overall assessment: **Good implementation with several critical security and UX issues that must be addressed.**

The retopic feature successfully implements the "try another topic" functionality by reusing cached vision analysis results. The architecture follows established patterns (handler → worker → queue), credit management is atomic via RPC functions, and error handling includes proper refunds.

**Critical Issues Found**: 3
**High Priority Issues**: 4
**Medium Priority Issues**: 5
**Low Priority Suggestions**: 3

**Recommendation**: Fix critical and high-priority issues before merging to production.

---

## Critical Issues (must fix)

### CR-001: Persona Hardcoded to Arina in Retopic Handler Loading Message

- **File**: `src/modules/photo-analysis/retopic-handler.ts:196`
- **Severity**: Critical
- **Description**: The handler always uses `arinaStrategy.getLoadingMessage()` regardless of the actual persona stored in the analysis record. When a user retopics a Cassandra reading, they see Arina's loading message instead of Cassandra's.
- **Fix**:
  ```typescript
  // Current (WRONG):
  const loadingText = arinaStrategy.getLoadingMessage(userLanguage);

  // Should be:
  const strategy = PERSONA_STRATEGIES[analysis.persona as "arina" | "cassandra"];
  const loadingText = strategy.getLoadingMessage(userLanguage);
  ```
  Add `PERSONA_STRATEGIES` import from worker or create a shared strategy map.

### CR-002: Double-Click Race Condition in Retopic Handler

- **File**: `src/modules/photo-analysis/retopic-handler.ts:68-245`
- **Severity**: Critical
- **Description**: If user clicks retopic button twice quickly before the first request completes, two jobs will be enqueued and TWO credits will be consumed. The `hasCreditsOfType` check (line 175) is NOT atomic with job enqueueing.
- **Impact**: User loses 2 credits for 1 analysis, poor UX, potential revenue loss if exploited.
- **Fix**: Implement button state management or idempotency:

  **Option 1 (Recommended)**: Answer callback and edit message BEFORE credit check:
  ```typescript
  // Line 193: Move these BEFORE credit check
  await ctx.answerCallbackQuery();
  const messageId = ctx.callbackQuery.message?.message_id;
  if (messageId) {
    await ctx.api.editMessageText(chatId, messageId, loadingText);
  }

  // Then check credits - button is now disabled
  const hasSufficientCredits = await hasCreditsOfType(telegramUserId, "basic");
  ```

  **Option 2**: Add analysis_id to processing state (requires DB schema change):
  ```sql
  ALTER TABLE analysis_history ADD COLUMN retopic_in_progress boolean DEFAULT false;
  -- Check and set atomically in handler
  ```

### CR-003: Missing Ownership Validation in Retopic Worker

- **File**: `src/modules/photo-analysis/retopic-worker.ts:95-102`
- **Severity**: Critical
- **Description**: Worker validates ownership (line 96-102), but this check happens AFTER job is already dequeued from pg-boss. An attacker could craft a malicious job with someone else's `analysisId` and their own `telegramUserId`, bypassing handler validation. The worker would reject it, but the attacker's job slot is wasted and logs are polluted.
- **Impact**: Resource exhaustion, log pollution, potential DoS vector.
- **Fix**: While handler does validate ownership, add defensive logging:
  ```typescript
  // Line 96-102: Add security event logging
  if (originalAnalysis.telegram_user_id !== telegramUserId) {
    logger.error(
      {
        expected: telegramUserId,
        actual: originalAnalysis.telegram_user_id,
        analysisId,
        jobId: job.id,
        SECURITY_EVENT: "ownership_mismatch"
      },
      "SECURITY: Telegram user ID mismatch in retopic job"
    );
    // Consider alerting admin
    await sendErrorAlert(new Error("Retopic ownership mismatch"), {
      module: "retopic-worker",
      telegramUserId,
      analysisId,
      severity: "SECURITY"
    });
    throw new Error("Original analysis not found");
  }
  ```

---

## High Priority Issues (should fix)

### CR-004: Retopic Keyboard Appears as Separate Message Instead of Inline

- **File**: `src/modules/photo-analysis/worker.ts:478-490`
- **Severity**: High
- **Description**: After single-topic analysis, retopic keyboard is sent as a SEPARATE message (line 483: `sendMessage`) instead of being attached to the interpretation. This clutters the chat and separates the keyboard from the reading.
- **UX Impact**: Poor user experience - users have to scroll to find the retopic button.
- **Fix**: Attach keyboard to the LAST message chunk:
  ```typescript
  // worker.ts:456-475 - Modified delivery logic
  if (messages.length === 1) {
    const replyMarkup = topic !== "all" && analysisId
      ? createRetopicKeyboard(analysisId, [topic], language || "ru")
      : undefined;

    await bot.api.editMessageText(chatId, messageId, messages[0]!, {
      parse_mode: "HTML",
      reply_markup: replyMarkup || undefined,
    });
  } else {
    await bot.api.deleteMessage(chatId, messageId);

    for (const [index, chunk] of messages.entries()) {
      const isLast = index === messages.length - 1;
      const replyMarkup = isLast && topic !== "all" && analysisId
        ? createRetopicKeyboard(analysisId, [topic], language || "ru")
        : undefined;

      await bot.api.sendMessage(chatId, chunk, {
        parse_mode: "HTML",
        reply_markup: replyMarkup || undefined,
      });
    }
  }

  // Remove lines 478-490 (separate retopic message)
  ```

### CR-005: messageId Fallback to 0 is Unsafe

- **File**: `src/modules/photo-analysis/retopic-handler.ts:214`
- **Severity**: High
- **Description**: If `ctx.callbackQuery.message?.message_id` is undefined, the code falls back to `messageId: 0`. Telegram message IDs start from 1, so `0` is invalid. The worker will attempt to edit message ID 0, which will fail silently.
- **Impact**: User doesn't see loading state, may click button again (see CR-002).
- **Fix**: Make messageId required or handle missing case:
  ```typescript
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!messageId) {
    logger.error({ telegramUserId, analysisId }, "Missing message ID in callback query");
    await ctx.answerCallbackQuery({
      text: "Ошибка. Попробуйте ещё раз.",
      show_alert: true,
    });
    return;
  }

  // Remove fallback to 0 on line 214
  const jobData: RetopicJobData = {
    telegramUserId,
    chatId,
    messageId, // Now guaranteed to be a valid number
    // ...
  };
  ```

### CR-006: Insufficient Credits Error in Worker Not Localized

- **File**: `src/modules/photo-analysis/retopic-worker.ts:142-148`
- **Severity**: High
- **Description**: Hardcoded Russian error message "Недостаточно Basic-кредитов". Should use the `language` field from job data.
- **Fix**:
  ```typescript
  // Add to top of file
  const INSUFFICIENT_CREDITS_MESSAGES: Record<string, string> = {
    ru: "💳 Недостаточно Basic-кредитов.\nПожалуйста, пополните баланс.",
    en: "💳 Not enough Basic credits.\nPlease top up your balance.",
    zh: "💳 Basic积分不足。\n请充值。",
  };

  // Line 142-148: Use localized message
  await bot.api.editMessageText(
    chatId,
    messageId,
    INSUFFICIENT_CREDITS_MESSAGES[language || "ru"] || INSUFFICIENT_CREDITS_MESSAGES["ru"]!
  );
  ```

### CR-007: Worker Error Message Not Localized

- **File**: `src/modules/photo-analysis/retopic-worker.ts:303-306`
- **Severity**: High
- **Description**: Hardcoded Russian error message "Произошла ошибка при повторном анализе...". Should use `language` from job data.
- **Fix**: Similar to CR-006, create localized error messages map.

---

## Medium Priority Issues (fix soon)

### CR-008: RetopicJobSchema Duplicates Topic Enum

- **File**: `src/types/job-schemas.ts:61`
- **Severity**: Medium
- **Description**: `RetopicJobSchema` manually lists all topics in `z.enum(["love", "career", ...])` instead of reusing `ReadingTopicEnum.exclude(["all"])`. This creates maintenance burden - if topics are added/removed, must update in two places.
- **Fix**:
  ```typescript
  // Line 61: Use derived enum
  export const RetopicJobSchema = z.object({
    // ...
    topic: ReadingTopicEnum.exclude(["all"]), // Zod v3.22+ supports .exclude()
    // OR if .exclude() not available:
    topic: z.enum(["love", "career", "money", "health", "family", "spiritual"] as const),
  });
  ```
  Better yet, define `SINGLE_TOPICS` constant and reuse:
  ```typescript
  export const SingleTopicEnum = z.enum(["love", "career", "money", "health", "family", "spiritual"]);
  export const ReadingTopicEnum = z.enum([...SingleTopicEnum.options, "all"]);
  export const RetopicJobSchema = z.object({
    topic: SingleTopicEnum,
    // ...
  });
  ```

### CR-009: Retopic Keyboard Validation Relies on Set Instead of Schema

- **File**: `src/modules/photo-analysis/keyboards.ts:179-186`
- **Severity**: Medium
- **Description**: `VALID_SINGLE_TOPICS` is a manually maintained Set instead of deriving from `RetopicJobSchema` or `ReadingTopicEnum`. Creates maintenance burden.
- **Fix**: Import from job-schemas.ts:
  ```typescript
  import { RetopicJobSchema } from "../../types/job-schemas.js";

  const VALID_SINGLE_TOPICS = new Set(RetopicJobSchema.shape.topic.options);
  ```

### CR-010: Vision Result Not Validated Before Use

- **File**: `src/modules/photo-analysis/retopic-worker.ts:111`
- **Severity**: Medium
- **Description**: `vision_result` is cast to `VisionAnalysisResult` without validation. If JSONB is malformed or schema changed, runtime errors could occur.
- **Impact**: Worker crash, credit consumed but no refund.
- **Fix**: Add Zod validation or type guard:
  ```typescript
  // After line 111
  const visionResult = originalAnalysis.vision_result as VisionAnalysisResult;

  // Add validation
  if (!visionResult.symbols || !visionResult.colors || !visionResult.patterns) {
    jobLogger.error({ visionResult }, "Invalid vision_result structure");
    throw new Error("Corrupted vision analysis data");
  }
  ```

### CR-011: Analysis Record Created Before Credit Check

- **File**: `src/modules/photo-analysis/retopic-worker.ts:115-136`
- **Severity**: Medium
- **Description**: New analysis record is inserted (line 115-127) BEFORE credits are checked (line 139). If user has insufficient credits, a "processing" record remains in database.
- **Impact**: Database pollution with orphaned records.
- **Fix**: Move credit check before DB insert:
  ```typescript
  // Step 3: Check credits FIRST
  const hasCredits = await hasCreditsOfType(telegramUserId, "basic");
  if (!hasCredits) {
    // Edit message and exit
    await bot.api.editMessageText(...);
    return;
  }

  // Step 4: Create analysis record (now we know credits exist)
  const { data: newRecord, error: insertError } = await supabase...
  ```

### CR-012: Callback Data Could Contain Colons in UUID (Edge Case)

- **File**: `src/modules/photo-analysis/keyboards.ts:284-286`
- **Severity**: Medium
- **Description**: Parser handles UUID containing colons by rejoining `parts.slice(2).join(":")`, but standard UUIDs don't contain colons. This is overly defensive and could mask bugs.
- **Impact**: If malformed data contains extra colons, it might pass validation incorrectly.
- **Fix**: Since UUIDs never contain colons, simplify:
  ```typescript
  // Line 277-278: UUID is always parts[2]
  const topicKey = parts[1];
  const analysisId = parts[2]; // No need to rejoin

  // Line 284-286: If parts.length > 3, it's invalid
  if (parts.length !== 3) {
    return null;
  }
  ```

---

## Low Priority Suggestions (nice to have)

### CR-013: Missing JSDoc for Public Functions

- **File**: `src/modules/photo-analysis/retopic-handler.ts`
- **Severity**: Low
- **Description**: Helper functions `getSessionExpiredMessage` (line 40) and `getInsufficientCreditsMessage` (line 47) lack JSDoc comments.
- **Fix**: Add JSDoc:
  ```typescript
  /**
   * Get session expired message for language
   * @param language - Language code (ru, en, zh)
   * @returns Localized session expired message
   */
  function getSessionExpiredMessage(language: string = "ru"): string {
  ```

### CR-014: Magic Number for Vision Tokens

- **File**: `src/modules/photo-analysis/retopic-worker.ts:124`
- **Severity**: Low
- **Description**: `vision_tokens_used: 0` is hardcoded with comment "Reused, no new vision cost". Consider extracting to named constant for clarity.
- **Fix**:
  ```typescript
  const RETOPIC_VISION_TOKENS = 0; // Vision result is reused from original analysis

  // Line 124
  vision_tokens_used: RETOPIC_VISION_TOKENS,
  ```

### CR-015: Console Method Call May Be Typo

- **File**: `src/modules/photo-analysis/retopic-worker.ts:239`
- **Severity**: Low (false positive)
- **Description**: ESLint might flag `[...new Set(...)]` as suspicious. This is actually correct TypeScript for deduplication.
- **Fix**: Add ESLint ignore comment if linter complains:
  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-array-constructor
  const coveredTopics = [...new Set(
    (coveredRows || []).map((r: { topic: string }) => r.topic)
  )];
  ```

---

## Passed Checks

### ✅ Security - Ownership Validation
- Handler properly validates `analysis.telegram_user_id === ctx.from.id` (line 158-172)
- Status check ensures only "completed" analyses are retopicked (line 133-143)
- Worker double-checks ownership (line 96-102)

### ✅ Credit Management - Atomic Operations
- Uses `hasCreditsOfType` and `consumeCreditsOfType` which call atomic RPC functions
- Proper refund on error via `refundCreditsOfType` (line 274-281)
- Credit type is hardcoded to "basic" (correct for retopic)

### ✅ Error Handling - Comprehensive
- All async operations wrapped in try-catch
- Proper error logging with context
- Admin alerts sent for critical failures (line 264-271)
- Analysis record marked as "failed" with error message (line 285-299)

### ✅ Queue Integration - Follows Patterns
- Job data validated via Zod schema (`RetopicJobSchema`)
- Queue registered in `app.ts` (line 19, 247)
- Router properly routes `rt:` callbacks (line 358-361)
- Worker retry logic follows existing pattern

### ✅ Database - Session Grouping
- Reuses `session_group_id` from original analysis (line 123)
- Allows querying all topics from same session (line 232-241)
- Properly excludes covered topics from keyboard (line 239-246)

### ✅ Vision Result - Caching Works
- Original worker saves `vision_result` to JSONB (worker.ts:407)
- Retopic worker reuses cached result (line 111)
- No new vision API calls = cost savings ✅

### ✅ Callback Data - Size Within Limits
- Worst case: `rt:spiritual:uuid` = 49 bytes (< 64 byte Telegram limit)
- UUID validation with regex (line 191-192, 294)
- Topic validation against whitelist (line 179-186, 289)

### ✅ Internationalization - Mostly Complete
- Handler has localized session/credits messages (line 22-52)
- Retopic keyboard message localized (keyboards.ts:170-174)
- **Exception**: Worker error messages need i18n (see CR-006, CR-007)

### ✅ Logging - Comprehensive
- All major steps logged with context
- Success/failure clearly distinguished
- Security events logged (ownership checks)
- Token usage and processing time tracked

### ✅ Type Safety - Strong Typing
- Proper TypeScript types throughout
- Zod validation at queue entry
- Persona enum prevents typos
- UUID regex validation

---

## Edge Case Analysis

### ✅ Handled: User Clicks Retopic on Last Topic
- `createRetopicKeyboard` returns `null` if `remainingTopics.length === 0` (line 223-225)
- Worker checks `if (retopicKeyboard)` before sending (line 247)
- User sees interpretation but no retopic keyboard - correct behavior

### ✅ Handled: Original Analysis Deleted Before Retopic
- Handler checks `if (!analysis)` (line 121-131)
- Returns "Session expired" message
- No job enqueued

### ✅ Handled: Vision Result Missing/Null
- Handler checks `if (!analysis.vision_result)` (line 145-155)
- Returns "Session expired" message
- No job enqueued

### ⚠️ Partially Handled: User Retopics to Same Topic They Just Read
- Keyboard correctly filters out covered topics (line 217-220)
- But if user somehow triggers retopic with same topic (direct API call?), worker will process it
- **Recommendation**: Add validation in handler:
  ```typescript
  // After line 91
  if (coveredTopics.includes(topicKey)) {
    logger.warn({ telegramUserId, topicKey, analysisId }, "User attempted to retopic same topic");
    await ctx.answerCallbackQuery({
      text: "Вы уже получили толкование по этой теме.",
      show_alert: true,
    });
    return;
  }
  ```

### ❌ Not Handled: messageId === 0 (see CR-005)

---

## Performance Considerations

### ✅ Good: No N+1 Queries
- Single query to fetch original analysis (line 100-106)
- Single query to create new record (line 115-127)
- Single query to update completed record (line 184-196)
- Single query to save chat message (line 206-217)
- Single query to get covered topics (line 232-237)

### ✅ Good: Minimal Vision API Calls
- Vision result is cached in JSONB
- Retopic reuses cached data - 0 vision tokens
- Only interpretation tokens charged

### ⚠️ Consider: Indexing
- Ensure `analysis_history.session_group_id` is indexed (line 235)
- Ensure `analysis_history.telegram_user_id` is indexed (line 100)
- Check query plan: `EXPLAIN ANALYZE SELECT ... WHERE session_group_id = '...'`

---

## Code Quality

### ✅ Strengths
- Consistent code style with existing codebase
- Clear separation of concerns (handler → queue → worker)
- Comprehensive logging
- Proper TypeScript typing
- Good variable naming

### ⚠️ Improvements Needed
- Remove code duplication (i18n messages between handler and worker)
- Extract magic strings to constants
- Add more JSDoc comments
- Consolidate topic enums (CR-008)

---

## Testing Recommendations

### Manual Testing Checklist
- [ ] Retopic Arina reading → Arina loading message appears (CR-001)
- [ ] Retopic Cassandra reading → Cassandra loading message appears (CR-001)
- [ ] Click retopic button twice quickly → Only 1 credit consumed (CR-002)
- [ ] Retopic with 0 credits → Error message in correct language (CR-006)
- [ ] Retopic fails (network error) → Credit refunded
- [ ] Retopic keyboard appears on LAST message chunk (CR-004)
- [ ] Retopic all 6 topics → 6th reading has no retopic keyboard
- [ ] Check message ID 0 handling (CR-005)

### Unit Testing Needs
- `parseRetopicCallback` with valid/invalid inputs
- `createRetopicKeyboard` with various covered topics
- Credit check/consume/refund flows
- Ownership validation edge cases

### Integration Testing Needs
- Full retopic flow: photo → topic → retopic → delivery
- Session grouping: verify all topics in same `session_group_id`
- Callback data size: ensure worst case fits in 64 bytes

---

## Migration/Deployment Notes

### Database Changes
- ✅ No schema changes required
- ✅ `vision_result` JSONB column already exists
- ✅ `session_group_id` column already exists

### Queue Changes
- ✅ `QUEUE_RETOPIC_PHOTO` queue already registered
- ✅ Worker already registered in `app.ts`

### Rollback Plan
If retopic feature causes issues:
1. Remove `rt:` callback routing from `router/index.ts`
2. Stop sending retopic keyboard in `worker.ts`
3. Retopic jobs in queue will be ignored
4. No data loss - all analysis records remain intact

---

## Conclusion

The retopic feature is **well-architected and follows established patterns**, but has **3 critical bugs** that must be fixed before production deployment:

1. **CR-001**: Persona hardcoded to Arina in loading message
2. **CR-002**: Double-click race condition allows double credit consumption
3. **CR-003**: Missing security event logging for ownership mismatches

Additionally, **4 high-priority UX/i18n issues** should be addressed:

4. **CR-004**: Retopic keyboard should be inline with interpretation
5. **CR-005**: messageId fallback to 0 is unsafe
6. **CR-006**: Worker insufficient credits message not localized
7. **CR-007**: Worker error message not localized

**Estimated fix time**: 2-3 hours for critical + high priority issues.

**Security assessment**: Good - ownership validation is present, credits are atomic, input validation is thorough. Minor improvement needed for security event logging (CR-003).

**Code quality assessment**: Good - follows patterns, typed, logged. Could benefit from i18n consolidation and enum reuse.

**Recommendation**: **Fix CR-001 through CR-007 before merge.** Medium/low priority issues can be addressed in follow-up PR.
