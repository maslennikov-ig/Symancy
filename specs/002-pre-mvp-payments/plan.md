# Implementation Plan: Pre-MVP Payment Integration

**Branch**: `002-pre-mvp-payments` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature spec from `/specs/002-pre-mvp-payments/spec.md`

**Note**: Template filled by `/speckit.plan` command.

## Summary

Integrate YooKassa payment processing for one-time purchases (4 tariffs: 100/300/500/1000 RUB) using official YooMoney Checkout Widget on frontend and Supabase Edge Functions for secure webhook handling. Database stores purchases and user credits with RLS policies.

## Technical Context

**Language/Version**: TypeScript 5.8.2, React 19.1.1
**Primary Dependencies**: @supabase/supabase-js 2.45.0, YooMoney Checkout Widget (CDN), react-yoomoneycheckoutwidget (wrapper)
**Storage**: Supabase PostgreSQL (existing: `analysis_history`, new: `purchases`, `user_credits`)
**Testing**: Manual E2E testing (no automated tests required for MVP)
**Target Platform**: Web (Vite + React SPA hosted on Netlify)
**Project Type**: Web application (frontend + serverless backend)
**Performance Goals**: Payment form render <2s, webhook processing <500ms
**Constraints**: 54-FZ compliance (use YooKassa built-in cash register), RUB currency only
**Scale/Scope**: Pre-MVP validation (~100 users expected initially)

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Context-First Development | PASS | Full codebase exploration completed |
| II. Agent-Based Orchestration | PASS | Complex tasks delegated to subagents |
| III. Test-Driven Development | N/A | Tests not required in spec |
| IV. Atomic Task Execution | PASS | Tasks will be atomic and committable |
| V. User Story Independence | PASS | US1-US4 are independently testable |
| VI. Quality Gates | PASS | Type-check + build required before commits |
| VII. Progressive Specification | PASS | Following spec → plan → tasks flow |

**Security Requirements:**
- Environment variables for YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY, YUKASSA_WEBHOOK_SECRET
- RLS policies on purchases and user_credits tables
- Webhook signature verification in Edge Function

## Project Structure

### Documentation (this feature)

```text
specs/002-pre-mvp-payments/
├── spec.md          # Feature specification
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/       # Phase 1 output
│   └── api.yaml     # OpenAPI spec
└── tasks.md         # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Frontend (React + Vite - existing structure)
components/
├── payment/                    # NEW: Payment UI components
│   ├── TariffSelector.tsx      # Tariff selection cards
│   ├── PaymentWidget.tsx       # YooMoney widget wrapper
│   └── PurchaseHistory.tsx     # User purchase history
├── ui/                         # Existing shadcn/ui components
└── ...

services/
├── paymentService.ts           # NEW: Payment API client
├── geminiService.ts            # Existing AI service
└── historyService.ts           # Existing history service

lib/
├── supabaseClient.ts           # Existing Supabase client
└── utils.ts

# Backend (Supabase Edge Functions - NEW)
supabase/
├── functions/
│   ├── create-payment/         # POST /create-payment
│   │   └── index.ts
│   ├── payment-webhook/        # POST /payment-webhook (YooKassa callback)
│   │   └── index.ts
│   └── _shared/
│       └── cors.ts
├── migrations/
│   ├── 20251123000001_create_purchases_table.sql
│   └── 20251123000002_create_user_credits_table.sql
└── config.toml
```

**Structure Decision**: Extend existing React SPA with payment components. Add Supabase Edge Functions for secure server-side payment processing (YooKassa requires server-side secret key handling).

## Technology Decisions

### Payment Widget: YooMoney Checkout Widget

**Decision**: Use official YooMoney Checkout Widget with `react-yoomoneycheckoutwidget` React wrapper.

**Rationale**:
- Official solution from YooKassa with PCI DSS compliance
- Handles all payment methods: Cards, SBP, Apple Pay, Google Pay, Mir Pay
- Built-in 54-FZ online cash register support
- React wrapper available on npm (manages widget lifecycle)

**Alternatives Rejected**:
- Direct API integration: More complex, requires PCI DSS compliance on our side
- Checkout.js: Lower-level, requires more custom implementation
- React Native SDK: Not applicable (web app, not mobile)

### Backend: Supabase Edge Functions

**Decision**: Use Supabase Edge Functions (Deno) for webhook handling.

**Rationale**:
- Direct access to Supabase PostgreSQL (no extra connection config)
- Already using Supabase for auth and database
- Built-in CORS handling
- TypeScript support with Deno
- Secure secrets management via Supabase Vault
- No need for separate Netlify Functions deployment

**Alternatives Rejected**:
- Netlify Functions: Would require separate database connection, extra deployment config
- n8n webhook: Better for complex workflows, overkill for simple payment processing

### NPM Packages

| Package | Version | Purpose |
|---------|---------|---------|
| react-yoomoneycheckoutwidget | ^1.1.30 | React wrapper for YooMoney widget |
| @supabase/supabase-js | ^2.45.0 | Already installed |
| resend | ^2.0.0 | Email notifications (payment confirmation) |
| crypto (built-in) | - | Webhook signature verification |

## Additional Requirements (Gap Analysis)

### 1. Email Notifications (US3.4)

**Requirement**: Отправка email-подтверждения после успешной оплаты.

**Solution**: Resend API (free tier: 100 emails/day, достаточно для Pre-MVP)

**Implementation**:
- Edge Function `payment-webhook` отправляет email после успешного платежа
- Шаблон: "Спасибо за покупку! Ваш баланс пополнен на X кредитов."
- Resend SDK интегрируется в Deno (Edge Functions)

**Environment Variable**:
```
RESEND_API_KEY=xxx
```

### 2. Analytics Tracking (SM-002)

**Requirement**: Отслеживание конверсии landing → payment > 1%

**Solution**: Простая таблица `payment_analytics` в Supabase

**Tracked Events**:
| Event | Description |
|-------|-------------|
| `tariff_view` | Пользователь открыл модал выбора тарифа |
| `payment_started` | Пользователь нажал "Оплатить" |
| `payment_succeeded` | Платёж успешно завершён |
| `payment_canceled` | Платёж отменён |

**Metrics Calculation**:
- Конверсия = `payment_succeeded` / `tariff_view` × 100%

### 3. Wait Times (Тарифы)

**Clarification from spec**:
- Новичок (100₽): ожидание 5-10 мин
- Любитель (300₽): ожидание <2 мин
- Внутренний мудрец (500₽): минимальное ожидание

**Decision**: Для Pre-MVP это **маркетинговое описание**, не техническая реализация.

**Rationale**:
- Реальная приоритетная очередь требует n8n workflow изменений
- Это Phase 1 scope (после валидации платежей)
- Текущий AI-анализ занимает ~15-30 сек для всех

**Future Phase**: Добавить приоритетную очередь на основе типа кредита.

### 4. Credit Consumption Flow

**Requirement**: Интеграция с существующим geminiService.ts

**Flow**:
```
User uploads image
       ↓
Check user credits (basic_credits > 0 OR pro_credits > 0)
       ↓
   Has credits? ──NO──→ Show TariffSelector modal
       ↓ YES
Run AI analysis (geminiService.ts)
       ↓
Decrement credit (basic_credits -= 1)
       ↓
Save to analysis_history
```

**Implementation Points**:
1. `services/creditService.ts` - проверка и списание кредитов
2. Modify `App.tsx` - добавить проверку перед анализом
3. New API: `POST /consume-credit` - атомарное списание

**Credit Priority** (if user has multiple types):
1. Use `basic_credits` first (cheapest)
2. Then `pro_credits`
3. Then `cassandra_credits` (only for Cassandra readings)

## Complexity Tracking

> No Constitution Check violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected |
|-----------|------------|------------------------------|
| None | - | - |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| YooKassa merchant approval delay | Start registration immediately; use test mode |
| Webhook delivery failures | Implement idempotency via payment_id; YooKassa retries |
| Edge Function cold starts | Acceptable for webhook (not user-facing latency) |

## Next Steps

1. Generate `research.md` with detailed technology decisions
2. Generate `data-model.md` with database schema
3. Generate `contracts/api.yaml` with OpenAPI spec
4. Generate `quickstart.md` with integration steps
5. Run `/speckit.tasks` to generate task breakdown
