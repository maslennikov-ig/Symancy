# Admin Panel - Implementation Tasks

**Feature Branch**: `007-admin-panel`
**Spec**: [spec.md](./spec.md)
**Started**: 2025-12-29
**Completed**: 2025-12-29
**Status**: ✅ Implemented
**Technology**: shadcn/ui + Tremor + Supabase

---

## Subagent Mapping

| Agent | Responsibilities |
|-------|-----------------|
| **MAIN** | Trivial tasks: dependency install, simple config changes |
| **react-vite-specialist** | React components, hooks, pages, shadcn/ui integration |
| **database-architect** | RLS policies, migrations, views, RPC functions |
| **code-reviewer** | Code review after each phase |
| **technical-writer** | Documentation updates |

---

## Phase 1: Foundation (Day 1)

### T001 - Install Dependencies
**Executor**: MAIN

```bash
# shadcn/ui components
pnpm dlx shadcn@latest add table data-table dialog dropdown-menu input label select tabs toast sidebar avatar badge separator skeleton

# Tremor for charts
pnpm add @tremor/react

# TanStack Table (for data-table)
pnpm add @tanstack/react-table
```

- [x] Install shadcn/ui components
- [x] Install Tremor
- [x] Install TanStack Table
- [x] Verify no dependency conflicts

→ **Artifacts**: `package.json`, `src/components/ui/*.tsx` (table, input, label, dialog, dropdown-menu, avatar, badge, separator, skeleton, select, tabs)

**Artifacts**: `package.json`, `src/components/ui/*.tsx`

---

### T002 - Create Database RLS Policies
**Executor**: database-architect

- [x] Create `is_admin()` function checking email whitelist
- [x] Add RLS policy for `system_config` (admin read/update)
- [x] Add RLS policy for `unified_users` (admin read)
- [x] Add RLS policy for `unified_user_credits` (admin read/update)
- [x] Add RLS policy for `messages` (admin read)
- [x] Add RLS policy for `analysis_history` (admin read)
- [x] Add RLS policy for `user_states` (admin read/update)
- [x] Test policies in Supabase Dashboard

→ **Artifacts**: Migration `admin_rls_policies` applied via Supabase MCP

**Context for agent**:
```sql
-- Admin email from project: maslennikov-ig@gmail.com
-- Notifications go to Telegram via ADMIN_CHAT_ID, not email
```

**Artifacts**: Supabase migration `20251229_admin_rls_policies.sql`

---

### T003 - Create Admin Route Structure
**Executor**: react-vite-specialist

- [x] Add `/admin/*` route in `src/App.tsx`
- [x] Create `src/admin/AdminApp.tsx` — entry point with auth check
- [x] Create `src/admin/hooks/useAdminAuth.ts` — admin authentication hook
- [x] Create 403 Unauthorized page for non-admins

→ **Artifacts**: `src/admin/AdminApp.tsx`, `src/admin/hooks/useAdminAuth.ts`, `src/App.tsx`

**Context for agent**:
```typescript
// Use existing Supabase client from src/lib/supabaseClient.ts
// Admin check: (await supabase.auth.getUser()).user?.email === 'maslennikov-ig@gmail.com'
// Use shadcn/ui components from src/components/ui/
// Follow existing patterns in src/pages/
```

**Artifacts**: `src/admin/AdminApp.tsx`, `src/admin/hooks/useAdminAuth.ts`, `src/App.tsx` (updated)

---

### T004 - Create Admin Layout
**Executor**: react-vite-specialist

- [x] Create `src/admin/layout/AdminLayout.tsx` — main layout wrapper
- [x] Create `src/admin/layout/AdminSidebar.tsx` — navigation with shadcn sidebar
- [x] Create `src/admin/layout/AdminHeader.tsx` — top header with logout

→ **Artifacts**: `src/admin/layout/*.tsx`

**Context for agent**:
```typescript
// Sidebar menu items:
// - Dashboard (LayoutDashboard icon)
// - System Config (Settings icon)
// - Users (Users icon)
// - Messages (MessageSquare icon)
// - Costs (DollarSign icon)
// - User States (Activity icon)
// Use Lucide React icons (already in project)
```

**Artifacts**: `src/admin/layout/*.tsx`

---

## Phase 2: Core Resources (Day 2)

### T005 - Login Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/LoginPage.tsx`
- [x] Use Supabase Auth with email/password
- [x] Redirect to `/admin/dashboard` after successful admin login
- [x] Show error for non-admin emails

→ **Artifacts**: `src/admin/pages/LoginPage.tsx`

---

### T006 - Dashboard Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/DashboardPage.tsx`
- [x] Create `src/admin/components/StatsCard.tsx` using Tremor Card
- [x] Stats: Total Users, Total Requests, Active Today, Total Revenue
- [x] Quick links to all resources

**Context for agent**:
```typescript
// Use Tremor components: Card, Metric, Text, Flex, Grid
// Fetch data from Supabase: unified_users.count, analysis_history.count, purchases.sum
```

**Artifacts**: `src/admin/pages/DashboardPage.tsx`, `src/admin/components/StatsCard.tsx`

---

### T007 - System Config Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/SystemConfigPage.tsx`
- [x] Create `src/admin/components/JsonEditor.tsx` for JSONB editing
- [x] Table with: key, value, description
- [x] Edit dialog with JSON validation
- [x] Real-time updates via Supabase

**Context for agent**:
```typescript
// Table columns: key (readonly), value (JSON editor), description, updated_at
// Use shadcn/ui: Table, Dialog, Button, Input
// JSON validation before save
```

**Artifacts**: `src/admin/pages/SystemConfigPage.tsx`, `src/admin/components/JsonEditor.tsx`

---

### T008 - Users Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/UsersPage.tsx`
- [x] Create `src/admin/components/DataTable.tsx` reusable wrapper
- [x] Columns: telegram_id, display_name, credits (basic/pro/cassandra), last_active, created_at
- [x] Search by telegram_id, display_name
- [x] Sorting by last_active_at, created_at
- [x] Pagination (25 per page)
- [x] Click row → navigate to UserDetailPage

**Context for agent**:
```typescript
// Join unified_users + unified_user_credits
// Use @tanstack/react-table with shadcn data-table
// Use shadcn/ui: Input for search, Select for sorting
```

**Artifacts**: `src/admin/pages/UsersPage.tsx`, `src/admin/components/DataTable.tsx`

---

### T009 - User Detail Page with Credit Edit
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/UserDetailPage.tsx`
- [x] Show user profile info
- [x] Credit editor: basic, pro, cassandra (number inputs)
- [x] Save via `admin_adjust_credits` RPC
- [x] Show recent messages (last 10)
- [x] Show recent analyses (last 5)

→ **Artifacts**: `src/admin/pages/UserDetailPage.tsx`

---

### T010 - Create admin_adjust_credits RPC
**Executor**: database-architect

- [x] Create `admin_adjust_credits` RPC function
- [x] Input: unified_user_id, basic_delta, pro_delta, cassandra_delta, reason
- [x] Security: Check `is_admin()` before execution
- [x] Log to `backend_credit_transactions` with type='admin_adjustment'
- [x] Return updated credits

→ **Artifacts**: Migration `admin_rpc_and_views` applied via Supabase MCP

---

## Phase 3: Advanced Features (Day 3)

### T011 - Messages Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/MessagesPage.tsx`
- [x] Filters: conversation_id, role (user/assistant), content_type
- [x] Columns: timestamp, role, content (truncated), content_type, channel
- [x] Expandable row for full content + metadata
- [x] Pagination

**Context for agent**:
```typescript
// Query messages table, join with conversations for user info
// Show metadata in expandable row (JSON formatted)
```

**Artifacts**: `src/admin/pages/MessagesPage.tsx`

---

### T012 - User States Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/UserStatesPage.tsx`
- [x] Highlight stuck users (onboarding_step != null for >24h)
- [x] Columns: telegram_user_id, onboarding_step, updated_at, status indicator
- [x] "Reset State" button per row
- [x] Reset clears: onboarding_step=null, onboarding_data={}

→ **Artifacts**: `src/admin/pages/UserStatesPage.tsx`

---

## Phase 4: Analytics Dashboard (Day 4)

### T013 - Create LLM Costs View
**Executor**: database-architect

- [x] Create `admin_llm_costs` view in Supabase
- [x] Aggregate by: unified_user_id, model_used, day
- [x] Include: request_count, total_tokens, avg_processing_ms
- [x] Join with unified_users for display_name, telegram_id
- [x] Grant SELECT to authenticated (protected by is_admin() in RLS)

→ **Artifacts**: Migration `admin_rpc_and_views` applied via Supabase MCP

---

### T014 - Costs Dashboard Page
**Executor**: react-vite-specialist

- [x] Create `src/admin/pages/CostsPage.tsx`
- [x] Create `src/admin/components/CostChart.tsx` using Tremor
- [x] Date range filter: 7d, 30d, custom
- [x] Cards: Total Requests, Total Tokens, Top Model
- [x] Bar chart: Requests by model
- [x] Area chart: Tokens over time
- [x] Table: Per-user cost breakdown

**Context for agent**:
```typescript
// Use Tremor: BarChart, AreaChart, Card, DateRangePicker
// Calculate estimated cost: tokens * model_price_per_1k / 1000
// Model prices (approximate): gemini-flash=$0.075/1M, gpt-4o-mini=$0.15/1M, claude-sonnet=$3/1M
```

**Artifacts**: `src/admin/pages/CostsPage.tsx`, `src/admin/components/CostChart.tsx`

---

## Phase 5: Polish & Testing (Day 5)

### T015 - Error Handling & Loading States
**Executor**: react-vite-specialist

- [x] Add error boundaries to admin pages
- [x] Add loading skeletons (shadcn skeleton)
- [x] Add empty states for tables
- [x] Add toast notifications for success/error (sonner)
- [x] Handle network errors gracefully

→ **Artifacts**: Integrated into all admin pages

---

### T016 - Code Review
**Executor**: code-reviewer

- [x] Type-check passes
- [x] Build passes
- [x] Security verified (RLS policies, is_admin() check in hook)
- [ ] Full code review (deferred to next iteration)

→ **Status**: Basic validation done, full review pending

---

### T017 - Manual Testing
**Executor**: MAIN

- [x] Test admin login flow - VERIFIED via Playwright
- [ ] Test with real admin credentials (requires production access)
- [ ] Test system config edit
- [ ] Test user list & search
- [ ] Test credit adjustment
- [ ] Test message viewer
- [ ] Test user state reset
- [ ] Test costs dashboard with date filters

→ **Status**: Login page verified, full testing requires production credentials

---

### T018 - Documentation
**Executor**: technical-writer

- [ ] Update `docs/ADMIN_PANEL_SPEC.md` with final implementation
- [ ] Create `docs/ADMIN_PANEL.md` usage guide
- [ ] Document how to add new admin emails
- [ ] Add admin panel section to README

→ **Status**: Deferred to next iteration

---

## Summary

| Phase | Tasks | Executors |
|-------|-------|-----------|
| 1. Foundation | T001-T004 | MAIN, database-architect, react-vite-specialist |
| 2. Core Resources | T005-T010 | react-vite-specialist, database-architect |
| 3. Advanced Features | T011-T012 | react-vite-specialist |
| 4. Analytics | T013-T014 | database-architect, react-vite-specialist |
| 5. Polish | T015-T018 | react-vite-specialist, code-reviewer, MAIN, technical-writer |

**Total**: 18 tasks, 5 days estimated

---

## Execution Order (Parallel Groups)

```
PARALLEL-GROUP-1: T001 (MAIN) + T002 (database-architect)
SEQUENTIAL: T003 (react-vite-specialist) → T004 (react-vite-specialist)
PARALLEL-GROUP-2: T005 + T006 + T007 (react-vite-specialist)
PARALLEL-GROUP-3: T008 + T009 (react-vite-specialist) + T010 (database-architect)
PARALLEL-GROUP-4: T011 + T012 (react-vite-specialist)
PARALLEL-GROUP-5: T013 (database-architect) + T014 (react-vite-specialist)
SEQUENTIAL: T015 → T016 → T017 → T018
```

---

## Agent Availability Check

| Agent | Status | Notes |
|-------|--------|-------|
| react-vite-specialist | ✅ Available | `.claude/agents/frontend/workers/react-vite-specialist.md` |
| database-architect | ✅ Available | `.claude/agents/database/workers/database-architect.md` |
| code-reviewer | ✅ Available | `.claude/agents/development/workers/code-reviewer.md` |
| technical-writer | ✅ Available | `.claude/agents/documentation/workers/technical-writer.md` |

**No new agents needed** — all required specialists exist in the project.
