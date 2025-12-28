# Technical Debt & TODOs

**Last Updated:** 28.12.2025

This document tracks temporary solutions, stubs, and areas requiring refactoring to ensure code quality and maintainability.

---

## 1. Frontend (React)

### ✅ Completed (2025-12-28)

- **`App.tsx` UserData Stub** ✅ ALREADY FIXED
  - *Solution:* ChatOnboarding is fully integrated, userData flows from user input (name, intent)
  - *Verified:* Lines 167-171 show proper userData state management

- **Error Handling in `analysisService.ts`** ✅ FIXED
  - *Solution:* Created `src/constants/errorCodes.ts` with structured error codes
  - *Solution:* Added `AnalysisError` class with error code support
  - *Solution:* Updated App.tsx with switch-case error handling for all codes
  - *Solution:* Added i18n translations for all error messages (ru, en, zh)
  - *Artifacts:* `src/constants/errorCodes.ts`, updated `analysisService.ts`, `App.tsx`, `i18n.ts`

---

## 2. Backend (Edge Functions)

### ✅ Completed (2025-12-28)

- **Credit Consumption Logic** ✅ FIXED
  - *Solution:* Created `supabase/functions/analyze-coffee/creditMapping.ts`
  - *Solution:* Replaced hardcoded if-else with `getCreditType(mode, creditType)` function
  - *Solution:* Supports explicit creditType override from client
  - *Artifacts:* `creditMapping.ts`, updated `index.ts`

### 🟡 Medium (Deferred)

- **Prompts Storage (`analyze-coffee/prompts.ts`):**
  - *Current:* System prompts are hardcoded strings constants.
  - *Goal:* Move prompts to a Database table to allow dynamic updates via Admin Panel.
  - *Status:* **DEFERRED** - Requires Admin Panel to be useful. Without UI for editing, DB storage adds complexity without value.
  - *Prerequisite:* Admin Panel implementation

---

## 3. Infrastructure & Database

### ✅ Completed (2025-12-28)

- **Legacy Tables Audit** ✅ COMPLETED
  - *Finding:* 19 tables in public schema audited
  - *Keep:* 13 tables (Omnichannel, MVP, Analytics, System)
  - *Migrate & Drop:* 3 tables (backend_user_credits, chat_messages, user_states) - 19 rows total
  - *Drop Immediately:* 1 table (backend_credit_transactions) - empty
  - *Evaluate:* 2 tables (scheduled_messages, user_memories) - empty, check roadmap
  - *Details:* See database audit in Phase 006 agent output
  - *Action Required:* Create migration scripts before dropping tables

---

## 4. Testing

### ✅ Completed (2025-12-28)

- **E2E Tests Setup** ✅ FIXED
  - *Solution:* Installed @playwright/test
  - *Solution:* Created `playwright.config.ts` with Vite dev server integration
  - *Solution:* Created `e2e/tests/critical-path.spec.ts` with 3 smoke tests
  - *Solution:* Added npm scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`
  - *Artifacts:* `playwright.config.ts`, `e2e/tests/critical-path.spec.ts`
  - *Next Steps:* Run `pnpm exec playwright install chromium` then `pnpm test:e2e`

---

## 5. Phase 005: Shared Types & Code Quality

> **Source**: `docs/reports/code-review/2024-12/phase-004-omnichannel-review.md`

### ✅ Completed (2025-12-28)

- **MEDIUM-6: Type Drift Between Frontend and Backend** ✅ FIXED
  - *Solution:* Created `@symancy/shared-types` package with Zod schemas
  - *Artifacts:* `packages/shared-types/` (501 lines of shared code)
  - *Result:* Frontend and backend now re-export from single source of truth
  - *Tasks:* See `specs/005-shared-types/tasks.md` for full implementation details

- **LOW-1 through LOW-4 from Phase 005 code review** ✅ FIXED
  - Added JSDoc to barrel exports in `packages/shared-types/src/index.ts`
  - Added repository, bugs, homepage to `packages/shared-types/package.json`
  - Enabled source maps in `packages/shared-types/tsconfig.json`
  - Added JSDoc with examples to `packages/shared-types/src/constants/errors.ts`

### ✅ Completed (Already Done)

- **LOW-1: Missing JSDoc Comments** ✅ ALREADY FIXED
  - *Verified:* MessageRouter, DeliveryService, ProactiveMessageService all have comprehensive JSDoc

- **LOW-3: Magic Numbers in Rate Limiting** ✅ ALREADY FIXED
  - *Verified:* TELEGRAM_RATE_LIMIT_MS uses env config (line 53 in env.ts)
  - *Verified:* RETRY_CONFIG in DeliveryService is well-documented constant

- **LOW-6: Hardcoded Colors in ChatWindow** ✅ ALREADY FIXED
  - *Verified:* ChatWindow uses CSS variables throughout
  - *Verified:* Connection warning has dark mode support

- **LOW-7: RPC Timeouts** ✅ NOT NEEDED
  - *Analysis:* Supabase client handles timeouts internally via fetch
  - *Decision:* Explicit timeout configuration not required

---

## 6. Phase 006: Technical Debt Cleanup Summary

### Execution Summary (2025-12-28)

| Priority | Original Count | Completed | Remaining |
|----------|----------------|-----------|-----------|
| CRITICAL | 2 | 2 | 0 |
| MEDIUM | 3 | 2 | 1 (deferred) |
| LOW | 5 | 5 | 0 |
| **Total** | **10** | **9** | **1** |

### Artifacts Created

- `specs/006-technical-debt-cleanup/tasks.md` - Full task breakdown
- `src/constants/errorCodes.ts` - Error code constants
- `supabase/functions/analyze-coffee/creditMapping.ts` - Credit type mapping
- `playwright.config.ts` - E2E test configuration
- `e2e/tests/critical-path.spec.ts` - Smoke tests

### Verification

- `pnpm type-check` ✅ PASSED
- `pnpm build` ✅ PASSED

---

## Remaining Items

### 🟡 Deferred (Requires Prerequisites)

1. **Prompts Storage to Database**
   - Prerequisite: Admin Panel implementation
   - When ready: Create `prompts` table, update Edge Function to fetch from DB

### 🟢 Future Cleanup (Low Risk)

2. **Database Migration for Legacy Tables**
   - 3 tables with 19 rows need migration before dropping
   - 1 empty table can be dropped immediately
   - 2 tables need roadmap decision
