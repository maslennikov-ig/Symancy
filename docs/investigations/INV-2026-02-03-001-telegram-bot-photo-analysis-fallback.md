# Investigation Report: Telegram Bot Photo Analysis Returns Fallback Message

---
investigation_id: INV-2026-02-03-001
status: completed
timestamp: 2026-02-03T09:00:00Z
investigator: Claude Investigation Agent
---

## Executive Summary

**Problem**: Symancy Telegram bot returns fallback message "К сожалению, сейчас я не могу полностью интерпретировать образы в вашей чашке" instead of actual coffee ground interpretations.

**Root Cause**: The `arina_model` in `system_config` database is set to `xiaomi/mimo-v2-flash:free`, which was deprecated on January 26, 2026. The interpretation chain fails when calling OpenRouter API with the deprecated model slug.

**Recommended Solution**: Update the `arina_model` configuration from `xiaomi/mimo-v2-flash:free` to `xiaomi/mimo-v2-flash` (the paid version).

**Key Finding**: Vision analysis works correctly (using `x-ai/grok-4.1-fast`), but the interpretation generation fails silently due to the deprecated model slug.

---

## Problem Statement

### Observed Behavior
- Users send photos of coffee grounds to Symancy Telegram bot
- Bot returns the fallback message: "К сожалению, сейчас я не могу полностью интерпретировать образы в вашей чашке..."
- This happens consistently for all photo analysis requests

### Expected Behavior
- Bot should analyze the photo using vision model
- Bot should generate a personalized interpretation using the Arina persona
- Bot should return a warm, psychologist-style reading of the coffee grounds

### Impact
- All users receiving fallback instead of actual interpretations
- Credits are being consumed but users receive no value
- User experience severely degraded

### Environment
- Production server: 91.132.59.194
- Database: Supabase (johspxgvkbrysxhilmbg)
- Deployment: Atomic symlink deployment at `/var/www/symancy-backend/`

---

## Investigation Process

### Hypotheses Tested

1. **Hypothesis: Prompt files missing or corrupted**
   - Evidence: Checked prompts directory via Glob
   - Files exist: `prompts/arina/system.txt`, `prompts/arina/interpretation.txt`
   - Result: RULED OUT

2. **Hypothesis: Database configuration issue**
   - Evidence: Queried `system_config` table
   - Found: `arina_model = "xiaomi/mimo-v2-flash:free"`
   - Result: CONFIRMED as contributing factor

3. **Hypothesis: Vision model failure**
   - Evidence: `analysis_history` shows `vision_tokens_used` has valid values (1500-2000)
   - Vision model `x-ai/grok-4.1-fast` is working correctly
   - Result: RULED OUT

4. **Hypothesis: Interpretation model failure**
   - Evidence: `analysis_history` shows `tokens_used = 0` for ALL recent completions
   - `chat_messages` contains fallback text for all recent assistant responses
   - OpenRouter confirms `xiaomi/mimo-v2-flash:free` deprecated Jan 26, 2026
   - Result: CONFIRMED as root cause

### Files Examined

| File | Purpose | Finding |
|------|---------|---------|
| `/symancy-backend/src/chains/interpretation.chain.ts` | Interpretation generation | Lines 299-314: fallback triggered on error |
| `/symancy-backend/src/core/langchain/models.ts` | Model factory | Lines 98-112: `createArinaModel()` loads from config |
| `/symancy-backend/src/modules/photo-analysis/worker.ts` | Photo processing pipeline | Lines 363-374: calls `strategy.interpret()` |
| `/symancy-backend/src/modules/config/service.ts` | Dynamic config service | `getConfig()` fetches from `system_config` |
| `/symancy-backend/src/config/constants.ts` | Default constants | Line 277: `MODEL_ARINA = "xiaomi/mimo-v2-flash"` (correct, but overridden) |

### Database Queries Executed

1. **Failed/Processing analyses**:
   ```sql
   SELECT * FROM analysis_history WHERE status IN ('failed', 'processing')
   ORDER BY created_at DESC LIMIT 20;
   ```
   - Found historical failures with various error messages
   - Recent "processing" records stuck without completion

2. **Recent completed analyses**:
   ```sql
   SELECT * FROM analysis_history WHERE status = 'completed'
   ORDER BY created_at DESC LIMIT 10;
   ```
   - All show `tokens_used = 0` (interpretation failed)
   - All show valid `vision_tokens_used` (1500-2000)

3. **Model configuration**:
   ```sql
   SELECT * FROM system_config WHERE key LIKE '%model%';
   ```
   - `arina_model = "xiaomi/mimo-v2-flash:free"` (DEPRECATED)
   - `vision_model = "x-ai/grok-4.1-fast"` (working)

4. **Actual bot responses**:
   ```sql
   SELECT content FROM chat_messages WHERE role = 'assistant'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - ALL contain the Russian fallback message

### External Research

**OpenRouter API Status** (from web search):
- MiMo-V2-Flash free tier ended January 26, 2026
- Error message: "The free MiMo-V2-Flash period has ended. To continue using this model, please migrate to the paid slug: xiaomi/mimo-v2-flash"
- Paid version available at `xiaomi/mimo-v2-flash` (without `:free` suffix)

Sources:
- [OpenRouter MiMo-V2-Flash Free](https://openrouter.ai/xiaomi/mimo-v2-flash:free)
- [OpenRouter MiMo-V2-Flash Providers](https://openrouter.ai/xiaomi/mimo-v2-flash:free/providers)

---

## Root Cause Analysis

### Primary Cause
The `arina_model` key in `system_config` database table is set to `"xiaomi/mimo-v2-flash:free"`, which was a promotional free tier that OpenRouter deprecated on January 26, 2026.

### Mechanism of Failure

```
User sends photo
       ↓
worker.ts downloads and processes image
       ↓
validateCoffeeGrounds() → SUCCESS (uses x-ai/grok-4.1-fast)
       ↓
analyzeVision() → SUCCESS (uses x-ai/grok-4.1-fast, vision_tokens_used = 1726)
       ↓
strategy.interpret() → CALLS generateInterpretation()
       ↓
createArinaModel() → getConfig("arina_model") → "xiaomi/mimo-v2-flash:free"
       ↓
model.invoke(messages) → THROWS ERROR (404: model deprecated)
       ↓
interpretation.chain.ts catch block (line 299)
       ↓
Returns FALLBACK_INTERPRETATION_RU with success: false
       ↓
worker.ts saves fallback to database and sends to user
       ↓
User receives: "К сожалению, сейчас я не могу полностью интерпретировать..."
```

### Contributing Factors

1. **Silent failure**: The `generateInterpretation` function catches errors and returns a fallback instead of re-throwing, making the failure invisible in the worker flow.

2. **Status marked "completed"**: The worker marks analysis as "completed" even when interpretation fails because the try/catch in interpretation.chain.ts returns a result (with `success: false`).

3. **No monitoring alert**: No alerting configured for when `tokens_used = 0` or `success: false` is returned.

4. **Configuration not updated**: When free tier ended on Jan 26, the configuration was not updated to use the paid model slug.

---

## Proposed Solutions

### Solution 1: Update Database Configuration (RECOMMENDED)

**Description**: Update the `arina_model` value in `system_config` to use the paid model slug.

**Implementation Steps**:
1. Execute SQL:
   ```sql
   UPDATE system_config
   SET value = 'xiaomi/mimo-v2-flash', updated_at = NOW()
   WHERE key = 'arina_model';

   UPDATE system_config
   SET value = 'xiaomi/mimo-v2-flash', updated_at = NOW()
   WHERE key = 'chat_model';

   UPDATE system_config
   SET value = 'xiaomi/mimo-v2-flash', updated_at = NOW()
   WHERE key = 'interpretation_model';
   ```
2. Clear config cache by restarting the bot (or wait 60 seconds for cache expiry)
3. Test with a photo submission

**Pros**:
- Immediate fix (1 minute implementation)
- No code changes required
- Uses paid tier which is actively maintained

**Cons**:
- Adds cost to OpenRouter API usage (was previously free)
- Requires monitoring OpenRouter credits

**Complexity**: Low
**Risk**: Low
**Estimated Effort**: 5 minutes

---

### Solution 2: Update Constants + Remove from Config Table

**Description**: Update the default constant and remove the database override to use code-based defaults.

**Implementation Steps**:
1. Verify `constants.ts` already has correct value:
   ```typescript
   export const MODEL_ARINA = "xiaomi/mimo-v2-flash"; // Already correct
   ```
2. Delete the database override:
   ```sql
   DELETE FROM system_config WHERE key IN ('arina_model', 'chat_model', 'interpretation_model');
   ```
3. The `getConfig()` function will fall back to the constant value

**Pros**:
- Centralizes model configuration in code
- Easier to track changes via git
- No database dependency for model names

**Cons**:
- Requires deployment to change models in future
- Less flexible for runtime adjustments

**Complexity**: Low
**Risk**: Low
**Estimated Effort**: 10 minutes

---

### Solution 3: Implement Model Fallback Chain

**Description**: Modify `createArinaModel()` to try multiple model slugs with fallback.

**Implementation Steps**:
1. Modify `/symancy-backend/src/core/langchain/models.ts`:
   ```typescript
   export async function createArinaModel(options?: ModelOptions): Promise<ChatOpenAI> {
     const primaryModel = await getConfig("arina_model", MODEL_ARINA);
     const fallbackModel = MODEL_ARINA; // Always use constant as fallback

     try {
       const model = createChatOpenAIInstance(primaryModel, { ... });
       // Test invoke to verify model availability
       return model;
     } catch (error) {
       if (primaryModel !== fallbackModel) {
         logger.warn({ primary: primaryModel, fallback: fallbackModel },
           "Primary model failed, using fallback");
         return createChatOpenAIInstance(fallbackModel, { ... });
       }
       throw error;
     }
   }
   ```

**Pros**:
- Self-healing when models are deprecated
- Provides resilience against temporary API issues
- Logs model fallback for monitoring

**Cons**:
- More complex implementation
- May mask configuration issues
- Harder to debug which model was actually used

**Complexity**: Medium
**Risk**: Medium (introduces new code paths)
**Estimated Effort**: 30-60 minutes

---

## Implementation Guidance

### Priority: CRITICAL

This is a P0 issue affecting all users. Recommended immediate action:

1. **Immediate** (Solution 1): Update database configuration
2. **Short-term**: Add monitoring for `tokens_used = 0` cases
3. **Medium-term**: Consider Solution 3 for resilience

### Files to Modify (for Solution 1)
- **Database**: `system_config` table (via Supabase SQL editor or MCP)

### Validation Criteria
1. Send a test photo to the bot
2. Verify response is NOT the fallback message
3. Check `analysis_history` table: `tokens_used > 0`
4. Check `chat_messages`: content is NOT fallback text

### Testing Requirements
1. Test Arina persona (single topic: love, career, etc.)
2. Test Arina persona (all topics)
3. Test Cassandra persona (should already work, uses different model)
4. Verify credits are consumed correctly

---

## Risks and Considerations

### Implementation Risks
- **Cost**: Moving from free to paid tier will incur OpenRouter charges
- **Rate limits**: Paid tier may have different rate limits
- **Model availability**: Chutes provider (sole provider) could have outages

### Performance Impact
- None expected - same model, just different slug

### Breaking Changes
- None

### Side Effects
- Monthly OpenRouter costs will increase

---

## Documentation References

### Tier 0: Project Internal
- `/symancy-backend/src/chains/interpretation.chain.ts:299-314` - Fallback handling
- `/symancy-backend/src/config/constants.ts:277` - Default MODEL_ARINA
- `/symancy-backend/src/modules/config/service.ts` - Dynamic config loading

### Tier 2: Official Documentation
- [OpenRouter MiMo-V2-Flash](https://openrouter.ai/xiaomi/mimo-v2-flash)
- [OpenRouter MiMo-V2-Flash Free (Deprecated)](https://openrouter.ai/xiaomi/mimo-v2-flash:free)

---

## MCP Server Usage

| Tool | Purpose | Result |
|------|---------|--------|
| `mcp__supabase__get_logs` | Check for API errors | All 200 status codes, no errors |
| `mcp__supabase__execute_sql` | Query analysis_history | Found tokens_used=0 pattern |
| `mcp__supabase__execute_sql` | Query system_config | Found deprecated model slug |
| `mcp__supabase__execute_sql` | Query chat_messages | Confirmed fallback text |

---

## Next Steps

1. **For Orchestrator/User**:
   - Review this report
   - Execute Solution 1 (database update)
   - Test the fix

2. **Follow-up Recommendations**:
   - Add monitoring for interpretation failures
   - Set up OpenRouter credit alerts
   - Consider implementing Solution 3 for long-term resilience

---

## Investigation Log

| Timestamp | Action | Result |
|-----------|--------|--------|
| 09:00 | Started investigation | Read task specification |
| 09:02 | Searched for fallback message | Found in interpretation.chain.ts:27 |
| 09:05 | Read interpretation chain code | Understood error handling flow |
| 09:10 | Read photo analysis worker | Mapped full processing pipeline |
| 09:15 | Read model factory code | Identified dynamic config loading |
| 09:20 | Queried Supabase logs | All API calls successful |
| 09:25 | Queried analysis_history | Found tokens_used=0 pattern |
| 09:30 | Queried system_config | Found `arina_model = "xiaomi/mimo-v2-flash:free"` |
| 09:32 | Web search OpenRouter | Confirmed free tier deprecated Jan 26, 2026 |
| 09:35 | Queried chat_messages | Confirmed all responses are fallback |
| 09:40 | Root cause confirmed | Deprecated model slug in database |
| 09:45 | Generated report | Investigation complete |

---

**Investigation Status: COMPLETED**
**Root Cause: CONFIRMED**
**Ready for Implementation: YES**
