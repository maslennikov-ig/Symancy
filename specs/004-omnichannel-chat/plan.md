# Implementation Plan: Omnichannel Chat Architecture

**Branch**: `004-omnichannel-chat` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-omnichannel-chat/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Unified omnichannel chat system enabling users to interact via Telegram bot, Telegram WebApp, and Web browser while maintaining shared credits, conversation history, and identity. Telegram serves as the primary identity anchor (90% of users), with Web as secondary channel. Real-time message sync via Supabase Realtime, cryptographic auth verification for Telegram Login Widget and WebApp initData.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (frontend + backend)
**Primary Dependencies**:
- Frontend: React 19.2.3, Vite 6.2, @supabase/supabase-js 2.80.0, react-router 7.9.6
- Backend: Fastify 5.6.2, grammY 1.38.4, pg-boss 12.5.4, @langchain/* stack, Zod 4.2.1

**Storage**: Supabase PostgreSQL (existing tables: profiles, chat_messages, user_credits, purchases, analysis_history)
**Testing**: Vitest 3.0.5 (backend), no frontend tests currently
**Target Platform**:
- Frontend: Web browsers (desktop + mobile responsive)
- Backend: Linux server (Node.js 22+), Docker deployment via GitHub Actions

**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**:
- Telegram Login < 10 seconds
- Message sync < 2 seconds latency
- 1,000 concurrent Realtime connections

**Constraints**:
- Telegram rate limits (30 msg/sec global, 1 msg/sec per chat)
- Supabase Realtime connection limits
- Zero downtime deployment required

**Scale/Scope**: ~10,000 users, 6 new tables, 3 API endpoints, 2 new UI components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Context-First Development | ✅ PASS | Full codebase analysis completed |
| II. Single Source of Truth | ✅ PASS | Types in shared locations, no duplication planned |
| III. Library-First Development | ⚠️ REVIEW | Need library research for Telegram auth verification |
| IV. Code Reuse & DRY | ✅ PASS | Reusing existing Supabase client, auth context |
| V. Strict Type Safety | ✅ PASS | Zod schemas for all API contracts |
| VI. Atomic Task Execution | ✅ PASS | Tasks will be atomic and independently testable |
| VII. Quality Gates | ✅ PASS | type-check + build must pass before commit |
| VIII. Progressive Specification | ✅ PASS | Following spec → plan → tasks → implement |
| IX. Error Handling | ✅ PASS | Typed errors, retry logic with exponential backoff |
| X. Observability | ✅ PASS | Pino structured logging in backend |
| XI. Accessibility | ✅ PASS | WCAG 2.1 AA, keyboard nav, theme support |

## Project Structure

### Documentation (this feature)

```text
specs/004-omnichannel-chat/
├── plan.md              # This file
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0 output - library decisions
├── data-model.md        # Phase 1 output - entity design
├── contracts/           # Phase 1 output - API specs
│   ├── auth.openapi.yaml
│   ├── messages.openapi.yaml
│   └── types.ts
├── quickstart.md        # Phase 1 output - setup guide
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (React + Vite)
src/
├── components/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── TelegramLoginButton.tsx   # NEW
│   │   │   └── TelegramLinkPrompt.tsx    # NEW
│   │   └── chat/
│   │       ├── ChatWindow.tsx            # NEW
│   │       ├── MessageBubble.tsx         # NEW
│   │       └── ChannelIndicator.tsx      # NEW
│   └── ui/
├── hooks/
│   ├── useRealtimeChat.ts                # NEW
│   └── useAuth.ts                        # UPDATE (add Telegram JWT)
├── lib/
│   ├── supabaseClient.ts                 # UPDATE (add custom JWT support)
│   └── i18n.ts                           # UPDATE (add linkTelegram keys)
├── contexts/
│   └── AuthContext.tsx                   # UPDATE (unified auth)
├── services/
│   └── authService.ts                    # NEW
└── types/
    └── omnichannel.ts                    # NEW

# Backend (Fastify + grammY)
symancy-backend/
├── src/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── telegram-login.ts         # NEW - Telegram Login Widget verification
│   │   │   ├── webapp-auth.ts            # NEW - WebApp initData verification
│   │   │   └── link-token.ts             # NEW - /link command token endpoint
│   │   └── messages/
│   │       └── send-message.ts           # NEW - Unified message handler
│   ├── services/
│   │   ├── routing/
│   │   │   └── MessageRouter.ts          # NEW
│   │   ├── delivery/
│   │   │   ├── DeliveryService.ts        # NEW
│   │   │   └── RetryService.ts           # NEW
│   │   ├── auth/
│   │   │   ├── JwtService.ts             # NEW
│   │   │   └── TelegramAuthService.ts    # NEW
│   │   └── user/
│   │       └── UnifiedUserService.ts     # NEW
│   ├── handlers/
│   │   └── link-command.ts               # NEW - /link bot command
│   └── types/
│       └── omnichannel.ts                # NEW
└── tests/
    ├── unit/
    │   ├── telegram-auth.test.ts         # NEW
    │   └── message-router.test.ts        # NEW
    └── integration/
        └── auth-flow.test.ts             # NEW

# Database migrations (via Supabase MCP)
# Migration order:
# 1. unified_users table
# 2. conversations table
# 3. messages table (with channel/interface)
# 4. message_deliveries table
# 5. link_tokens table
# 6. Data migration: profiles → unified_users
# 7. Data migration: chat_messages → messages
# 8. RLS policies
# 9. Helper functions
```

**Structure Decision**: Web application structure selected. Frontend in `src/`, backend in `symancy-backend/`. New omnichannel-specific code isolated in feature directories for clean separation.

## Complexity Tracking

> **No violations identified** - Architecture follows existing patterns.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Custom JWT | Required | Telegram users don't use Supabase Auth, need custom tokens |
| Dual auth systems | Coexisting | Supabase Auth (web) + Custom JWT (Telegram) run in parallel |
| New tables vs modify | New tables | unified_users as superset, preserve existing for rollback |

---

## Key Architecture Decisions (from OMNICHANNEL_ARCHITECTURE.md)

### 1. Telegram as Identity Anchor
- `telegram_id` is the primary identifier (never changes)
- All other channels link TO Telegram, not vice versa
- Web users without Telegram have limited features (no proactive messages)

### 2. Channel vs Interface
- **Channel** = identity (telegram, web, whatsapp, wechat)
- **Interface** = delivery method (bot, webapp, browser, api)
- Response always goes to source channel+interface

### 3. Real-time Strategy
- Telegram bot: grammY API (sendMessage)
- WebApp + Web: Supabase Realtime subscriptions
- Automatic channel detection for delivery routing

### 4. Migration Strategy
- Create new tables alongside existing
- Data migration preserves all existing data
- Rollback scripts prepared
- Feature flags for gradual rollout

---

## Next Steps

1. **Phase 0**: Complete `research.md` - library decisions for Telegram auth
2. **Phase 1**: Complete design artifacts (data-model.md, contracts/, quickstart.md)
3. **Phase 2**: Generate `tasks.md` via `/speckit.tasks`
4. **Implementation**: Execute tasks with atomic commits
