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

## Phase 2: Foundational (Database Schema)

**Purpose**: Create database tables and functions that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 1: Create purchases table in `supabase/migrations/20251123000001_create_purchases_table.sql` per data-model.md
- [ ] T007 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 2: Create user_credits table in `supabase/migrations/20251123000002_create_user_credits_table.sql` per data-model.md
- [ ] T008 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 3: Create grant_credits function in `supabase/migrations/20251123000003_create_grant_credits_function.sql` per data-model.md
- [ ] T009 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 4: Create payment_analytics table in `supabase/migrations/20251123000004_create_payment_analytics_table.sql` per data-model.md
- [ ] T010 [EXECUTOR: database-architect] [SEQUENTIAL] Apply Migration 5: Create consume_credit function in `supabase/migrations/20251123000005_create_consume_credit_function.sql` per data-model.md
- [ ] T011 [EXECUTOR: database-architect] [SEQUENTIAL] Run `supabase db push` to apply all migrations to database
- [ ] T012 [EXECUTOR: database-architect] [SEQUENTIAL] Verify RLS policies are enabled on all tables via Supabase MCP advisors

**Checkpoint**: Database schema ready - Edge Functions and UI implementation can begin

---

## Phase 3: User Story 1+2 - Payment Flow & Tariff Selection (Priority: P0) MVP

**Goal**: User can select a tariff and complete payment via YooKassa widget

**Independent Test**:
1. Open app → See "Купить анализ" button
2. Click button → See 4 tariff cards in modal
3. Select tariff → Click "Оплатить"
4. See YooMoney widget with correct amount
5. Complete test payment (sandbox)

### Backend for US1+US2

- [ ] T013 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US1] Create Edge Function `supabase/functions/create-payment/index.ts` that:
  - Imports CORS helper from _shared/cors.ts
  - Accepts POST with {product_type} from authenticated user
  - Validates product_type is one of: basic, pack5, pro, cassandra
  - Creates YooKassa payment via API with correct amount
  - Inserts pending purchase into database
  - Returns {confirmation_token, purchase_id} per contracts/api.yaml
- [ ] T014 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US1] Deploy create-payment function: `supabase functions deploy create-payment`

### Frontend for US1+US2

- [ ] T015 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US2] Create `components/payment/TariffSelector.tsx` - Modal with 4 tariff cards per spec.md tariffs table (100/300/500/1000 RUB)
- [ ] T016 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US2] Create `components/payment/TariffCard.tsx` - Individual tariff card with name, price, description, select button
- [ ] T017 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Create `components/payment/PaymentWidget.tsx` - YooMoneyCheckoutWidget wrapper that:
  - Receives confirmation_token prop
  - Shows loading state while widget initializes
  - Renders YooMoneyCheckoutWidget with token
  - Handles error_callback with user-friendly error message
  - Redirects to return_url on completion
- [ ] T018 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Create `services/paymentService.ts` with:
  - createPayment(productType): calls create-payment Edge Function
  - getUserCredits(): fetches from user_credits table
  - getPurchaseHistory(): fetches from purchases table
- [ ] T019 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US1] Create `pages/PaymentSuccess.tsx` - Success page with:
  - "Спасибо за покупку!" message
  - Credits added confirmation
  - "Вернуться к анализу" button
- [ ] T020 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-2] [US1] Create `pages/PaymentResult.tsx` - Handles both success and cancel:
  - Parse URL params to detect success/cancel status
  - Show appropriate message based on payment result
  - Redirect logic back to main app
- [ ] T021 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Add routes for payment pages in router (e.g., `/payment/success`, `/payment/result`)
- [ ] T022 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US2] Integrate TariffSelector into main app:
  - Add "Купить анализ" button (visible only for authenticated users)
  - Opens TariffSelector modal on click
- [ ] T023 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US1] Connect TariffSelector → PaymentWidget flow:
  - On tariff select, call createPayment with loading indicator
  - On success, render PaymentWidget with confirmation_token
  - On error, show toast notification with retry option

**Checkpoint**: Users can select tariff and complete payment (pending webhook confirmation)

---

## Phase 4: User Story 3 - Payment Webhook (Priority: P1)

**Goal**: Backend processes YooKassa webhooks to confirm payments and grant credits

**Independent Test**:
1. Complete test payment in sandbox
2. YooKassa sends webhook to our endpoint
3. Check purchases table - status changed to 'succeeded'
4. Check user_credits table - credits increased
5. Check email inbox - confirmation email received

### Backend for US3

- [ ] T024 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Create Edge Function `supabase/functions/payment-webhook/index.ts` that:
  - Imports CORS helper from _shared/cors.ts
  - Verifies x-yookassa-signature header (HMAC-SHA256) per quickstart.md
  - Parses payment.succeeded/payment.canceled events
  - Updates purchase status in database
  - Calls grant_credits RPC to add credits to user_credits
  - Tracks analytics event (payment_succeeded/payment_canceled) in payment_analytics
  - Sends email confirmation via Resend API per research.md RQ-006
  - Returns 200 OK to acknowledge webhook receipt
- [ ] T025 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Deploy payment-webhook function: `supabase functions deploy payment-webhook`
- [ ] T026 [EXECUTOR: supabase-edge-functions-specialist] [SEQUENTIAL] [US3] Document webhook URL for YooKassa dashboard configuration: `https://diqooqbuchsliypgwksu.supabase.co/functions/v1/payment-webhook`

**Checkpoint**: Payment confirmations processed automatically, credits granted

---

## Phase 5: User Story 4 - Purchase History (Priority: P1)

**Goal**: User can view their purchase history in personal account

**Independent Test**:
1. Complete a payment
2. Navigate to profile/history page
3. See purchase with correct product_type, amount, status, date

### Frontend for US4

- [ ] T027 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-3] [US4] Create `components/payment/PurchaseHistory.tsx` - Table/list of user's purchases with:
  - Product name (mapped from product_type using TARIFFS constant)
  - Amount in RUB, status badge (pending/succeeded/canceled), date
  - Empty state if no purchases yet
- [ ] T028 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-3] [US4] Create `components/payment/CreditBalance.tsx` - Shows current credit balance:
  - Display basic_credits, pro_credits, cassandra_credits
  - Visual indicators (icons/colors) for each credit type
  - "Пополнить" button to open TariffSelector
- [ ] T029 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] [US4] Integrate PurchaseHistory and CreditBalance into user profile/dashboard page

**Checkpoint**: Users can see their purchase history and credit balance

---

## Phase 6: Credit Consumption Integration

**Goal**: Integrate credit checking into existing analysis flow

**Independent Test**:
1. User with 0 credits uploads image → TariffSelector modal opens
2. User with 1+ credits uploads image → Analysis runs, credit decremented
3. After analysis, remaining credits shown

### Integration Tasks

- [ ] T030 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Create `services/creditService.ts` with:
  - hasAvailableCredits(): checks basic_credits > 0 OR pro_credits > 0
  - consumeCredit(creditType): calls consume_credit RPC per quickstart.md Scenario 4
  - Error handling for insufficient credits
- [ ] T031 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Modify existing analysis flow in App.tsx/main component to:
  - Check credits before running AI analysis
  - Show TariffSelector modal if no credits (with "Для анализа нужен кредит" message)
  - Consume credit after successful analysis start
  - Show remaining credits in toast/notification after analysis completes

**Checkpoint**: Full payment-to-analysis flow working

---

## Phase 7: Analytics Integration

**Goal**: Track conversion funnel events for SM-002 metric

**Independent Test**:
1. Open tariff modal → payment_analytics has 'tariff_view' event
2. Click "Оплатить" → payment_analytics has 'payment_started' event
3. Complete payment → payment_analytics has 'payment_succeeded' event
4. Query payment_conversion view → shows conversion rate

### Analytics Tasks

- [ ] T032 [EXECUTOR: react-vite-specialist] [PARALLEL-GROUP-4] Create `services/analyticsService.ts` with:
  - trackEvent(event, productType?, amountRub?, metadata?): inserts into payment_analytics table
  - Event types: 'tariff_view', 'payment_started', 'payment_succeeded', 'payment_canceled'
- [ ] T033 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Add analytics tracking to TariffSelector.tsx:
  - Track 'tariff_view' on modal open
  - Track 'payment_started' when user clicks "Оплатить" (include selected product_type)
- [ ] T034 [EXECUTOR: react-vite-specialist] [SEQUENTIAL] Verify payment-webhook tracks 'payment_succeeded'/'payment_canceled' (from T024)

**Checkpoint**: Conversion funnel data being collected

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, documentation, deployment preparation

- [ ] T035 [EXECUTOR: MANUAL] [PARALLEL-GROUP-5] Set Supabase secrets via CLI: `supabase secrets set YUKASSA_SHOP_ID=xxx YUKASSA_SECRET_KEY=xxx YUKASSA_WEBHOOK_SECRET=xxx RESEND_API_KEY=xxx` (requires real credentials from client)
- [ ] T036 [EXECUTOR: technical-writer] [PARALLEL-GROUP-5] Update README.md with payment integration setup instructions
- [ ] T037 [EXECUTOR: technical-writer] [PARALLEL-GROUP-5] Create `.env.local.example` for frontend with any needed variables
- [ ] T038 [EXECUTOR: MAIN] [SEQUENTIAL] Run type-check and build to verify no TypeScript errors: `pnpm type-check && pnpm build`
- [ ] T039 [EXECUTOR: MANUAL] [SEQUENTIAL] Manual E2E testing with YooKassa sandbox per quickstart.md test cards section:
  - Test successful payment (card: 4111 1111 1111 1111)
  - Test declined payment (card: 4000 0000 0000 0002)
  - Verify webhook updates database correctly
  - Verify email confirmation is sent
- [ ] T040 [EXECUTOR: MANUAL] [SEQUENTIAL] Configure YooKassa webhook URL in merchant dashboard (requires client credentials)

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

**Total**: 40 tasks
**Executor Distribution**:
- `MAIN`: 3 tasks (T001, T005, T038)
- `database-architect`: 7 tasks (T006-T012)
- `typescript-types-specialist`: 1 task (T002)
- `supabase-edge-functions-specialist`: 7 tasks (T003-T004, T013-T014, T024-T026)
- `react-vite-specialist`: 17 tasks (T015-T023, T027-T034)
- `technical-writer`: 2 tasks (T036-T037)
- `MANUAL`: 3 tasks (T035, T039-T040)

**MVP Scope**: Phases 1-3 (23 tasks: T001-T023)
**Full Scope**: All phases (40 tasks)
