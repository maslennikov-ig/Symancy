# Plan: "Try Another Topic" (Retopic) Feature

## Context

After a single-topic reading (e.g., "love"), the user must re-upload the coffee cup photo to get a reading on another topic. This wastes money and time - the expensive vision analysis (~800 tokens) produces identical results for the same cup. We want to offer an inline keyboard after each single-topic reading so the user can pick another topic, reusing the cached vision result. This saves cost, time, and improves UX.

## Pre-step: Commit Previous Changes

There are 7 uncommitted files from previous work (model changes, prompt updates, truncation fix). Commit these first before implementing retopic.

## Design Decisions

| Question | Decision | Rationale |
|---|---|---|
| Store vision_result where? | `analysis_history.vision_result` JSONB column | Survives restarts, no Redis needed, small payload (<2KB) |
| New queue or reuse? | New `retopic-photo` queue + dedicated worker | Single responsibility, clean separation from main 540-line worker |
| Callback data format | `rt:{topicKey}:{analysisId}` (max ~49 bytes) | UUID fits 64-byte Telegram limit, restart-safe, no in-memory cache needed |
| Track covered topics | `session_group_id UUID` + query DISTINCT topic | Normalized, no array management, max 6 rows per session |

## Data Flow

```
[Single-topic reading delivered]
  --> Worker appends retopic keyboard: [Career] [Money] [Health] [Family] [Spiritual]

[User clicks "Career"]
  --> Router routes "rt:career:{uuid}" to retopic-handler
  --> Handler: verify analysis exists, vision_result present, user owns it
  --> Handler: check basic credits, edit keyboard to loading, enqueue retopic job

[Retopic Worker]
  --> Fetch vision_result from DB (NO re-download, NO re-vision)
  --> Consume 1 basic credit
  --> Run interpretation for "career" via strategy.interpret()
  --> Deliver reading + retopic keyboard with remaining topics

[Repeat until all 6 covered --> no keyboard]
```

## DB Migration

**File:** `supabase/migrations/20260217120000_add_retopic_support.sql`

```sql
ALTER TABLE analysis_history
  ADD COLUMN IF NOT EXISTS vision_result JSONB,
  ADD COLUMN IF NOT EXISTS session_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_analysis_session_group
  ON analysis_history(session_group_id) WHERE session_group_id IS NOT NULL;
```

Apply via: `mcp__supabase__apply_migration`

## Files to Create (2)

| File | Purpose | ~Lines |
|---|---|---|
| `src/modules/photo-analysis/retopic-handler.ts` | Callback handler: parse `rt:` callbacks, validate ownership, check credits, enqueue | ~120 |
| `src/modules/photo-analysis/retopic-worker.ts` | Worker: fetch vision_result from DB, run interpretation, deliver result + keyboard | ~150 |

## Files to Modify (7)

| File | Changes |
|---|---|
| `src/modules/photo-analysis/worker.ts` | 1) Generate `sessionGroupId = randomUUID()`, pass in insert. 2) Save `vision_result` JSONB in update after interpretation. 3) After single-topic delivery (topic !== "all"), send retopic keyboard as separate message |
| `src/modules/photo-analysis/keyboards.ts` | Add `createRetopicKeyboard(analysisId, coveredTopics[], language)`, `parseRetopicCallback(data)`, `RETOPIC_MESSAGES` i18n |
| `src/types/job-schemas.ts` | Add `RetopicJobSchema` Zod schema + `RetopicJobData` type |
| `src/config/constants.ts` | Add `QUEUE_RETOPIC_PHOTO = "retopic-photo"` |
| `src/core/queue.ts` | Import `QUEUE_RETOPIC_PHOTO`, add to `queuesToCreate[]`, add `sendRetopicJob()`, export in `QUEUES` |
| `src/modules/router/index.ts` | Route `rt:` callbacks to `handleRetopicCallback()` |
| `src/app.ts` | Import + register retopic worker in `startWorkers()` |

## Key Implementation Details

### keyboards.ts - `createRetopicKeyboard()`

```typescript
export function createRetopicKeyboard(
  analysisId: string,
  coveredTopics: string[],
  language: string = "ru"
): InlineKeyboardMarkup | null
```

- Filters `READING_TOPICS` excluding `coveredTopics`
- Returns `null` if all 6 covered (no keyboard to show)
- Callback format: `rt:{topicKey}:{analysisId}` - uses analysisId (UUID) directly, no cache needed
- 2-column grid layout, reuses existing `getTopicButtonLabel()` (private, extract or duplicate)
- NO "all topics" button in retopic (only individual remaining topics)

### i18n messages (in keyboards.ts)

```typescript
const RETOPIC_MESSAGES: Record<string, string> = {
  ru: "☕ Хотите узнать о другой теме? (1 Basic-кредит)",
  en: "☕ Want to read another topic? (1 Basic credit)",
  zh: "☕ 想了解其他主题吗？（1个Basic积分）",
};
```

### retopic-handler.ts

Path: `src/modules/photo-analysis/retopic-handler.ts`

1. Parse `rt:{topicKey}:{analysisId}` from `ctx.callbackQuery.data`
2. Fetch analysis from `analysis_history` by `analysisId` - verify:
   - Exists and status is "completed"
   - Has non-null `vision_result`
   - `telegram_user_id === ctx.from.id` (ownership)
3. Check basic credits via `hasCreditsOfType(telegramUserId, "basic")`
4. Answer callback query, edit message to loading state
5. Enqueue retopic job via `sendRetopicJob()`

On expired/invalid analysis: show "session expired" message, answer callback.

### retopic-worker.ts

Path: `src/modules/photo-analysis/retopic-worker.ts`

1. Fetch `vision_result` and `session_group_id` from `analysis_history` by `analysisId`
2. Create new `analysis_history` record:
   - Same `session_group_id`, `persona`, `telegram_user_id`
   - `vision_tokens_used: 0` (reused vision)
   - New `topic`, status "processing"
3. Consume 1 basic credit via `consumeCreditsOfType()`
4. Run `strategy.interpret(visionResult, { language, userName, topic })` (via same PersonaStrategy)
5. Save interpretation to new record, mark "completed"
6. Deliver via `splitMessage()` + `bot.api.sendMessage()`
7. Query all covered topics in session group:
   ```sql
   SELECT DISTINCT topic FROM analysis_history
   WHERE session_group_id = ? AND status = 'completed' AND topic != 'all'
   ```
8. Show retopic keyboard with remaining topics (or nothing if all covered)
9. On error: refund credit, mark failed, send error message

### worker.ts changes

- `import { randomUUID } from "node:crypto"`
- `import { createRetopicKeyboard, RETOPIC_MESSAGES } from "./keyboards.js"`
- Generate `const sessionGroupId = randomUUID()` before DB insert
- Pass `session_group_id: sessionGroupId` in initial insert
- Pass `vision_result: visionResult` as JSONB in update after interpretation (the `VisionAnalysisResult` object)
- After single-topic delivery (topic !== "all"):
  ```typescript
  const retopicKeyboard = createRetopicKeyboard(analysisId, [topic], userLanguage);
  if (retopicKeyboard) {
    const retopicMsg = RETOPIC_MESSAGES[language] || RETOPIC_MESSAGES["ru"];
    await bot.api.sendMessage(chatId, retopicMsg, { reply_markup: retopicKeyboard });
  }
  ```

### job-schemas.ts - RetopicJobSchema

```typescript
export const RetopicJobSchema = z.object({
  telegramUserId: z.number().int().positive(),
  chatId: z.number().int(),
  messageId: z.number().int().positive(),
  analysisId: z.string().uuid(),
  persona: z.enum(["arina", "cassandra"]),
  topic: ReadingTopicEnum.exclude(["all"]),
  language: z.string().min(2).max(10),
  userName: z.string().optional(),
});
```

### Security

- `retopic-handler.ts` verifies `analysis.telegram_user_id === ctx.from.id`
- Credits double-checked in both handler (pre-check) and worker (atomic consume)
- Invalid/expired analysis -> graceful "session expired" message
- Retopic only for single topics (no "all" in retopic keyboard)

## Existing Code to Reuse

| Utility | File |
|---|---|
| `splitMessage()` | `src/utils/message-splitter.ts` |
| `withRetry()` | `src/utils/retry.ts` |
| `sendErrorAlert()` | `src/utils/admin-alerts.ts` |
| `consumeCreditsOfType()` / `refundCreditsOfType()` / `hasCreditsOfType()` | `src/modules/credits/service.ts` |
| `PersonaStrategy.interpret()` | `src/modules/photo-analysis/personas/` |
| `registerWorker()` | `src/core/queue.ts` |
| `READING_TOPICS`, `getTopicLabel()` | `src/config/constants.ts` |
| `arinaStrategy` / `cassandraStrategy` | `src/modules/photo-analysis/personas/` |

## Implementation Order

1. DB migration (via Supabase MCP)
2. `constants.ts` - add `QUEUE_RETOPIC_PHOTO`
3. `job-schemas.ts` - add `RetopicJobSchema`
4. `keyboards.ts` - add `createRetopicKeyboard()`, `parseRetopicCallback()`, `RETOPIC_MESSAGES`
5. `queue.ts` - add retopic queue to `queuesToCreate[]` + `sendRetopicJob()`
6. `retopic-handler.ts` - new file
7. `retopic-worker.ts` - new file
8. `worker.ts` - add sessionGroupId, save vision_result, send retopic keyboard
9. `router/index.ts` - route `rt:` callbacks
10. `app.ts` - register retopic worker

## Verification

1. `npx tsc --noEmit` - TypeScript passes
2. `npx vitest run` - all tests pass
3. Apply migration via `mcp__supabase__apply_migration`
4. Manual test in Telegram:
   - Send photo -> pick "love" -> verify reading + retopic keyboard appears
   - Click "career" -> loading -> new reading + updated keyboard (4 remaining)
   - Repeat -> keyboard shrinks each time
   - After 6th topic -> no keyboard shown
5. Verify credits deducted correctly (1 basic per topic)
6. Verify bot restart doesn't break retopic (data in DB, not in-memory)
