# 009: Personalized Daily Insights - Implementation Tasks

**Spec**: [design.md](./design.md)
**Created**: 2026-01-04

---

## Phase 1: Database

### T1.1: Create `daily_insights` migration
- [ ] Create migration `supabase/migrations/20260104_create_daily_insights.sql`
- [ ] Add table with all fields from design (id, unified_user_id, date, morning_*, evening_*, context_data, etc.)
- [ ] Add UNIQUE constraint on (unified_user_id, date)
- [ ] Add index on (unified_user_id, date DESC)
- [ ] Add RLS policies (users read own, service_role full access)
- [ ] Run Supabase migration
- **Executor**: database-architect
- **Files**: `supabase/migrations/20260104_create_daily_insights.sql`

---

## Phase 2: Backend

### T2.1: Create AI Prompts
- [ ] Create `symancy-backend/prompts/arina/morning-advice.txt`
- [ ] Create `symancy-backend/prompts/arina/evening-insight.txt`
- [ ] Follow format from design doc (placeholders: {{USER_CONTEXT}}, {{CHAT_HISTORY}}, etc.)
- **Executor**: prompt-engineer
- **Files**:
  - `symancy-backend/prompts/arina/morning-advice.txt`
  - `symancy-backend/prompts/arina/evening-insight.txt`

### T2.2: Create DailyInsightChain
- [ ] Create `symancy-backend/src/chains/daily-insight.chain.ts`
- [ ] Implement `generateMorningAdvice(context)` function
- [ ] Implement `generateEveningInsight(context, morningAdvice)` function
- [ ] Use `createArinaModel` with lower maxTokens (500)
- [ ] Load prompts from files with caching
- [ ] Query recent messages from `messages` table via `conversations`
- [ ] Query memories from `user_memories` via `searchMemories`
- [ ] Query last analysis from `analysis_history`
- [ ] Return `GeneratedInsight` with text, shortText, tokensUsed, contextData
- **Executor**: langchain-node-specialist
- **Dependencies**: T2.1
- **Files**: `symancy-backend/src/chains/daily-insight.chain.ts`
- **Patterns**: Follow existing chains (vision.chain.ts, interpretation.chain.ts)

### T2.3: Update ProactiveMessageService
- [ ] Add `"morning-insight" | "evening-insight"` to `ProactiveMessageType`
- [ ] Add `findDailyInsightUsers()` method (copy from findDailyFortuneUsers, same logic)
- **Executor**: MAIN (trivial)
- **Files**: `symancy-backend/src/services/proactive/ProactiveMessageService.ts`

### T2.4: Update Scheduler
- [ ] Replace `"daily-fortune"` with `"morning-insight"` (cron: "0 8 * * *")
- [ ] Add `"evening-insight"` (cron: "0 20 * * *")
- **Executor**: MAIN (trivial)
- **Files**: `symancy-backend/src/modules/engagement/scheduler.ts`

### T2.5: Update Worker
- [ ] Import `generateMorningAdvice`, `generateEveningInsight` from chain
- [ ] Rename `processDailyFortune` to `processMorningInsight`
- [ ] Implement AI generation per user (loop, generate, save to daily_insights, send)
- [ ] Add `saveMorningInsight(userId, insight)` helper
- [ ] Add `processEveningInsight` job handler
- [ ] Register new workers in `registerEngagementWorkers()`
- **Executor**: node-backend-specialist
- **Dependencies**: T1.1, T2.2, T2.3, T2.4
- **Files**: `symancy-backend/src/modules/engagement/worker.ts`
- **Patterns**: Follow existing pattern with proactiveService

### T2.6: Create API Endpoint
- [ ] Create `symancy-backend/src/api/insights/today.ts`
- [ ] Implement `GET /api/insights/today` handler
- [ ] Require JWT auth (request.user.sub)
- [ ] Query daily_insights by unified_user_id and today's date
- [ ] Return morning or evening based on current hour (>=20 = evening)
- [ ] Register route in API index
- **Executor**: api-builder
- **Dependencies**: T1.1
- **Files**:
  - `symancy-backend/src/api/insights/today.ts`
  - `symancy-backend/src/api/insights/index.ts`

---

## Phase 3: Frontend

### T3.1: Update DailyInsightCard
- [ ] Add state for API insight data
- [ ] Add useEffect to fetch `/api/insights/today` with auth token
- [ ] Use API content if available, fallback to static
- [ ] Change icon based on type (morning: sun, evening: moon)
- [ ] Change title based on type (morning/evening)
- [ ] Remove "Learn more" button in WebApp mode (isWebApp check)
- **Executor**: react-vite-specialist
- **Dependencies**: T2.6
- **Files**: `src/components/features/home/DailyInsightCard.tsx`

### T3.2: Add i18n Keys
- [ ] Add `home.eveningInsight` key (ru, en, zh)
- [ ] Add `home.morningInsight` key (ru, en, zh) - optional, can use existing
- **Executor**: MAIN (trivial)
- **Files**: `src/lib/i18n.ts`

---

## Phase 4: Validation

### T4.1: Type-check and Build
- [ ] Run `pnpm type-check` in root
- [ ] Run `pnpm build` in root
- [ ] Run `pnpm type-check` in symancy-backend
- [ ] Fix any TypeScript errors
- **Executor**: MAIN

---

## Execution Order

```
Parallel Group 1 (no dependencies):
├── T1.1: Database migration (database-architect)
├── T2.1: Create prompts (prompt-engineer)
└── T3.2: Add i18n keys (MAIN)

Sequential after Group 1:
├── T2.2: DailyInsightChain (langchain-node-specialist) - needs T2.1
├── T2.3: Update ProactiveMessageService (MAIN) - trivial
├── T2.4: Update Scheduler (MAIN) - trivial
└── T2.6: API Endpoint (api-builder) - needs T1.1

Sequential after T2.2-T2.4:
└── T2.5: Update Worker (node-backend-specialist) - needs T1.1, T2.2, T2.3, T2.4

Sequential after T2.6:
└── T3.1: Update DailyInsightCard (react-vite-specialist) - needs T2.6

Final:
└── T4.1: Type-check and Build (MAIN)
```

---

## Artifacts Tracking

| Task | Status | Artifacts |
|------|--------|-----------|
| T1.1 | [X] | [20260104000000_create_daily_insights.sql](../../supabase/migrations/20260104000000_create_daily_insights.sql), [20260104100619_fix_daily_insights_rls_performance.sql](../../supabase/migrations/20260104100619_fix_daily_insights_rls_performance.sql) |
| T2.1 | [X] | [morning-advice.txt](../../symancy-backend/prompts/arina/morning-advice.txt), [evening-insight.txt](../../symancy-backend/prompts/arina/evening-insight.txt) |
| T2.2 | [X] | [daily-insight.chain.ts](../../symancy-backend/src/chains/daily-insight.chain.ts) |
| T2.3 | [X] | [ProactiveMessageService.ts](../../symancy-backend/src/services/proactive/ProactiveMessageService.ts) |
| T2.4 | [X] | [scheduler.ts](../../symancy-backend/src/modules/engagement/scheduler.ts) |
| T2.5 | [X] | [worker.ts](../../symancy-backend/src/modules/engagement/worker.ts) |
| T2.6 | [X] | [today.ts](../../symancy-backend/src/api/insights/today.ts), [index.ts](../../symancy-backend/src/api/insights/index.ts) |
| T3.1 | [X] | [DailyInsightCard.tsx](../../src/components/features/home/DailyInsightCard.tsx) |
| T3.2 | [X] | [i18n.ts](../../src/lib/i18n.ts) |
| T4.1 | [X] | type-check PASSED, build PASSED |
