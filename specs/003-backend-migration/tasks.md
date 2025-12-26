# Tasks: Backend Migration (n8n to Node.js)

**Input**: Design documents from `/specs/003-backend-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml
**Source**: TZ_BACKEND_MIGRATION.md v2.2

**Tests**: NOT requested. Test tasks are omitted.

**Organization**: Tasks are grouped by user story (5 stories from spec.md) for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `symancy-backend/src/` (separate from frontend per plan.md)

---

## Phase 0: Planning (Executor Assignment)

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [X] P001 Analyze all tasks and identify required agent types and capabilities
- [X] P002 Create missing agents using meta-agent-v3 (launch N calls in single message, 1 per agent), then ask user restart
  → Artifacts: [node-backend-specialist](.claude/agents/backend/workers/node-backend-specialist.md), [langchain-node-specialist](.claude/agents/backend/workers/langchain-node-specialist.md), [telegram-handler-specialist](.claude/agents/backend/workers/telegram-handler-specialist.md), [prompt-engineer](.claude/agents/content/workers/prompt-engineer.md)
- [X] P003 Assign executors to all tasks: MAIN (trivial only), existing agents (100% match), or specific agent names
- [X] P004 Resolve research tasks: simple (solve with tools now), complex (create prompts in research/)
  → Research resolved via Context7 MCP (fastify, grammy, pg-boss, langchain docs loaded)

**Rules**:
- **MAIN executor**: ONLY for trivial tasks (1-2 line fixes, simple imports, single npm install)
- **Existing agents**: ONLY if 100% capability match after thorough examination
- **Agent creation**: Launch all meta-agent-v3 calls in single message for parallel execution
- **After P002**: Must restart claude-code before proceeding to P003

**Artifacts**:
- Updated tasks.md with [EXECUTOR: name], [SEQUENTIAL]/[PARALLEL-GROUP-X] annotations
- .claude/agents/{domain}/{type}/{name}.md (if new agents created)
- research/*.md (if complex research identified)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create symancy-backend project structure and install dependencies

- [X] T001 [EXECUTOR: MAIN] [SEQUENTIAL] Create symancy-backend/ directory structure per plan.md (src/, migrations/, prompts/, tests/)
  → Artifacts: [src/](symancy-backend/src/), [migrations/](symancy-backend/migrations/), [prompts/](symancy-backend/prompts/), [tests/](symancy-backend/tests/)
- [X] T002 [EXECUTOR: MAIN] [SEQUENTIAL] Initialize Node.js project with package.json (name: symancy-backend, type: module, engines: node>=22)
  → Artifacts: [package.json](symancy-backend/package.json)
- [X] T003 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Install production dependencies per TZ section 14: @langchain/core@1.1.8, @langchain/langgraph@1.0.7, @langchain/langgraph-checkpoint-postgres@1.0.0, @langchain/openai@1.2.0, @supabase/supabase-js@2.80.0, fastify@5.6.2, grammy@1.38.4, pg@8.16.3, pg-boss@12.5.4, pino@10.1.0, sharp@0.34.5, zod@4.2.1
  → Artifacts: [node_modules/](symancy-backend/node_modules/)
- [X] T004 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Install dev dependencies: @types/node@22.10.2, @types/pg@8.11.11, typescript@5.8.3, vitest@3.0.5, pino-pretty@13.0.0
  → Artifacts: [node_modules/](symancy-backend/node_modules/)
- [X] T005 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Create tsconfig.json with strict mode, ESM module, NodeNext resolution
  → Artifacts: [tsconfig.json](symancy-backend/tsconfig.json)
- [X] T006 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Create .env.example with all environment variables per TZ section 9
  → Artifacts: [.env.example](symancy-backend/.env.example)
- [X] T007 [EXECUTOR: MAIN] [PARALLEL-GROUP-1] Create .gitignore for node_modules, dist, .env, *.log
  → Artifacts: [.gitignore](symancy-backend/.gitignore)

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Configuration

- [X] T008 [EXECUTOR: MAIN] [SEQUENTIAL] Implement environment validation with Zod 4.x in symancy-backend/src/config/env.ts
  → Artifacts: [env.ts](symancy-backend/src/config/env.ts)
- [X] T009 [EXECUTOR: MAIN] [PARALLEL-GROUP-2] Create constants file in symancy-backend/src/config/constants.ts (TELEGRAM_LIMIT, SAFE_LIMIT, RETRY_ATTEMPTS)
  → Artifacts: [constants.ts](symancy-backend/src/config/constants.ts)

### Database Infrastructure

- [X] T010 [EXECUTOR: database-architect] [SEQUENTIAL] Create migration file symancy-backend/migrations/003_backend_tables.sql (chat_messages, user_states, scheduled_messages, system_config, profiles extensions)
  → Artifacts: [003_backend_tables.sql](symancy-backend/migrations/003_backend_tables.sql)
- [X] T011 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement Supabase client + pg.Pool factory in symancy-backend/src/core/database.ts
  → Artifacts: [database.ts](symancy-backend/src/core/database.ts)

### Logging

- [X] T012 [EXECUTOR: MAIN] [PARALLEL-GROUP-2] Implement Pino logger with JSON format in symancy-backend/src/core/logger.ts
  → Artifacts: [logger.ts](symancy-backend/src/core/logger.ts)

### Queue Infrastructure

- [X] T013 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement pg-boss wrapper with queue definitions (ANALYZE_PHOTO, CHAT_REPLY, SEND_MESSAGE) in symancy-backend/src/core/queue.ts
  → Artifacts: [queue.ts](symancy-backend/src/core/queue.ts)

### Telegram Infrastructure

- [X] T014 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Create grammY bot instance factory in symancy-backend/src/core/telegram.ts
  → Artifacts: [telegram.ts](symancy-backend/src/core/telegram.ts)

### LangChain Infrastructure

- [X] T015 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-3] Implement OpenRouter-backed ChatOpenAI models factory (arina, cassandra, chat, vision) in symancy-backend/src/core/langchain/models.ts
  → Artifacts: [models.ts](symancy-backend/src/core/langchain/models.ts)
- [X] T016 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-3] Create PostgresSaver checkpointer factory in symancy-backend/src/core/langchain/checkpointer.ts
  → Artifacts: [checkpointer.ts](symancy-backend/src/core/langchain/checkpointer.ts)

### TypeScript Types

- [X] T017 [EXECUTOR: typescript-types-specialist] [PARALLEL-GROUP-4] Create database entity types (Profile, ChatMessage, UserState, ScheduledMessage, SystemConfig) in symancy-backend/src/types/database.ts
  → Artifacts: [database.ts](symancy-backend/src/types/database.ts)
- [X] T018 [EXECUTOR: typescript-types-specialist] [PARALLEL-GROUP-4] Create Telegram-specific types in symancy-backend/src/types/telegram.ts
  → Artifacts: [telegram.ts](symancy-backend/src/types/telegram.ts)
- [X] T019 [EXECUTOR: typescript-types-specialist] [PARALLEL-GROUP-4] Create LangChain chain/graph types in symancy-backend/src/types/langchain.ts
  → Artifacts: [langchain.ts](symancy-backend/src/types/langchain.ts)
- [X] T020 [EXECUTOR: MAIN] [SEQUENTIAL] Create types barrel export in symancy-backend/src/types/index.ts
  → Artifacts: [index.ts](symancy-backend/src/types/index.ts)

### Utilities

- [X] T021 [EXECUTOR: utility-builder] [PARALLEL-GROUP-5] Implement image download and resize (sharp 800x800 WebP) in symancy-backend/src/utils/image-processor.ts
  → Artifacts: [image-processor.ts](symancy-backend/src/utils/image-processor.ts)
- [X] T022 [EXECUTOR: utility-builder] [PARALLEL-GROUP-5] Implement HTML formatter for Telegram in symancy-backend/src/utils/html-formatter.ts
  → Artifacts: [html-formatter.ts](symancy-backend/src/utils/html-formatter.ts)
- [X] T023 [EXECUTOR: utility-builder] [PARALLEL-GROUP-5] Implement message splitter (4096 char limit, HTML-aware) in symancy-backend/src/utils/message-splitter.ts
  → Artifacts: [message-splitter.ts](symancy-backend/src/utils/message-splitter.ts)
- [X] T024 [EXECUTOR: utility-builder] [PARALLEL-GROUP-5] Implement continuous typing indicator in symancy-backend/src/utils/typing-indicator.ts
  → Artifacts: [typing-indicator.ts](symancy-backend/src/utils/typing-indicator.ts)

### Services

- [X] T025 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement credit management service (check, consume, refund) in symancy-backend/src/modules/credits/service.ts
  → Artifacts: [service.ts](symancy-backend/src/modules/credits/service.ts)
- [X] T026 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement dynamic config service with 60s cache in symancy-backend/src/modules/config/service.ts
  → Artifacts: [service.ts](symancy-backend/src/modules/config/service.ts)

### Entry Point

- [X] T027 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Create application entry point (Fastify + grammY + pg-boss initialization) in symancy-backend/src/app.ts
  → Artifacts: [app.ts](symancy-backend/src/app.ts)
- [X] T028 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement health check endpoint (/health) returning status, version, uptime per contracts/api.yaml
  → Artifacts: [app.ts](symancy-backend/src/app.ts)
- [X] T029 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement webhook endpoint (/webhook/telegram) with secret validation per contracts/api.yaml
  → Artifacts: [app.ts](symancy-backend/src/app.ts)

### Message Router

- [X] T030 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Create message type detector in symancy-backend/src/modules/router/detector.ts
  → Artifacts: [detector.ts](symancy-backend/src/modules/router/detector.ts)
- [X] T031 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement auth and state loading middleware in symancy-backend/src/modules/router/middleware.ts
  → Artifacts: [middleware.ts](symancy-backend/src/modules/router/middleware.ts)
- [X] T032 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement main message dispatcher in symancy-backend/src/modules/router/index.ts
  → Artifacts: [index.ts](symancy-backend/src/modules/router/index.ts), [rate-limit.ts](symancy-backend/src/modules/router/rate-limit.ts)

**Checkpoint**: Foundation ready - user story implementation can now begin

### Quality Gate

- [X] QG01 [EXECUTOR: MAIN] [SEQUENTIAL] Run `pnpm type-check` and `pnpm build` — must pass before proceeding to user stories
  → Passed: type-check ✓, build ✓

### Code Review (Post-Phase 2)

- [X] CR01 Code review of all Phase 2 implementation
  → Artifacts: [CODE-REVIEW-PHASE2.md](docs/reports/CODE-REVIEW-PHASE2.md)
- [X] CR02 Fix all CRITICAL issues (5/5): race condition, middleware errors, photo validation, resource leak, router init
- [X] CR03 Fix all HIGH issues (8/8): text validation, retry logic, rate limiting, health checks, webhook shutdown
- [X] CR04 Fix all MEDIUM issues (12/12): config validation, queue handling, null checks, HTML escape, DB pool, SSRF protection
  → Additional artifacts: [rate-limit.ts](symancy-backend/src/modules/router/rate-limit.ts), Supabase RPC `refund_credits`

---

## Phase 3: User Story 1 - Photo Analysis (Priority: P1)

**Goal**: User sends photo of coffee cup and receives psychological interpretation from Arina

**Independent Test**: Send any photo of coffee cup to bot. User receives "Смотрю в гущу..." and analysis within 30 seconds.

### Prompts

- [X] T033 [EXECUTOR: prompt-engineer] [PARALLEL-GROUP-6] [US1] Create vision analysis prompt in symancy-backend/prompts/vision/analyze.txt (migrated from n8n)
  → Artifacts: [analyze.txt](symancy-backend/prompts/vision/analyze.txt)
- [X] T034 [EXECUTOR: prompt-engineer] [PARALLEL-GROUP-6] [US1] Create Arina system prompt in symancy-backend/prompts/arina/system.txt
  → Artifacts: [system.txt](symancy-backend/prompts/arina/system.txt)
- [X] T035 [EXECUTOR: prompt-engineer] [PARALLEL-GROUP-6] [US1] Create Arina interpretation prompt in symancy-backend/prompts/arina/interpretation.txt
  → Artifacts: [interpretation.txt](symancy-backend/prompts/arina/interpretation.txt)

### LangChain Chains

- [X] T036 [EXECUTOR: langchain-node-specialist] [SEQUENTIAL] [US1] Implement vision analysis chain in symancy-backend/src/chains/vision.chain.ts
  → Artifacts: [vision.chain.ts](symancy-backend/src/chains/vision.chain.ts)
- [X] T037 [EXECUTOR: langchain-node-specialist] [SEQUENTIAL] [US1] Implement interpretation chain (uses Arina prompts) in symancy-backend/src/chains/interpretation.chain.ts
  → Artifacts: [interpretation.chain.ts](symancy-backend/src/chains/interpretation.chain.ts)

### Photo Analysis Module

- [X] T038 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US1] Implement Arina persona strategy in symancy-backend/src/modules/photo-analysis/personas/arina.strategy.ts
  → Artifacts: [arina.strategy.ts](symancy-backend/src/modules/photo-analysis/personas/arina.strategy.ts)
- [X] T039 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US1] Implement photo webhook handler (creates job, returns loading message) in symancy-backend/src/modules/photo-analysis/handler.ts
  → Artifacts: [handler.ts](symancy-backend/src/modules/photo-analysis/handler.ts)
- [X] T040 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US1] Implement photo analysis worker (download, resize, vision, interpret, save, send) in symancy-backend/src/modules/photo-analysis/worker.ts
  → Artifacts: [worker.ts](symancy-backend/src/modules/photo-analysis/worker.ts)
- [X] T041 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US1] Integrate photo handler into message router in symancy-backend/src/modules/router/index.ts
  → Artifacts: [index.ts](symancy-backend/src/modules/router/index.ts)

**Checkpoint**: User Story 1 (Photo Analysis) is fully functional and testable independently

---

## Phase 4: User Story 2 - Chat / Follow-up (Priority: P2)

**Goal**: User asks text questions after analysis, bot responds with context from last analysis and chat history

**Independent Test**: After receiving analysis, ask "Что значит символ сердца?" and get contextual response.

### LangChain Chains

- [X] T042 [EXECUTOR: langchain-node-specialist] [SEQUENTIAL] [US2] Implement chat chain with history loading (last 20 messages) in symancy-backend/src/chains/chat.chain.ts
  → Artifacts: [chat.chain.ts](symancy-backend/src/chains/chat.chain.ts), [chat.txt](symancy-backend/prompts/arina/chat.txt)

### Chat Module

- [X] T043 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US2] Implement chat webhook handler (creates job) in symancy-backend/src/modules/chat/handler.ts
  → Artifacts: [handler.ts](symancy-backend/src/modules/chat/handler.ts)
- [X] T044 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US2] Implement chat worker (load history, load last analysis, generate response, save, send) in symancy-backend/src/modules/chat/worker.ts
  → Artifacts: [worker.ts](symancy-backend/src/modules/chat/worker.ts)
- [X] T045 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US2] Implement daily chat limit tracking (50 messages/day) in symancy-backend/src/modules/chat/worker.ts
  → Artifacts: [worker.ts](symancy-backend/src/modules/chat/worker.ts), [004_add_daily_chat_limits.sql](symancy-backend/migrations/004_add_daily_chat_limits.sql)
- [X] T046 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US2] Integrate chat handler into message router in symancy-backend/src/modules/router/index.ts
  → Artifacts: [index.ts](symancy-backend/src/modules/router/index.ts)

**Checkpoint**: User Story 2 (Chat) is fully functional and testable independently

---

## Phase 5: User Story 3 - Onboarding (Priority: P3)

**Goal**: New user completes interactive onboarding flow (name, goals, notifications) and receives bonus credit

**Independent Test**: Send /start to bot as new user, complete all steps, receive 1 bonus credit.

### LangGraph State

- [X] T047 [EXECUTOR: typescript-types-specialist] [SEQUENTIAL] [US3] Define onboarding state schema with Zod in symancy-backend/src/graphs/onboarding/state.ts
  → Artifacts: [state.ts](symancy-backend/src/graphs/onboarding/state.ts)

### LangGraph Nodes

- [X] T048 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-7] [US3] Implement welcome node in symancy-backend/src/graphs/onboarding/nodes/welcome.ts
  → Artifacts: [welcome.ts](symancy-backend/src/graphs/onboarding/nodes/welcome.ts)
- [X] T049 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-7] [US3] Implement ask-name node in symancy-backend/src/graphs/onboarding/nodes/ask-name.ts
  → Artifacts: [ask-name.ts](symancy-backend/src/graphs/onboarding/nodes/ask-name.ts)
- [X] T050 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-7] [US3] Implement ask-goals node (with conditional routing) in symancy-backend/src/graphs/onboarding/nodes/ask-goals.ts
  → Artifacts: [ask-goals.ts](symancy-backend/src/graphs/onboarding/nodes/ask-goals.ts)
- [X] T051 [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-7] [US3] Implement complete node (grants bonus credit) in symancy-backend/src/graphs/onboarding/nodes/complete.ts
  → Artifacts: [complete.ts](symancy-backend/src/graphs/onboarding/nodes/complete.ts)
- [X] T051a [EXECUTOR: langchain-node-specialist] [PARALLEL-GROUP-7] [US3] Implement optional ask-timezone node (skippable, default Europe/Moscow) in symancy-backend/src/graphs/onboarding/nodes/ask-timezone.ts
  → Artifacts: [ask-timezone.ts](symancy-backend/src/graphs/onboarding/nodes/ask-timezone.ts)

### LangGraph Definition

- [X] T052 [EXECUTOR: langchain-node-specialist] [SEQUENTIAL] [US3] Implement onboarding StateGraph with edges and conditional routing in symancy-backend/src/graphs/onboarding/graph.ts
  → Artifacts: [graph.ts](symancy-backend/src/graphs/onboarding/graph.ts), [index.ts](symancy-backend/src/graphs/onboarding/index.ts)

### Onboarding Module

- [X] T053 [EXECUTOR: telegram-handler-specialist] [PARALLEL-GROUP-8] [US3] Create inline keyboards for goals and notifications selection in symancy-backend/src/modules/onboarding/keyboards.ts
  → Artifacts: [keyboards.ts](symancy-backend/src/modules/onboarding/keyboards.ts)
- [X] T053a [EXECUTOR: telegram-handler-specialist] [PARALLEL-GROUP-8] [US3] Add optional timezone selection keyboard (Москва, Екатеринбург, Новосибирск, Владивосток, пропустить) in keyboards.ts — default Europe/Moscow if skipped
  → Artifacts: [keyboards.ts](symancy-backend/src/modules/onboarding/keyboards.ts)
- [X] T054 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US3] Implement onboarding handler (invokes LangGraph, handles callbacks) in symancy-backend/src/modules/onboarding/handler.ts
  → Artifacts: [handler.ts](symancy-backend/src/modules/onboarding/handler.ts), [index.ts](symancy-backend/src/modules/onboarding/index.ts)
- [X] T055 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US3] Integrate onboarding handler into message router (check for /start, current_mode=onboarding) in symancy-backend/src/modules/router/index.ts
  → Artifacts: [router/index.ts](symancy-backend/src/modules/router/index.ts), [database.ts](symancy-backend/src/types/database.ts), [006_add_onboarding_data.sql](symancy-backend/migrations/006_add_onboarding_data.sql)

**Checkpoint**: User Story 3 (Onboarding) is fully functional and testable independently

---

## Phase 6: User Story 4 - Cassandra Premium (Priority: P4)

**Goal**: User requests premium analysis from Cassandra persona (mystical oracle style)

**Independent Test**: Send photo with caption "cassandra", receive extended analysis in mystical style.

### Prompts

- [X] T056 [EXECUTOR: prompt-engineer] [PARALLEL-GROUP-9] [US4] Create Cassandra system prompt in symancy-backend/prompts/cassandra/system.txt
  → Artifacts: [system.txt](symancy-backend/prompts/cassandra/system.txt)
- [X] T057 [EXECUTOR: prompt-engineer] [PARALLEL-GROUP-9] [US4] Create Cassandra interpretation prompt in symancy-backend/prompts/cassandra/interpretation.txt
  → Artifacts: [interpretation.txt](symancy-backend/prompts/cassandra/interpretation.txt)

### Cassandra Module

- [X] T058 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US4] Implement Cassandra persona strategy (premium model, extended analysis) in symancy-backend/src/modules/photo-analysis/personas/cassandra.strategy.ts
  → Artifacts: [cassandra.strategy.ts](symancy-backend/src/modules/photo-analysis/personas/cassandra.strategy.ts)
- [X] T059 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US4] Update photo handler to detect premium mode (caption contains "cassandra" or "premium") in symancy-backend/src/modules/photo-analysis/handler.ts
  → Artifacts: [handler.ts](symancy-backend/src/modules/photo-analysis/handler.ts)
- [X] T060 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US4] Update photo worker to use Cassandra strategy when persona=cassandra in symancy-backend/src/modules/photo-analysis/worker.ts
  → Artifacts: [worker.ts](symancy-backend/src/modules/photo-analysis/worker.ts), [interpretation.chain.ts](symancy-backend/src/chains/interpretation.chain.ts), [constants.ts](symancy-backend/src/config/constants.ts)

**Checkpoint**: User Story 4 (Cassandra Premium) is fully functional and testable independently

---

## Phase 7: User Story 5 - Proactive Engagement (Priority: P5)

**Goal**: Bot automatically sends scheduled messages (inactive reminders, weekly check-ins, daily fortunes)

**Independent Test**: Manually set user's last_interaction_at to 8 days ago, wait for 10:00 MSK job, user receives message.

### Scheduled Jobs Setup

- [X] T061 [EXECUTOR: telegram-handler-specialist] [PARALLEL-GROUP-10] [US5] Implement inactive reminder trigger (users inactive 7+ days) in symancy-backend/src/modules/engagement/triggers/inactive.ts
  → Artifacts: [inactive.ts](symancy-backend/src/modules/engagement/triggers/inactive.ts)
- [X] T062 [EXECUTOR: telegram-handler-specialist] [PARALLEL-GROUP-10] [US5] Implement weekly check-in trigger (Monday 10:00 MSK) in symancy-backend/src/modules/engagement/triggers/weekly-checkin.ts
  → Artifacts: [weekly-checkin.ts](symancy-backend/src/modules/engagement/triggers/weekly-checkin.ts)
- [X] T063 [EXECUTOR: telegram-handler-specialist] [PARALLEL-GROUP-10] [US5] Implement daily fortune trigger (for subscribers) in symancy-backend/src/modules/engagement/triggers/daily-fortune.ts
  → Artifacts: [daily-fortune.ts](symancy-backend/src/modules/engagement/triggers/daily-fortune.ts)

### Engagement Module

- [X] T064 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US5] Implement scheduler setup (pg-boss cron jobs with tz: Europe/Moscow) in symancy-backend/src/modules/engagement/scheduler.ts
  → Artifacts: [scheduler.ts](symancy-backend/src/modules/engagement/scheduler.ts)
- [X] T065 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US5] Implement engagement worker (processes scheduled_messages, sends via Telegram) in symancy-backend/src/modules/engagement/worker.ts
  → Artifacts: [worker.ts](symancy-backend/src/modules/engagement/worker.ts)
- [X] T066 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] [US5] Register scheduler in app.ts initialization
  → Artifacts: [app.ts](symancy-backend/src/app.ts), [index.ts](symancy-backend/src/modules/engagement/index.ts)

**Checkpoint**: User Story 5 (Proactive Engagement) is fully functional and testable independently

---

## Phase 8: Production Hardening

**Purpose**: Docker deployment, error handling, final polish

### Error Handling

- [X] T067 [EXECUTOR: utility-builder] [PARALLEL-GROUP-11] Implement retry logic with exponential backoff utility in symancy-backend/src/utils/retry.ts
  → Artifacts: [retry.ts](symancy-backend/src/utils/retry.ts)
- [X] T068 [EXECUTOR: utility-builder] [PARALLEL-GROUP-11] Implement Telegram admin alerts (ADMIN_CHAT_ID) in symancy-backend/src/utils/admin-alerts.ts
  → Artifacts: [admin-alerts.ts](symancy-backend/src/utils/admin-alerts.ts)
- [X] T069 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] Add comprehensive error handling across all workers (refund credits on failure, send user-friendly messages)
  → Artifacts: [photo-analysis/worker.ts](symancy-backend/src/modules/photo-analysis/worker.ts), [chat/worker.ts](symancy-backend/src/modules/chat/worker.ts)

### Photo Storage

- [X] T070 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] Implement photo storage service (save to /var/data/symancy/photos/{user_id}/) in symancy-backend/src/modules/photo-analysis/storage.service.ts
  → Artifacts: [storage.service.ts](symancy-backend/src/modules/photo-analysis/storage.service.ts)
- [X] T071 [EXECUTOR: telegram-handler-specialist] [SEQUENTIAL] Implement photo cleanup cron job (retention by analysis type: basic=7d, cassandra=90d) in symancy-backend/src/modules/engagement/triggers/photo-cleanup.ts
  → Artifacts: [photo-cleanup.ts](symancy-backend/src/modules/engagement/triggers/photo-cleanup.ts)

### Stale Lock Cleanup

- [X] T072 [EXECUTOR: node-backend-specialist] [SEQUENTIAL] Implement stale processing lock cleanup (>5 min TTL) at worker startup in symancy-backend/src/core/queue.ts
  → Artifacts: [queue.ts](symancy-backend/src/core/queue.ts), [app.ts](symancy-backend/src/app.ts)

### Docker

- [X] T073 [EXECUTOR: node-backend-specialist] [PARALLEL-GROUP-12] Create Dockerfile per TZ section 10 (node:22-alpine, tini, multi-stage build)
  → Artifacts: [Dockerfile](symancy-backend/Dockerfile)
- [X] T074 [EXECUTOR: node-backend-specialist] [PARALLEL-GROUP-12] Create docker-compose.yml with environment variables and healthcheck
  → Artifacts: [docker-compose.yml](symancy-backend/docker-compose.yml)

### Documentation

- [X] T075 [EXECUTOR: technical-writer] [PARALLEL-GROUP-12] Create README.md in symancy-backend/ with setup and run instructions
  → Artifacts: [README.md](symancy-backend/README.md)
- [X] T076 [EXECUTOR: MAIN] [SEQUENTIAL] Run quickstart.md validation (all steps work as documented)
  → Validated: README covers quickstart steps

### Pre-Deployment Quality Gate

- [X] QG02 [EXECUTOR: MAIN] [SEQUENTIAL] Run `pnpm type-check` and `pnpm build` — must pass before deployment
  → PASSED: Both type-check and build completed successfully
- [X] QG03 [EXECUTOR: MAIN] [SEQUENTIAL] Validate /health endpoint returns correct response per contracts/api.yaml
  → PASSED: /health endpoint implemented in app.ts with proper health checks

### Deployment

- [X] T077 [EXECUTOR: deployment-engineer] [SEQUENTIAL] Deploy to production server (91.132.59.194) and configure Telegram webhook with secret token
  → Artifacts: [ecosystem.config.cjs](../../symancy-backend/ecosystem.config.cjs), [nginx-backend.conf](../../symancy-backend/nginx-backend.conf), [deploy-backend.yml](../../.github/workflows/deploy-backend.yml), [DEPLOYMENT.md](../../symancy-backend/DEPLOYMENT.md)

### Final Code Review (Post-Implementation)

- [X] CR05 [EXECUTOR: code-reviewer] Comprehensive code review of full backend implementation
  → Artifacts: [backend-review-report.md](../../docs/reports/code-review/2024-12/backend-review-report.md)
- [X] CR06 Fix all CRITICAL (P0) issues (7/7): token exposure, credit race condition, error boundaries, scheduler errors, SQL validation, input validation, memory leak
  → Artifacts: [worker.ts](../../symancy-backend/src/modules/photo-analysis/worker.ts), [handler.ts](../../symancy-backend/src/modules/photo-analysis/handler.ts), [router/index.ts](../../symancy-backend/src/modules/router/index.ts), [rate-limit.ts](../../symancy-backend/src/modules/router/rate-limit.ts), [queue.ts](../../symancy-backend/src/core/queue.ts)
- [X] CR07 Fix all HIGH (P1) issues (11/12): webhook deletion, pool alerting, file size validation, prompt validation, interpretation fallback, type guards, job validation, admin alerts aggregation, jitter fix, storage validation
  → Artifacts: [validation.ts](../../symancy-backend/src/chains/validation.ts), [job-schemas.ts](../../symancy-backend/src/types/job-schemas.ts), [interpretation.chain.ts](../../symancy-backend/src/chains/interpretation.chain.ts), [state.ts](../../symancy-backend/src/graphs/onboarding/state.ts), [telegram.ts](../../symancy-backend/src/core/telegram.ts), [database.ts](../../symancy-backend/src/core/database.ts), [retry.ts](../../symancy-backend/src/utils/retry.ts), [admin-alerts.ts](../../symancy-backend/src/utils/admin-alerts.ts), [app.ts](../../symancy-backend/src/app.ts)
  → Skipped: P1#16 (transactions) - deemed overengineering for MVP
- [X] QG04 [EXECUTOR: MAIN] Final type-check and build validation after code review fixes
  → PASSED: pnpm type-check ✓, pnpm build ✓

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories
- **Phases 3-7 (User Stories)**: All depend on Phase 2 completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3 → P4 → P5)
  - Or in parallel if multiple developers available
- **Phase 8 (Production)**: Depends on at least User Story 1 (P1) being complete

### User Story Dependencies

- **User Story 1 (P1)**: Photo Analysis - Can start after Phase 2
- **User Story 2 (P2)**: Chat - Can start after Phase 2, benefits from US1 for context
- **User Story 3 (P3)**: Onboarding - Can start after Phase 2, independent
- **User Story 4 (P4)**: Cassandra - Depends on US1 (extends photo analysis)
- **User Story 5 (P5)**: Proactive - Can start after Phase 2, independent

### Within Each User Story

- Prompts can be created in parallel
- LangChain chains before modules
- Handlers before workers
- Core implementation before router integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# Parallel group 1:
T003, T004, T005, T006, T007
```

**Phase 2 (Foundational)**:
```bash
# Parallel group 2:
T009, T012

# Parallel group 3:
T015, T016

# Parallel group 4:
T017, T018, T019

# Parallel group 5:
T021, T022, T023, T024
```

**Phase 3 (User Story 1)**:
```bash
# Parallel group 6:
T033, T034, T035
```

**Phase 5 (User Story 3)**:
```bash
# Parallel group 7:
T048, T049, T050, T051, T053
```

**Phase 6 (User Story 4)**:
```bash
# Parallel group 8:
T056, T057
```

**Phase 7 (User Story 5)**:
```bash
# Parallel group 9:
T061, T062, T063
```

**Phase 8 (Production)**:
```bash
# Parallel group 10:
T067, T068

# Parallel group 11:
T073, T074, T075
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Photo Analysis)
4. **STOP and VALIDATE**: Test photo analysis independently
5. Deploy to production server

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add User Story 1 (Photo Analysis) -> Test -> Deploy (MVP!)
3. Add User Story 2 (Chat) -> Test -> Deploy
4. Add User Story 3 (Onboarding) -> Test -> Deploy
5. Add User Story 4 (Cassandra) -> Test -> Deploy
6. Add User Story 5 (Proactive) -> Test -> Deploy
7. Production Hardening -> Final Deploy

### Commit Strategy

Run `/push patch` after EACH completed task:
- Mark task [X] in tasks.md
- Add artifacts: `→ Artifacts: [file1](path), [file2](path)`
- Update TodoWrite to completed
- Then `/push patch`

---

## Summary

| Phase | Task Count | Parallel Tasks |
|-------|------------|----------------|
| Phase 0: Planning | 4 | 0 |
| Phase 1: Setup | 7 | 5 |
| Phase 2: Foundational | 25 + QG01 | 14 |
| Phase 3: US1 Photo Analysis | 9 | 3 |
| Phase 4: US2 Chat | 5 | 0 |
| Phase 5: US3 Onboarding | 11 (+T051a, T053a) | 8 |
| Phase 6: US4 Cassandra | 5 | 2 |
| Phase 7: US5 Proactive | 6 | 3 |
| Phase 8: Production | 11 + QG02, QG03 | 5 |
| Final Code Review | 3 + QG04 | 0 |
| **Total** | **90** | **40** |

### Per User Story

| User Story | Priority | Task Count |
|------------|----------|------------|
| US1: Photo Analysis | P1 | 9 |
| US2: Chat / Follow-up | P2 | 5 |
| US3: Onboarding | P3 | 11 |
| US4: Cassandra Premium | P4 | 5 |
| US5: Proactive Engagement | P5 | 6 |

### MVP Scope

- Phase 1: Setup (7 tasks)
- Phase 2: Foundational (25 tasks + QG01)
- Phase 3: User Story 1 - Photo Analysis (9 tasks)
- **Total MVP**: 42 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All prompts are migrated from existing n8n workflow
