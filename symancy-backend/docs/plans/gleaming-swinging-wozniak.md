# Plan: "Try Another Topic" (Retopic) Feature

## Context

After a single-topic reading (e.g., "love"), the user must re-upload the coffee cup photo to get a reading on another topic. This is wasteful — the expensive vision analysis (~800 tokens) is identical for the same cup. We want to offer an inline keyboard after each single-topic reading so the user can pick another topic, reusing the cached vision result. This saves cost, time, and improves UX.

## Design Decisions

| Question | Decision | Rationale |
|---|---|---|
| Store vision_result where? | `analysis_history.vision_result` JSONB column | Survives restarts, no Redis needed, small payload (<2KB) |
| New queue or reuse? | New `retopic-photo` queue + dedicated worker | Single responsibility, ~120 lines vs 540 in main worker |
| Callback data format | `rt:{topicKey}:{analysisId}` (max 49 bytes) | UUID fits 64-byte Telegram limit, restart-safe |
| Track covered topics | `session_group_id UUID` + query DISTINCT topic | Normalized, no array management, max 6 rows |

## Data Flow

```
[Single-topic reading delivered]
  --> Worker appends retopic keyboard: [Career] [Money] [Health] [Family] [Spiritual]

[User clicks "Career"]
  --> Router routes "rt:career:{uuid}" to retopic-handler
  --> Handler: verify analysis exists, vision_result present, user owns it
  --> Handler: check basic credits, enqueue retopic job

[Retopic Worker]
  --> Fetch vision_result from DB (NO re-download, NO re-vision)
  --> Consume 1 basic credit
  --> Run interpretation for "career"
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

## Files to Create

| File | Purpose |
|---|---|
| `src/modules/photo-analysis/retopic-handler.ts` | Callback handler: parse `rt:` callbacks, validate, check credits, enqueue |
| `src/modules/photo-analysis/retopic-worker.ts` | Worker: fetch vision_result from DB, run interpretation only, deliver result + keyboard |

## Files to Modify

| File | Changes |
|---|---|
| `src/modules/photo-analysis/worker.ts` | 1) Generate `sessionGroupId = randomUUID()`, save in insert. 2) Save `vision_result` in update. 3) After single-topic delivery, show retopic keyboard |
| `src/modules/photo-analysis/keyboards.ts` | Add `createRetopicKeyboard()`, `parseRetopicCallback()`, i18n messages (ru/en/zh) |
| `src/types/job-schemas.ts` | Add `RetopicJobSchema` + `RetopicJobData` type |
| `src/config/constants.ts` | Add `QUEUE_RETOPIC_PHOTO` |
| `src/core/queue.ts` | Import queue name, add to `queuesToCreate[]`, add `sendRetopicJob()`, export in QUEUES |
| `src/modules/router/index.ts` | Route `rt:` callbacks to `handleRetopicCallback()` |
| `src/app.ts` | Import + register retopic worker at startup |

## Key Implementation Details

### keyboards.ts — `createRetopicKeyboard()`
- Takes `analysisId`, `coveredTopics[]`, `language`
- Filters `READING_TOPICS` excluding covered ones
- Returns `InlineKeyboardMarkup` or `null` if all 6 covered
- Callback format: `rt:{topicKey}:{analysisId}` (uses analysisId directly, no cache needed)
- Reuse existing `getTopicButtonLabel()` function

### i18n messages (in keyboards.ts)
```
ru: "☕️ Хотите узнать о другой теме? (1 Basic-кредит за каждую)"
en: "☕️ Want to read another topic? (1 Basic credit each)"
zh: "☕️ 想了解其他主题吗？（每个主题1个Basic积分）"
```

### retopic-handler.ts
1. Parse `rt:{topicKey}:{analysisId}` callback
2. Fetch analysis from DB — verify exists, has `vision_result`, belongs to user
3. Check basic credits
4. Edit keyboard message to loading state
5. Enqueue retopic job

### retopic-worker.ts
1. Fetch `vision_result` from `analysis_history` by `analysisId`
2. Create new `analysis_history` record (same `session_group_id`, `vision_tokens_used: 0`)
3. Consume 1 basic credit
4. `strategy.interpret(visionResult, { language, userName, topic })`
5. Save interpretation, deliver via `splitMessage()`
6. Query all covered topics in session group
7. Show retopic keyboard with remaining topics (or nothing if all covered)
8. On error: refund credit, mark failed, send error message

### worker.ts changes
- Add `import { randomUUID } from "node:crypto"`
- Generate `sessionGroupId` before insert
- Pass `session_group_id: sessionGroupId` in initial insert
- Pass `vision_result: visionResult` in update after interpretation
- After single-topic delivery (topic !== "all"): send retopic keyboard as separate message

### Security
- retopic-handler verifies `analysis.telegram_user_id === ctx.from.id`
- Credits double-checked in both handler and worker
- Invalid/expired analysis → graceful "session expired" message

## Existing Code to Reuse

- `splitMessage()` from `src/utils/message-splitter.ts`
- `withRetry()` from `src/utils/retry.ts`
- `sendErrorAlert()` from `src/utils/admin-alerts.ts`
- `consumeCreditsOfType()` / `refundCreditsOfType()` / `hasCreditsOfType()` from `src/modules/credits/service.ts`
- `PersonaStrategy.interpret()` from `src/modules/photo-analysis/personas/`
- `registerWorker()` from `src/core/queue.ts`
- `getTopicButtonLabel()` from `src/modules/photo-analysis/keyboards.ts`

## Verification

1. `npx tsc --noEmit` — TypeScript passes
2. `npx vitest run` — all tests pass
3. Apply migration via Supabase MCP: `mcp__supabase__apply_migration`
4. Manual test in Telegram:
   - Send photo → pick "love" → verify reading appears + retopic keyboard
   - Click "career" → verify loading → new reading appears + updated keyboard (4 remaining)
   - Click another → verify keyboard shrinks
   - After 6th topic → no keyboard shown
5. Verify credits deducted correctly (1 basic per topic)
6. Verify bot restart doesn't break retopic (data is in DB, not in-memory cache)
