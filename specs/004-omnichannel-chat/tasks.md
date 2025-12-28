# Tasks: Omnichannel Chat Architecture

**Input**: Design documents from `/specs/004-omnichannel-chat/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification. Implementation tasks only.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, etc.)
- Exact file paths included

## Path Conventions

- **Frontend**: `src/` (React + Vite)
- **Backend**: `symancy-backend/src/` (Fastify + grammY)
- **Database**: Supabase MCP migrations

---

## Phase 0: Planning (Executor Assignment)

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [ ] P001 Analyze all tasks and identify required agent types and capabilities
- [ ] P002 Create missing agents using meta-agent-v3 (launch N calls in single message, 1 per agent), then ask user restart
- [ ] P003 Assign executors to all tasks: MAIN (trivial only), existing agents (100% match), or specific agent names
- [ ] P004 Resolve research tasks: simple (solve with tools now), complex (create prompts in research/)

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

## Phase 1: Setup (Dependencies & Configuration)

**Purpose**: Install dependencies and configure environment

- [X] T001 [P] Install backend dependencies in symancy-backend/: `pnpm add @grammyjs/auto-retry @grammyjs/transformer-throttler jsonwebtoken && pnpm add -D @types/jsonwebtoken`
  → Artifacts: [package.json](symancy-backend/package.json)
- [X] T002 [P] Add SUPABASE_JWT_SECRET to symancy-backend/.env.example
  → Artifacts: [.env.example](symancy-backend/.env.example)
- [X] T003 [P] Add VITE_TELEGRAM_BOT_NAME to .env.example (frontend)
  → Artifacts: [.env.example](.env.example)

---

## Phase 2: Foundational (Database & Shared Types)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

### Database Migrations (Sequential - order matters)

- [X] T004 Create migration: unified_users table with constraints and indexes (see data-model.md)
  → Artifacts: Supabase MCP migration
- [X] T005 Create migration: conversations table with FK to unified_users
  → Artifacts: Supabase MCP migration
- [X] T006 Create migration: messages table with FK to conversations
  → Artifacts: Supabase MCP migration
- [X] T007 Create migration: message_deliveries table with FK to messages
  → Artifacts: Supabase MCP migration
- [X] T008 Create migration: link_tokens table with FK to unified_users
  → Artifacts: Supabase MCP migration
- [X] T009 Create migration: enable Realtime for messages, message_deliveries tables
  → Artifacts: Supabase MCP migration
- [X] T010 Create migration: RLS policies for all new tables
  → Artifacts: Supabase MCP migration (verified existing policies)

### Database Helper Functions

- [X] T011 Create SQL function: find_or_create_user_by_telegram() in migration
  → Artifacts: Supabase MCP migration
- [X] T012 Create SQL function: link_auth_to_telegram_user() for account merging in migration
  → Artifacts: Supabase MCP migration
- [X] T013 Create SQL function: get_or_create_conversation() in migration
  → Artifacts: Supabase MCP migration
- [X] T014 Create SQL function: check_and_increment_daily_limit() in migration
  → Artifacts: Supabase MCP migration

### Shared Types (Copy to both frontend and backend)

- [X] T015 Copy contracts/types.ts to src/types/omnichannel.ts (frontend)
  → Artifacts: [omnichannel.ts](src/types/omnichannel.ts) (pure TypeScript, no Zod)
- [X] T016 Copy contracts/types.ts to symancy-backend/src/types/omnichannel.ts (backend)
  → Artifacts: [omnichannel.ts](symancy-backend/src/types/omnichannel.ts) (with Zod schemas)

### grammY Plugin Configuration

- [X] T017 Configure auto-retry and throttler plugins in symancy-backend/src/core/telegram.ts (update bot initialization per quickstart.md)
  → Artifacts: [telegram.ts](symancy-backend/src/core/telegram.ts)

### i18n Keys

- [X] T018 Add linkTelegram and chat translation keys to src/lib/i18n.ts for all 3 languages (ru, en, zh) per quickstart.md
  → Artifacts: [i18n.ts](src/lib/i18n.ts)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Telegram User with Web Access (Priority: P1)

**Goal**: User starts chat in Telegram bot, continues on web with shared history and credits via Telegram Login Widget

**Independent Test**: User can register in Telegram bot, login on website via Telegram Login Widget, and see all chat history and credit balance

### Backend Auth Services

- [X] T019 [P] [US1] Implement TelegramAuthService with verifyTelegramAuth() in symancy-backend/src/services/auth/TelegramAuthService.ts
  → Artifacts: [TelegramAuthService.ts](symancy-backend/src/services/auth/TelegramAuthService.ts)
- [X] T020 [P] [US1] Implement JwtService with createTelegramUserToken() in symancy-backend/src/services/auth/JwtService.ts
  → Artifacts: [JwtService.ts](symancy-backend/src/services/auth/JwtService.ts)
- [X] T021 [P] [US1] Implement UnifiedUserService with findOrCreateByTelegramId() in symancy-backend/src/services/user/UnifiedUserService.ts
  → Artifacts: [UnifiedUserService.ts](symancy-backend/src/services/user/UnifiedUserService.ts)

### Backend Auth Endpoints

- [X] T022 [US1] Implement POST /api/auth/telegram endpoint in symancy-backend/src/api/auth/telegram-login.ts (depends on T019, T020, T021)
  → Artifacts: [telegram-login.ts](symancy-backend/src/api/auth/telegram-login.ts)
- [X] T023 [US1] Implement GET /api/auth/me endpoint in symancy-backend/src/api/auth/me.ts
  → Artifacts: [me.ts](symancy-backend/src/api/auth/me.ts)
- [X] T024 [US1] Register auth routes in Fastify router symancy-backend/src/app.ts
  → Artifacts: [app.ts](symancy-backend/src/app.ts), [index.ts](symancy-backend/src/api/auth/index.ts)

### Frontend Auth Components

- [X] T025 [P] [US1] Create TelegramLoginButton component in src/components/features/auth/TelegramLoginButton.tsx (script injection per quickstart.md)
  → Artifacts: [TelegramLoginButton.tsx](src/components/features/auth/TelegramLoginButton.tsx)
- [X] T026 [P] [US1] Create authService with telegramLogin() in src/services/authService.ts
  → Artifacts: [authService.ts](src/services/authService.ts)

### Frontend Auth Integration

- [X] T027 [US1] Update AuthContext to support custom JWT for Telegram users in src/contexts/AuthContext.tsx
  → Artifacts: [AuthContext.tsx](src/contexts/AuthContext.tsx)
- [X] T028 [US1] Update supabaseClient to accept custom JWT via accessToken in src/lib/supabaseClient.ts
  → Artifacts: [supabaseClient.ts](src/lib/supabaseClient.ts)
- [X] T029 [US1] Add TelegramLoginButton to AuthModal in src/components/features/auth/AuthModal.tsx
  → Artifacts: [AuthModal.tsx](src/components/features/auth/AuthModal.tsx)

### Credits Display (Shared)

- [X] T030 [US1] Update credits display component to fetch from unified user_credits table (if existing component needs update)
  → Artifacts: [paymentService.ts](src/services/paymentService.ts)

**Checkpoint**: User Story 1 complete - Telegram users can login on web and see shared credits

---

## Phase 4: User Story 2 - Real-time Conversation Sync (Priority: P1)

**Goal**: Users receive assistant responses in real-time regardless of message source channel

**Independent Test**: Sending message from any channel results in response appearing in same channel without page reload

### Backend Message Services

- [X] T031 [P] [US2] Implement MessageRouter with routeToChannel() in symancy-backend/src/services/routing/MessageRouter.ts
  → Artifacts: [MessageRouter.ts](symancy-backend/src/services/routing/MessageRouter.ts), [index.ts](symancy-backend/src/services/routing/index.ts), [README.md](symancy-backend/src/services/routing/README.md)
- [X] T032 [P] [US2] Implement DeliveryService with deliverToTelegram(), deliverToRealtime() and retry logic in symancy-backend/src/services/delivery/DeliveryService.ts
  → Artifacts: [DeliveryService.ts](symancy-backend/src/services/delivery/DeliveryService.ts), [README.md](symancy-backend/src/services/delivery/README.md)

### Backend Message Endpoint

- [X] T033 [US2] Implement POST /api/messages endpoint in symancy-backend/src/api/messages/send-message.ts (depends on T031, T032)
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T034 [US2] Register message routes in Fastify router symancy-backend/src/app.ts
  → Artifacts: [index.ts](symancy-backend/src/api/messages/index.ts), [app.ts](symancy-backend/src/app.ts)

### Frontend Chat Components

- [X] T035 [P] [US2] Create useRealtimeChat hook with Supabase subscription and reconnection in src/hooks/useRealtimeChat.ts (per quickstart.md)
  → Artifacts: [useRealtimeChat.ts](src/hooks/useRealtimeChat.ts)
- [X] T036 [P] [US2] Create ChatWindow component in src/components/features/chat/ChatWindow.tsx
  → Artifacts: [ChatWindow.tsx](src/components/features/chat/ChatWindow.tsx)
- [X] T037 [P] [US2] Create MessageBubble component in src/components/features/chat/MessageBubble.tsx
  → Artifacts: [MessageBubble.tsx](src/components/features/chat/MessageBubble.tsx)
- [X] T038 [P] [US2] Create ChannelIndicator component in src/components/features/chat/ChannelIndicator.tsx
  → Artifacts: [ChannelIndicator.tsx](src/components/features/chat/ChannelIndicator.tsx)

### Frontend Chat Page

- [X] T039 [US2] Create web chat page that uses ChatWindow and useRealtimeChat in src/pages/Chat.tsx (or integrate into existing page)
  → Artifacts: [Chat.tsx](src/pages/Chat.tsx), [App.tsx](src/App.tsx), [i18n.ts](src/lib/i18n.ts)

### Telegram Bot Message Handling

- [X] T040 [US2] Update Telegram bot message handler to store messages with channel='telegram', interface='bot' in symancy-backend/ (update existing message handler)
  → Artifacts: [handler.ts](symancy-backend/src/modules/chat/handler.ts), [ConversationService.ts](symancy-backend/src/services/conversation/ConversationService.ts), [conversation/index.ts](symancy-backend/src/services/conversation/index.ts), [job-schemas.ts](symancy-backend/src/types/job-schemas.ts)

### Code Review & Fixes (2024-12-28)

- [X] T040a Code review of Phase 4 implementation (29 issues identified)
  → Artifacts: [phase4-code-review.md](docs/reports/code-review/2024-12/phase4-code-review.md)
- [X] T040b [CRITICAL-1] Fix SQL injection vulnerability - add UUID validation before database queries
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T040c [CRITICAL-2] Fix JWT error handling - wrap verifyToken in try-catch
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T040d [HIGH-1] Fix race condition in reconnection logic - add reconnectInProgressRef
  → Artifacts: [useRealtimeChat.ts](src/hooks/useRealtimeChat.ts)
- [X] T040e [HIGH-2] Fix memory leak in deduplication - use Set for O(1) lookup
  → Artifacts: [useRealtimeChat.ts](src/hooks/useRealtimeChat.ts)
- [X] T040f [HIGH-3] Add rate limiting to send-message endpoint (20 req/min)
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T040g [HIGH-4] Fix XSS vulnerability - add DOMPurify sanitization
  → Artifacts: [MessageBubble.tsx](src/components/features/chat/MessageBubble.tsx)
- [X] T040h [HIGH-5] Fix useEffect dependency array violations
  → Artifacts: [useRealtimeChat.ts](src/hooks/useRealtimeChat.ts)
- [X] T040i [HIGH-6] Add mount check to prevent setState after unmount
  → Artifacts: [useRealtimeChat.ts](src/hooks/useRealtimeChat.ts)
- [X] T040j [HIGH-7] Improve error recovery with fail-safe retry logic
  → Artifacts: [DeliveryService.ts](symancy-backend/src/services/delivery/DeliveryService.ts)
- [X] T040k [HIGH-8] Add metadata sanitization before database insert
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T040l [MED-7] Add database indexes for performance (5 indexes via Supabase MCP)
  → Artifacts: Supabase MCP migration
- [X] T040m [MED-8] Add maximum message length validation (4000 chars)
  → Artifacts: [send-message.ts](symancy-backend/src/api/messages/send-message.ts)
- [X] T040n [MED-1] Fix TypeScript any type in Chat.tsx translation function
  → Artifacts: [Chat.tsx](src/pages/Chat.tsx)
- [X] T040o [LOW-6] Fix dark mode inline styles in connection warning banner
  → Artifacts: [ChatWindow.tsx](src/components/features/chat/ChatWindow.tsx)

**Checkpoint**: User Story 2 complete - Real-time sync works between web and Telegram

---

## Phase 5: User Story 3 - Web-only User Journey (Priority: P2)

**Goal**: Users can register via web (email/OAuth) without Telegram but see prompt to connect Telegram

**Independent Test**: User can register on website without Telegram, chat with assistant, and later link Telegram account

### Frontend Telegram Link Prompt

- [X] T041 [P] [US3] Create TelegramLinkPrompt component in src/components/features/auth/TelegramLinkPrompt.tsx (shows benefits of connecting Telegram)
  → Artifacts: [TelegramLinkPrompt.tsx](src/components/features/auth/TelegramLinkPrompt.tsx)

### Backend Web User Support

- [X] T042 [US3] Update UnifiedUserService to support creating user from auth_id (Supabase Auth) in symancy-backend/src/services/user/UnifiedUserService.ts
  → Artifacts: [UnifiedUserService.ts](symancy-backend/src/services/user/UnifiedUserService.ts), Supabase MCP migration (find_or_create_user_by_auth_id)

### Frontend Integration

- [X] T043 [US3] Show TelegramLinkPrompt to web-only users (is_telegram_linked=false) in appropriate layout component
  → Artifacts: [Chat.tsx](src/pages/Chat.tsx)
- [ ] T044 [US3] Ensure chat works for web-only users with channel='web', interface='browser'

**Checkpoint**: User Story 3 complete - Web-only registration works with Telegram link prompt

---

## Phase 6: User Story 4 - Telegram WebApp Experience (Priority: P2)

**Goal**: Users can open WebApp from Telegram bot button and continue conversation with auto-auth

**Independent Test**: User clicks WebApp button in Telegram, WebApp opens with automatic authentication, chat history visible

### Backend WebApp Auth

- [ ] T045 [P] [US4] Implement verifyWebAppInitData() in symancy-backend/src/services/auth/TelegramAuthService.ts (add to existing service)
- [ ] T046 [US4] Implement POST /api/auth/webapp endpoint in symancy-backend/src/api/auth/webapp-auth.ts

### Frontend WebApp Support

- [ ] T047 [US4] Create WebApp initialization hook that reads initData from Telegram.WebApp in src/hooks/useTelegramWebApp.ts
- [ ] T048 [US4] Update AuthContext to auto-authenticate from WebApp initData in src/contexts/AuthContext.tsx

### Telegram Bot WebApp Button

- [ ] T049 [US4] Add WebApp button to Telegram bot menu (grammY setMyCommands or inline keyboard)

**Checkpoint**: User Story 4 complete - WebApp opens with seamless auth from Telegram

---

## Phase 7: User Story 5 - Proactive Messaging (Priority: P3)

**Goal**: System sends proactive messages (reminders, engagement) only to users with messenger channel

**Independent Test**: Scheduled trigger sends message to Telegram users only, web-only users receive nothing

### Backend Proactive Service

- [ ] T050 [P] [US5] Create ProactiveMessageService in symancy-backend/src/services/proactive/ProactiveMessageService.ts
- [ ] T051 [US5] Implement sendEngagementMessage() that checks is_telegram_linked before sending

### Backend Job Queue (Optional - if pg-boss not already configured for this)

- [ ] T052 [US5] Create proactive message pg-boss worker in symancy-backend/src/workers/proactive-worker.ts

### Telegram Delivery with Error Handling

- [ ] T053 [US5] Update DeliveryService to handle bot blocked (USER_BLOCKED_BOT) and mark user inactive in symancy-backend/src/services/delivery/DeliveryService.ts

**Checkpoint**: User Story 5 complete - Proactive messaging works for Telegram users only

---

## Phase 8: User Story 6 - Account Linking via /link Command (Priority: P3)

**Goal**: Telegram users can generate one-time link to connect existing web account

**Independent Test**: /link command generates URL, opening URL while logged in on web links accounts

### Backend Link Token

- [ ] T054 [P] [US6] Implement generateLinkToken() in symancy-backend/src/services/auth/LinkTokenService.ts
- [ ] T055 [P] [US6] Implement validateAndConsumeLinkToken() in symancy-backend/src/services/auth/LinkTokenService.ts

### Backend Link Endpoints

- [ ] T056 [US6] Implement POST /api/auth/link-token endpoint in symancy-backend/src/api/auth/link-token.ts (depends on T054)
- [ ] T057 [US6] Implement POST /api/auth/link endpoint in symancy-backend/src/api/auth/link.ts (depends on T055)

### Telegram Bot /link Command

- [ ] T058 [US6] Implement /link command handler in symancy-backend/src/handlers/link-command.ts

### Frontend Link Page

- [ ] T059 [US6] Create /link page that consumes token and links accounts in src/pages/Link.tsx

### Account Merge Logic

- [ ] T060 [US6] Implement account merge (credits sum, history preserve) in UnifiedUserService.linkAuthToTelegram()

**Checkpoint**: User Story 6 complete - /link command enables account linking

---

## Phase 9: Data Migration (Existing Users)

**Purpose**: Migrate existing profiles and chat_messages to new unified schema

- [ ] T061 Create migration: profiles → unified_users data migration
- [ ] T062 Create migration: chat_messages → messages data migration (set channel='telegram', interface='bot')
- [ ] T063 Create migration: existing user_credits → new user_credits with unified_user_id FK
- [ ] T064 Create migration: add unified_user_id FK to existing tables (profiles, purchases, analysis_history)

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T065 [P] Run pnpm type-check in root and symancy-backend/
- [ ] T066 [P] Run pnpm build to verify production build
- [ ] T067 Validate quickstart.md testing checklist (all items pass)
- [ ] T068 Update CLAUDE.md if any new patterns introduced
- [ ] T069 [P] Generate TypeScript types from Supabase schema (if using generated types)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Phase 2 completion
  - US1 (P1) and US2 (P1) can run in parallel
  - US3 (P2) and US4 (P2) can run in parallel after US1/US2
  - US5 (P3) and US6 (P3) can run in parallel after US3/US4
- **Data Migration (Phase 9)**: Can run after Phase 2, before or after user stories
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|-----------|-----------------|
| US1 | Phase 2 | T018 complete |
| US2 | Phase 2, US1 T022-T024 | T024 complete (needs auth) |
| US3 | Phase 2, US1 T027 | T027 complete (needs AuthContext) |
| US4 | Phase 2, US1 T019-T020 | T020 complete (needs auth services) |
| US5 | US2 T032 | T032 complete (needs DeliveryService) |
| US6 | US1 T021 | T021 complete (needs UnifiedUserService) |

### Parallel Opportunities per Phase

**Phase 1 Setup**: T001, T002, T003 all [P]

**Phase 2 Foundational**:
- Migrations T004-T010 must be sequential (schema dependencies)
- Functions T011-T014 can run after migrations, parallel to each other
- Types T015-T016 can run in parallel
- T017-T018 independent, can run in parallel

**Phase 3 US1**:
- T019, T020, T021 all [P]
- T025, T026 all [P]
- T022-T024 sequential (depends on services)
- T027-T030 sequential (depends on endpoints)

**Phase 4 US2**:
- T031, T032 all [P]
- T035, T036, T037, T038 all [P]
- T033-T034 sequential
- T039-T040 depend on components

**Phase 5 US3**: T041 [P], rest sequential

**Phase 6 US4**: T045 [P], T046-T049 sequential

**Phase 7 US5**: T050 [P], rest sequential

**Phase 8 US6**: T054, T055 [P], rest sequential

---

## Parallel Execution Example: Phase 3 (US1)

```bash
# Parallel Group A: Backend services (T019, T020, T021)
Task: "Implement TelegramAuthService in symancy-backend/src/services/auth/TelegramAuthService.ts"
Task: "Implement JwtService in symancy-backend/src/services/auth/JwtService.ts"
Task: "Implement UnifiedUserService in symancy-backend/src/services/user/UnifiedUserService.ts"

# Then sequential: T022-T024 (endpoints depend on services)

# Parallel Group B: Frontend (T025, T026) - can run parallel to Group A
Task: "Create TelegramLoginButton in src/components/features/auth/TelegramLoginButton.tsx"
Task: "Create authService in src/services/authService.ts"

# Then sequential: T027-T030 (integration depends on both backend and frontend)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Telegram Login)
4. **VALIDATE**: Test Telegram Login Widget on production domain
5. Complete Phase 4: User Story 2 (Real-time Sync)
6. **VALIDATE**: Test real-time message sync
7. **DEPLOY MVP**

### Incremental Delivery

- **MVP**: US1 + US2 = Core Telegram-Web integration
- **v1.1**: + US3 = Web-only users
- **v1.2**: + US4 = WebApp experience
- **v1.3**: + US5 + US6 = Proactive messaging + Account linking
- **v1.4**: + Data migration (existing users)

---

## Summary

| Phase | Tasks | Description | Status |
|-------|-------|-------------|--------|
| Phase 0 | P001-P004 | Planning & executor assignment | ⏳ |
| Phase 1 | T001-T003 | Setup (3 tasks) | ✅ |
| Phase 2 | T004-T018 | Foundational (15 tasks) | ✅ |
| Phase 3 (US1) | T019-T030 | Telegram Login (12 tasks) | ✅ |
| Phase 4 (US2) | T031-T040 | Real-time Sync (10 tasks) | ✅ |
| Phase 4+ | T040a-T040o | Code Review Fixes (15 tasks) | ✅ |
| Phase 5 (US3) | T041-T044 | Web-only Users (4 tasks) | ⏳ |
| Phase 6 (US4) | T045-T049 | WebApp (5 tasks) | ⏳ |
| Phase 7 (US5) | T050-T053 | Proactive Messaging (4 tasks) | ⏳ |
| Phase 8 (US6) | T054-T060 | Account Linking (7 tasks) | ⏳ |
| Phase 9 | T061-T064 | Data Migration (4 tasks) | ⏳ |
| Phase 10 | T065-T069 | Polish (5 tasks) | ⏳ |

**Total**: 69 implementation tasks + 15 code review fixes + 4 planning tasks = **88 tasks**
**Completed**: 55 tasks (Phases 1-4 + Code Review Fixes)

**Tasks per User Story**:
- US1: 12 tasks (P1 - MVP)
- US2: 10 tasks (P1 - MVP)
- US3: 4 tasks (P2)
- US4: 5 tasks (P2)
- US5: 4 tasks (P3)
- US6: 7 tasks (P3)

**Parallel Opportunities**: 36 tasks marked [P] (49%)

**Suggested MVP Scope**: Phases 1-4 (User Stories 1 + 2) = 40 tasks
