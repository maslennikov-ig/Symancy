# Admin Panel - Implementation Tasks

**Feature Branch**: `007-admin-panel`
**Spec**: [spec.md](./spec.md)
**Started**: 2025-12-29
**Status**: Ready for Implementation
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

- [ ] Install shadcn/ui components
- [ ] Install Tremor
- [ ] Install TanStack Table
- [ ] Verify no dependency conflicts

**Artifacts**: `package.json`, `src/components/ui/*.tsx`

---

### T002 - Create Database RLS Policies
**Executor**: database-architect

- [ ] Create `is_admin()` function checking email whitelist
- [ ] Add RLS policy for `system_config` (admin read/update)
- [ ] Add RLS policy for `unified_users` (admin read)
- [ ] Add RLS policy for `unified_user_credits` (admin read/update)
- [ ] Add RLS policy for `messages` (admin read)
- [ ] Add RLS policy for `analysis_history` (admin read)
- [ ] Add RLS policy for `user_states` (admin read/update)
- [ ] Test policies in Supabase Dashboard

**Context for agent**:
```sql
-- Admin email from project: maslennikov-ig@gmail.com
-- Notifications go to Telegram via ADMIN_CHAT_ID, not email
```

**Artifacts**: Supabase migration `20251229_admin_rls_policies.sql`

---

### T003 - Create Admin Route Structure
**Executor**: react-vite-specialist

- [ ] Add `/admin/*` route in `src/App.tsx`
- [ ] Create `src/admin/AdminApp.tsx` — entry point with auth check
- [ ] Create `src/admin/hooks/useAdminAuth.ts` — admin authentication hook
- [ ] Create 403 Unauthorized page for non-admins

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

- [ ] Create `src/admin/layout/AdminLayout.tsx` — main layout wrapper
- [ ] Create `src/admin/layout/AdminSidebar.tsx` — navigation with shadcn sidebar
- [ ] Create `src/admin/layout/AdminHeader.tsx` — top header with logout

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

- [ ] Create `src/admin/pages/LoginPage.tsx`
- [ ] Use Supabase Auth with email/password
- [ ] Redirect to `/admin/dashboard` after successful admin login
- [ ] Show error for non-admin emails

**Artifacts**: `src/admin/pages/LoginPage.tsx`

---

### T006 - Dashboard Page
**Executor**: react-vite-specialist

- [ ] Create `src/admin/pages/DashboardPage.tsx`
- [ ] Create `src/admin/components/StatsCard.tsx` using Tremor Card
- [ ] Stats: Total Users, Total Requests, Active Today, Total Revenue
- [ ] Quick links to all resources

**Context for agent**:
```typescript
// Use Tremor components: Card, Metric, Text, Flex, Grid
// Fetch data from Supabase: unified_users.count, analysis_history.count, purchases.sum
```

**Artifacts**: `src/admin/pages/DashboardPage.tsx`, `src/admin/components/StatsCard.tsx`

---

### T007 - System Config Page
**Executor**: react-vite-specialist

- [ ] Create `src/admin/pages/SystemConfigPage.tsx`
- [ ] Create `src/admin/components/JsonEditor.tsx` for JSONB editing
- [ ] Table with: key, value, description
- [ ] Edit dialog with JSON validation
- [ ] Real-time updates via Supabase

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

- [ ] Create `src/admin/pages/UsersPage.tsx`
- [ ] Create `src/admin/components/DataTable.tsx` reusable wrapper
- [ ] Columns: telegram_id, display_name, credits (basic/pro/cassandra), last_active, created_at
- [ ] Search by telegram_id, display_name
- [ ] Sorting by last_active_at, created_at
- [ ] Pagination (25 per page)
- [ ] Click row → navigate to UserDetailPage

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

- [ ] Create `src/admin/pages/UserDetailPage.tsx`
- [ ] Show user profile info
- [ ] Credit editor: basic, pro, cassandra (number inputs)
- [ ] Save via `admin_adjust_credits` RPC
- [ ] Show recent messages (last 10)
- [ ] Show recent analyses (last 5)

**Artifacts**: `src/admin/pages/UserDetailPage.tsx`

---

### T010 - Create admin_adjust_credits RPC
**Executor**: database-architect

- [ ] Create `admin_adjust_credits` RPC function
- [ ] Input: unified_user_id, basic_delta, pro_delta, cassandra_delta, reason
- [ ] Security: Check `is_admin()` before execution
- [ ] Log to `backend_credit_transactions` with type='admin_adjustment'
- [ ] Return updated credits

**Artifacts**: Supabase migration `20251229_admin_adjust_credits.sql`

---

## Phase 3: Advanced Features (Day 3)

### T011 - Messages Page
**Executor**: react-vite-specialist

- [ ] Create `src/admin/pages/MessagesPage.tsx`
- [ ] Filters: conversation_id, role (user/assistant), content_type
- [ ] Columns: timestamp, role, content (truncated), content_type, channel
- [ ] Expandable row for full content + metadata
- [ ] Pagination

**Context for agent**:
```typescript
// Query messages table, join with conversations for user info
// Show metadata in expandable row (JSON formatted)
```

**Artifacts**: `src/admin/pages/MessagesPage.tsx`

---

### T012 - User States Page
**Executor**: react-vite-specialist

- [ ] Create `src/admin/pages/UserStatesPage.tsx`
- [ ] Highlight stuck users (onboarding_step != null for >24h)
- [ ] Columns: telegram_user_id, onboarding_step, updated_at, status indicator
- [ ] "Reset State" button per row
- [ ] Reset clears: onboarding_step=null, onboarding_data={}

**Artifacts**: `src/admin/pages/UserStatesPage.tsx`

---

## Phase 4: Analytics Dashboard (Day 4)

### T013 - Create LLM Costs View
**Executor**: database-architect

- [ ] Create `admin_llm_costs` view in Supabase
- [ ] Aggregate by: unified_user_id, model_used, day
- [ ] Include: request_count, total_tokens, avg_processing_ms
- [ ] Join with unified_users for display_name, telegram_id
- [ ] Grant SELECT to authenticated (protected by is_admin() in RLS)

**Artifacts**: Supabase migration `20251229_admin_llm_costs_view.sql`

---

### T014 - Costs Dashboard Page
**Executor**: react-vite-specialist

- [ ] Create `src/admin/pages/CostsPage.tsx`
- [ ] Create `src/admin/components/CostChart.tsx` using Tremor
- [ ] Date range filter: 7d, 30d, custom
- [ ] Cards: Total Requests, Total Tokens, Top Model
- [ ] Bar chart: Requests by model
- [ ] Area chart: Tokens over time
- [ ] Table: Per-user cost breakdown

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

- [ ] Add error boundaries to admin pages
- [ ] Add loading skeletons (shadcn skeleton)
- [ ] Add empty states for tables
- [ ] Add toast notifications for success/error (shadcn toast)
- [ ] Handle network errors gracefully

**Artifacts**: Updates to all admin pages

---

### T016 - Code Review
**Executor**: code-reviewer

- [ ] Review all Phase 1-4 code
- [ ] Check TypeScript types
- [ ] Verify security (RLS policies, admin checks)
- [ ] Check accessibility basics
- [ ] Performance review (no N+1 queries)

**Artifacts**: Code review report

---

### T017 - Manual Testing
**Executor**: MAIN

- [ ] Test admin login flow (valid admin, invalid user)
- [ ] Test system config edit (change model, verify in bot)
- [ ] Test user list & search
- [ ] Test credit adjustment
- [ ] Test message viewer
- [ ] Test user state reset
- [ ] Test costs dashboard with date filters

**Artifacts**: Test report

---

### T018 - Documentation
**Executor**: technical-writer

- [ ] Update `docs/ADMIN_PANEL_SPEC.md` with final implementation
- [ ] Create `docs/ADMIN_PANEL.md` usage guide
- [ ] Document how to add new admin emails
- [ ] Add admin panel section to README

**Artifacts**: `docs/ADMIN_PANEL.md`, `docs/ADMIN_PANEL_SPEC.md` (updated)

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
