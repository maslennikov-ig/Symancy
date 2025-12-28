# Tasks: Phase 006 - Technical Debt Cleanup

**Input**: TECHNICAL_DEBT.md remaining items
**Goal**: Resolve all remaining technical debt from previous phases

## Status Summary

| Priority | Original | Already Done | Remaining |
|----------|----------|--------------|-----------|
| CRITICAL | 2 | 1 | 1 |
| MEDIUM | 3 | 0 | 3 |
| LOW | 5 | 4 | 1 |
| **Total** | **10** | **5** | **5** |

### Already Completed (No Action Needed)

- ~~App.tsx UserData Stub~~ - ChatOnboarding fully integrated, userData flows from user input
- ~~LOW-1: Missing JSDoc~~ - MessageRouter, DeliveryService, ProactiveMessageService have comprehensive JSDoc
- ~~LOW-3: Magic Numbers~~ - TELEGRAM_RATE_LIMIT_MS uses env config (line 53 in env.ts)
- ~~LOW-6: Hardcoded Colors~~ - ChatWindow uses CSS variables with dark mode support
- ~~LOW-7: RPC Timeouts~~ - Supabase client handles this internally; explicit timeout not needed for RPC

---

## Phase 1: E2E Tests Setup (CRITICAL)

- [ ] T001 Install Playwright and dependencies
  ```bash
  pnpm add -D @playwright/test playwright
  ```

- [ ] T002 Create `playwright.config.ts` with configuration
  - Base URL: http://localhost:5173
  - Browser: chromium
  - Screenshots on failure

- [ ] T003 Create `e2e/` directory structure
  ```
  e2e/
    fixtures/
      auth.ts          # Authentication fixtures
    pages/
      home.page.ts     # Page Object Model
    tests/
      critical-path.spec.ts  # Upload → Analyze → Result
  ```

- [ ] T004 Implement authentication fixture for logged-in user
  - Use Supabase test user or mock auth

- [ ] T005 Implement critical path test: Upload → Analyze → Result
  - Navigate to home
  - Complete ChatOnboarding flow
  - Upload image
  - Wait for analysis
  - Verify result display

- [ ] T006 Add npm scripts for E2E tests
  ```json
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
  ```

- [ ] T007 Create CI/CD integration notes (optional)

---

## Phase 2: Error Handling Improvements (MEDIUM)

- [ ] T008 Create error codes mapping in `src/constants/errorCodes.ts`
  ```typescript
  export const ErrorCodes = {
    INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
    AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
    INVALID_IMAGE: 'INVALID_IMAGE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    UNAUTHORIZED: 'UNAUTHORIZED',
  } as const;
  ```

- [ ] T009 Update `analysisService.ts` to parse and map error codes
  - Parse error.code from Edge Function response
  - Map each code to appropriate action

- [ ] T010 Update `App.tsx` error handling
  - INSUFFICIENT_CREDITS → Open TariffSelector (already done)
  - AI_SERVICE_UNAVAILABLE → Show retry message
  - RATE_LIMIT_EXCEEDED → Show "try again in X seconds"
  - INVALID_IMAGE → Show "please upload a valid coffee cup image"

- [ ] T011 Add i18n translations for all error messages

---

## Phase 3: Credit Consumption Logic Fix (MEDIUM)

- [ ] T012 Create credit type mapping in `supabase/functions/analyze-coffee/creditMapping.ts`
  ```typescript
  export const MODE_TO_CREDIT_TYPE: Record<string, string> = {
    psychologist: 'basic',
    esoteric: 'cassandra',
    pro: 'pro',
  };

  export function getCreditType(mode: string, explicitType?: string): string {
    return explicitType || MODE_TO_CREDIT_TYPE[mode] || 'basic';
  }
  ```

- [ ] T013 Update `analyze-coffee/index.ts` to use mapping
  - Import `getCreditType`
  - Support optional `creditType` in request body
  - Fall back to mode-based mapping

- [ ] T014 Update frontend to pass explicit creditType when available

---

## Phase 4: Prompts Storage Migration (MEDIUM)

- [ ] T015 Create database migration for `prompts` table
  ```sql
  CREATE TABLE prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] T016 Seed initial prompts
  - VISION_SYSTEM_PROMPT
  - ARINA_SYSTEM_PROMPT
  - CASSANDRA_SYSTEM_PROMPT

- [ ] T017 Create `getPrompt()` function in Edge Function
  ```typescript
  async function getPrompt(name: string): Promise<string> {
    const { data, error } = await supabase
      .from('prompts')
      .select('content')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Fallback to hardcoded prompts
      return FALLBACK_PROMPTS[name];
    }
    return data.content;
  }
  ```

- [ ] T018 Update `analyze-coffee/index.ts` to fetch prompts from DB
  - Fetch prompts with fallback to hardcoded
  - Cache prompts in memory for duration of request

- [ ] T019 Keep hardcoded prompts as fallback

---

## Phase 5: Legacy Tables Audit (LOW)

- [ ] T020 Query database for all tables
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public';
  ```

- [ ] T021 Identify legacy vs current tables
  **Current (keep):**
  - unified_users, conversations, messages, message_deliveries
  - link_tokens, unified_user_credits, engagement_log
  - profiles, purchases, user_credits, analysis_history
  - prompts (new)

  **Legacy (investigate):**
  - Any tables not in the above list

- [ ] T022 Document findings in `docs/DATABASE_AUDIT.md`

- [ ] T023 Create migration to drop unused tables (if any found)

---

## Execution Order

1. **Phase 2: Error Handling** (parallel-safe, frontend only)
2. **Phase 3: Credit Logic** (parallel-safe, Edge Function only)
3. **Phase 4: Prompts Storage** (requires migration first, then Edge Function)
4. **Phase 1: E2E Tests** (can run parallel after setup)
5. **Phase 5: Legacy Tables** (documentation only, low risk)

## Agent Assignments

| Phase | Agent Type | Parallel |
|-------|------------|----------|
| Phase 1 (E2E) | react-vite-specialist | No (sequential) |
| Phase 2 (Errors) | react-vite-specialist | Yes |
| Phase 3 (Credits) | supabase-edge-functions-specialist | Yes |
| Phase 4 (Prompts) | database-architect + supabase-edge-functions-specialist | No |
| Phase 5 (Audit) | supabase-auditor | Yes |

---

## Verification Checklist

- [ ] `pnpm type-check` passes
- [ ] `pnpm build` passes
- [ ] `pnpm test:e2e` passes (after Phase 1)
- [ ] Manual test: Upload → Analyze → Result flow works
- [ ] Error handling shows correct messages for each error code
- [ ] Credit consumption uses correct credit type
- [ ] Prompts load from database (with fallback)
