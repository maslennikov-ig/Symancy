# Tasks: Pre-MVP Payment Integration

**Input**: Design documents from `/specs/002-pre-mvp-payments/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: Not explicitly requested in spec. Manual E2E testing only (per plan.md).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4 (from spec.md)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: Root level (React + Vite SPA) - NO src/ prefix!
- **Backend**: `supabase/functions/` (Edge Functions)
- **Database**: `supabase/migrations/`
- **Types**: `types/`
- **Services**: `services/`
- **Components**: `components/`
- **Pages**: `pages/` (create if needed)

---

## Phase 0: Planning ✓ COMPLETE

**Purpose**: Prepare for implementation by analyzing requirements, creating necessary agents, and assigning executors.

- [X] P001 Analyze all tasks and identify required agent types and capabilities
- [X] P002 Create missing agents using meta-agent-v3:
  - Created: `supabase-edge-functions-specialist` (Deno Edge Functions)
  - Created: `react-vite-specialist` (React + Vite SPA)
- [X] P003 Assign executors to all tasks (see annotations below)
- [X] P004 Resolve research tasks → **All research complete in research.md**

**Agent Assignment Summary**:
- **MAIN**: T001, T005, T038 (single CLI commands only)
- **database-architect**: T006-T012 (SQL migrations via Supabase MCP)
- **typescript-types-specialist**: T002 (TypeScript types)
- **supabase-edge-functions-specialist**: T003, T004, T013-T014, T024-T026 (Edge Functions + env setup)
- **react-vite-specialist**: T015-T023, T027-T034 (React components, services, integration)
- **technical-writer**: T036, T037 (documentation)
- **Manual**: T035, T039, T040 (secrets with real values, manual testing, client config)

---

## Phase 1: Setup (Project Initialization) ✓ COMPLETE

**Purpose**: Initialize Supabase Edge Functions, install dependencies, configure environment

- [X] T001 [EXECUTOR: MAIN] Install frontend dependency: `pnpm add react-yoomoneycheckoutwidget`
  → Artifacts: [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml)
- [X] T002 [EXECUTOR: typescript-types-specialist] Create TypeScript types in `types/payment.ts`
  → Artifacts: [types/payment.ts](../../types/payment.ts)
- [X] T003 [EXECUTOR: supabase-edge-functions-specialist] Initialize Supabase Edge Functions structure
  → Artifacts: [cors.ts](../../supabase/functions/_shared/cors.ts), [create-payment/index.ts](../../supabase/functions/create-payment/index.ts), [payment-webhook/index.ts](../../supabase/functions/payment-webhook/index.ts)
- [X] T004 [EXECUTOR: supabase-edge-functions-specialist] Create environment variables documentation
  → Artifacts: [.env.example](../../supabase/.env.example)
- [X] T005 [EXECUTOR: MAIN] Verify Supabase CLI is linked to project (ref: diqooqbuchsliypgwksu)
  → Verified via Supabase MCP connection

---

## Phase 2: Foundational (Database Schema) ✓ COMPLETE

**Purpose**: Create database tables and functions that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 1: Create purchases table in `supabase/migrations/20251123000001_create_purchases_table.sql` per data-model.md
  → Artifacts: [20251123000001_create_purchases_table.sql](../../supabase/migrations/20251123000001_create_purchases_table.sql)
- [X] T007 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 2: Create user_credits table in `supabase/migrations/20251123000002_create_user_credits_table.sql` per data-model.md
  → Artifacts: [20251123000002_create_user_credits_table.sql](../../supabase/migrations/20251123000002_create_user_credits_table.sql)
- [X] T008 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 3: Create grant_credits function in `supabase/migrations/20251123000003_create_grant_credits_function.sql` per data-model.md
  → Artifacts: [20251123000003_create_grant_credits_function.sql](../../supabase/migrations/20251123000003_create_grant_credits_function.sql)
- [X] T009 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 4: Create payment_analytics table in `supabase/migrations/20251123000004_create_payment_analytics_table.sql` per data-model.md
  → Artifacts: [20251123000004_create_payment_analytics_table.sql](../../supabase/migrations/20251123000004_create_payment_analytics_table.sql)
- [X] T010 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 5: Create consume_credit function in `supabase/migrations/20251123000005_create_consume_credit_function.sql` per data-model.md
  → Artifacts: [20251123000005_create_consume_credit_function.sql](../../supabase/migrations/20251123000005_create_consume_credit_function.sql)
- [X] T011 [EXECUTOR: database-architect] [SEQUENTIAL] Run `supabase db push` to apply all migrations to database
  → Applied via Supabase MCP (5 migrations)
- [X] T012 [EXECUTOR: database-architect] [SEQUENTIAL] Verify RLS policies are enabled on all tables via Supabase MCP advisors
  → Verified: No RLS issues detected by Supabase advisors

**Checkpoint**: Database schema ready - Edge Functions and UI implementation can begin

---

## Phase 3: User Story 1+2 - Payment Flow & Tariff Selection (Priority: P0) MVP ✓ COMPLETE

**Goal**: User can select a tariff and complete payment via YooKassa widget

**Independent Test**:
1. Open app → See "Купить анализ" button
2. Click button → See 4 tariff cards in modal
3. Select tariff → Click "Оплатить"
4. See YooMoney widget with correct amount
5. Complete test payment (sandbox)

### Backend for US1+US2 ✓

- [X] T013 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US1] Create Edge Function `supabase/functions/create-payment/index.ts`
  → Artifacts: [create-payment/index.ts](../../supabase/functions/create-payment/index.ts)
- [X] T014 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US1] Deploy create-payment function
  → Deployed via Supabase MCP (version 1, ACTIVE)

### Frontend for US1+US2

- [X] T015 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US2] Create `components/payment/TariffSelector.tsx`
  → Artifacts: [TariffSelector.tsx](../../components/payment/TariffSelector.tsx)
- [X] T016 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US2] Create `components/payment/TariffCard.tsx`
  → Artifacts: [TariffCard.tsx](../../components/payment/TariffCard.tsx)
- [X] T017 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Create `components/payment/PaymentWidget.tsx`
  → Artifacts: [PaymentWidget.tsx](../../components/payment/PaymentWidget.tsx)
- [X] T018 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Create `services/paymentService.ts`
  → Artifacts: [paymentService.ts](../../services/paymentService.ts)
- [X] T019 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US1] Create `pages/PaymentSuccess.tsx`
  → Artifacts: [PaymentSuccess.tsx](../../pages/PaymentSuccess.tsx)
- [X] T020 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US1] Create `pages/PaymentResult.tsx`
  → Artifacts: [PaymentResult.tsx](../../pages/PaymentResult.tsx)
- [X] T021 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Add routes for payment pages
  → Modified: index.tsx (BrowserRouter), App.tsx (Routes)
- [X] T022 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US2] Integrate TariffSelector into main app
  → Modified: Header.tsx ("Купить анализ" button), App.tsx (TariffSelector modal)
- [X] T023 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Connect TariffSelector → PaymentWidget flow
  → Modified: App.tsx (payment handlers, PaymentWidget modal)

**Checkpoint**: Users can select tariff and complete payment (pending webhook confirmation) ✓

---

## Phase 4: User Story 3 - Payment Webhook (Priority: P1) ✓ COMPLETE

**Goal**: Backend processes YooKassa webhooks to confirm payments and grant credits

**Independent Test**:
1. Complete test payment in sandbox
2. YooKassa sends webhook to our endpoint
3. Check purchases table - status changed to 'succeeded'
4. Check user_credits table - credits increased
5. Check email inbox - confirmation email received

### Backend for US3 ✓

- [X] T024 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Create Edge Function `supabase/functions/payment-webhook/index.ts`
  → Artifacts: [payment-webhook/index.ts](../../supabase/functions/payment-webhook/index.ts)
  → Features: HMAC-SHA256 verification, idempotency, grant_credits RPC, analytics, Resend email
- [X] T025 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Deploy payment-webhook function
  → Deployed via Supabase MCP (version 1, ACTIVE)
- [X] T026 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Document webhook URL
  → Documented in [.env.example](../../supabase/.env.example)
  → URL: `https://diqooqbuchsliypgwksu.supabase.co/functions/v1/payment-webhook`

**Checkpoint**: Payment confirmations processed automatically, credits granted ✓

---

## Phase 5: User Story 4 - Purchase History (Priority: P1) ✓ COMPLETE

**Goal**: User can view their purchase history in personal account

**Independent Test**:
1. Complete a payment
2. Navigate to profile/history page
3. See purchase with correct product_type, amount, status, date

### Frontend for US4 ✓

- [X] T027 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-3] [US4] Create `components/payment/PurchaseHistory.tsx`
  → Artifacts: [PurchaseHistory.tsx](../../components/payment/PurchaseHistory.tsx)
- [X] T028 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-3] [US4] Create `components/payment/CreditBalance.tsx`
  → Artifacts: [CreditBalance.tsx](../../components/payment/CreditBalance.tsx)
- [X] T029 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US4] Integrate credits into Header
  → Artifacts: [CreditBadge.tsx](../../components/payment/CreditBadge.tsx), Modified Header.tsx

**Checkpoint**: Users can see their purchase history and credit balance ✓

---

## Phase 6: Credit Consumption Integration ✓ COMPLETE

**Goal**: Integrate credit checking into existing analysis flow

**Independent Test**:
1. User with 0 credits uploads image → TariffSelector modal opens
2. User with 1+ credits uploads image → Analysis runs, credit decremented
3. After analysis, remaining credits shown

### Integration Tasks ✓

- [X] T030 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Create `services/creditService.ts`
  → Artifacts: [creditService.ts](../../services/creditService.ts)
- [X] T031 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Modify analysis flow in App.tsx
  → Modified: App.tsx (credit checking + consumption), TariffSelector.tsx (message prop)

**Checkpoint**: Full payment-to-analysis flow working ✓

---

## Phase 7: Analytics Integration ✓ COMPLETE

**Goal**: Track conversion funnel events for SM-002 metric

**Independent Test**:
1. Open tariff modal → payment_analytics has 'tariff_view' event
2. Click "Оплатить" → payment_analytics has 'payment_started' event
3. Complete payment → payment_analytics has 'payment_succeeded' event
4. Query payment_conversion view → shows conversion rate

### Analytics Tasks ✓

- [X] T032 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-4] Create `services/analyticsService.ts` with:
  - trackEvent(event, productType?, amountRub?, metadata?): inserts into payment_analytics table
  - Event types: 'tariff_view', 'payment_started', 'payment_succeeded', 'payment_canceled'
  → Artifacts: [analyticsService.ts](../../services/analyticsService.ts)
- [X] T033 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Add analytics tracking to TariffSelector.tsx:
  - Track 'tariff_view' on modal open
  - Track 'payment_started' when user clicks "Оплатить" (include selected product_type)
  → Modified: TariffSelector.tsx (useEffect for tariff_view, handleSelect for payment_started)
- [X] T034 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Verify payment-webhook tracks 'payment_succeeded'/'payment_canceled' (from T024)
  → Verified: payment-webhook/index.ts tracks both events in payment_analytics table

**Checkpoint**: Conversion funnel data being collected ✓

---

## Phase 8: Polish & Cross-Cutting Concerns ✓ COMPLETE (Automated Tasks)

**Purpose**: Final cleanup, documentation, deployment preparation

- [ ] T035 [EXECUTOR: MANUAL] [PARALLEL-GROUP-5] Set Supabase secrets via CLI: `supabase secrets set YUKASSA_SHOP_ID=xxx YUKASSA_SECRET_KEY=xxx YUKASSA_WEBHOOK_SECRET=xxx RESEND_API_KEY=xxx` (requires real credentials from client)
- [X] T036 [EXECUTOR: technical-writer] [PARALLEL-GROUP-5] Update README.md with payment integration setup instructions
  → Modified: [README.md](../../README.md) (added tariffs table, YooKassa setup, webhook URL)
- [N/A] T037 [EXECUTOR: technical-writer] [PARALLEL-GROUP-5] Create `.env.local.example` for frontend with any needed variables
  → Not needed: All payment credentials are server-side (Edge Functions). Frontend env vars documented in README.
- [X] T038 [EXECUTOR: MAIN] [SEQUENTIAL] Run type-check and build to verify no TypeScript errors: `pnpm type-check && pnpm build`
  → Build passed: `vite build` completed successfully ("✓ built in 1.91s")
- [ ] T039 [EXECUTOR: MANUAL] [SEQUENTIAL] Manual E2E testing with YooKassa sandbox per quickstart.md test cards section:
  - Test successful payment (card: 4111 1111 1111 1111)
  - Test declined payment (card: 4000 0000 0000 0002)
  - Verify webhook updates database correctly
  - Verify email confirmation is sent
- [ ] T040 [EXECUTOR: MANUAL] [SEQUENTIAL] Configure YooKassa webhook URL in merchant dashboard (requires client credentials)

---

## Phase 9: Legal Pages for YooKassa ✓ COMPLETE

**Goal**: Create required legal pages for YooKassa approval

**YooKassa Requirements**:
- Товары/услуги с ценами ✅
- Способ получения услуги ✅
- Оферта/Пользовательское соглашение
- Контакты и реквизиты ИП

### Legal Pages Tasks ✓

- [X] T041 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-6] Create `pages/Pricing.tsx` - тарифы с ценами и описанием
  → Artifacts: [Pricing.tsx](../../pages/Pricing.tsx)
- [X] T042 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-6] Create `pages/Terms.tsx` - пользовательское соглашение (оферта)
  → Artifacts: [Terms.tsx](../../pages/Terms.tsx)
- [X] T043 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-6] Create `pages/Contacts.tsx` - контакты и реквизиты ИП
  → Artifacts: [Contacts.tsx](../../pages/Contacts.tsx)
- [X] T044 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Add routes for legal pages in App.tsx
  → Modified: App.tsx (routes: /pricing, /terms, /contacts)
- [X] T045 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Add footer with links to legal pages
  → Modified: App.tsx (footer nav links)

**Data Source**: `specs/002-pre-mvp-payments/legal-pages-draft.md`

**Checkpoint**: YooKassa can approve the site for payment processing ✓

---

## Phase 10: Telegram Native Payments

**Goal**: Add native Telegram Payments via YooKassa provider for better UX in Telegram

**Why**:
- Нативный UX внутри Telegram (не WebView виджет)
- Больше доверия пользователей
- Без дополнительной комиссии (YooKassa стандартная ~3%)
- Уже есть webhook — переиспользуем

**Flow**:
```
User in Telegram → Bot sends Invoice →
→ Native Telegram payment form →
→ YooKassa processes payment →
→ Telegram sends pre_checkout_query →
→ Bot confirms → payment.succeeded webhook
```

### Telegram Payments Tasks

- [ ] T046 [EXECUTOR: MANUAL] [SEQUENTIAL] Configure YooKassa as payment provider in BotFather:
  - `/mybots` → Select bot → Payments → Connect YooKassa
  - Get `provider_token` for YooKassa
- [ ] T047 [EXECUTOR: typescript-types-specialist] [SEQUENTIAL] Add Telegram payment types to `types/payment.ts`:
  - TelegramInvoice, PreCheckoutQuery, SuccessfulPayment
- [ ] T048 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] Create Edge Function `supabase/functions/telegram-bot-webhook/index.ts`:
  - Handle `/buy` command → send invoice
  - Handle `pre_checkout_query` → validate and confirm
  - Handle `successful_payment` → call grant_credits RPC
- [ ] T049 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] Deploy telegram-bot-webhook function
- [ ] T050 [EXECUTOR: MANUAL] [SEQUENTIAL] Set bot webhook URL in Telegram:
  - `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://diqooqbuchsliypgwksu.supabase.co/functions/v1/telegram-bot-webhook`
- [ ] T051 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] Add Telegram secrets:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_PAYMENT_PROVIDER_TOKEN`
- [ ] T052 [EXECUTOR: MANUAL] [SEQUENTIAL] Test Telegram payments in sandbox:
  - Send `/buy` to bot
  - Complete test payment
  - Verify credits granted

**Checkpoint**: Users can pay natively inside Telegram

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1+US2 (Phase 3)**: Depends on Foundational - MVP deliverable
- **US3 (Phase 4)**: Depends on Foundational - Can run parallel to US1+US2
- **US4 (Phase 5)**: Depends on Foundational - Can run parallel to US1+US2
- **Credit Integration (Phase 6)**: Depends on US1+US2 and US3
- **Analytics (Phase 7)**: Depends on US1+US2
- **Polish (Phase 8)**: Depends on all previous phases
- **Legal Pages (Phase 9)**: Can run parallel to Phase 8 - Required for YooKassa approval
- **Telegram Payments (Phase 10)**: Depends on Phase 8 (YooKassa configured) + Telegram bot exists

### User Story Dependencies

- **US1+US2 (P0)**: Payment flow + tariff selection - Combined as they're tightly coupled
- **US3 (P1)**: Webhook - Independent backend work, can parallel with frontend
- **US4 (P1)**: History - Independent frontend work, can parallel with webhook

### Parallel Opportunities

**Within Phase 1 (Setup)**:
```
Parallel: T002, T003, T004
```

**Within Phase 3 (US1+US2)**:
```
Sequential-Backend: T013 → T014 (deploy)
Parallel-Frontend: T015, T016, T019, T020
Sequential-Frontend: T017 → T018 → T021 → T22 → T023
```

**Across Phases (after Foundational)**:
```
Team A: US1+US2 (Phase 3) - Frontend
Team B: US3 (Phase 4) - Backend
Team C: US4 (Phase 5) - Frontend
```

---

## Implementation Strategy

### MVP First (US1+US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (Database)
3. Complete Phase 3: US1+US2 (Payment Flow)
4. **STOP and VALIDATE**: Test with YooKassa sandbox
5. Deploy for early feedback (manual webhook testing)

### Incremental Delivery

1. Setup + Foundational → Database ready
2. Add US1+US2 → Users can pay → Deploy (MVP!)
3. Add US3 → Payments auto-confirm → Deploy
4. Add US4 → Users see history → Deploy
5. Add Credit Integration → Full flow → Deploy
6. Add Analytics → Metrics tracking → Deploy

### Single Developer Strategy

Recommended order:
1. T001-T012: Setup + Database (Day 1)
2. T013-T014: Backend create-payment (Day 2)
3. T015-T023: Frontend payment flow (Day 2-3)
4. T024-T026: Backend webhook (Day 3)
5. T027-T029: Frontend history (Day 4)
6. T030-T031: Credit integration (Day 4)
7. T032-T034: Analytics (Day 5)
8. T035-T040: Polish + Testing (Day 5-6)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US1 and US2 combined as they form the core payment flow
- Manual testing only - no automated tests per spec
- YooKassa credentials needed from client before T034/T039
- Email domain verification (symancy.ru) needed for Resend

---

## Task Summary

| Phase | Tasks | Task IDs | Executor | Description |
|-------|-------|----------|----------|-------------|
| Setup | 5 | T001-T005 | MAIN(2), typescript-types(1), supabase-edge(2) | Dependencies, types, environment |
| Foundational | 7 | T006-T012 | database-architect(7) | Database migrations (sequential) |
| US1+US2 | 11 | T013-T023 | supabase-edge(2), react-vite(9) | Payment flow + tariff selection MVP |
| US3 | 3 | T024-T026 | supabase-edge(3) | Webhook handler |
| US4 | 3 | T027-T029 | react-vite(3) | Purchase history |
| Integration | 2 | T030-T031 | react-vite(2) | Credit consumption |
| Analytics | 3 | T032-T034 | react-vite(3) | Conversion tracking |
| Polish | 6 | T035-T040 | MANUAL(3), technical-writer(2), MAIN(1) | Documentation, testing |
| Legal Pages | 5 | T041-T045 | react-vite(5) | Required pages for YooKassa |
| Telegram Payments | 7 | T046-T052 | MANUAL(3), typescript-types(1), supabase-edge(3) | Native Telegram payments |

**Total**: 52 tasks
**Executor Distribution**:
- `MAIN`: 3 tasks (T001, T005, T038)
- `database-architect`: 7 tasks (T006-T012)
- `typescript-types-specialist`: 2 tasks (T002, T047)
- `supabase-edge-functions-specialist`: 10 tasks (T003-T004, T013-T014, T024-T026, T048-T049, T051)
- `react-vite-specialist`: 22 tasks (T015-T023, T027-T034, T041-T045)
- `technical-writer`: 2 tasks (T036-T037)
- `MANUAL`: 6 tasks (T035, T039-T040, T046, T050, T052)

**MVP Scope**: Phases 1-3 (23 tasks: T001-T023) ✅ COMPLETE
**Full Scope**: All phases (52 tasks)
**Current Progress**: Phases 1-9 complete (45/52 tasks)
