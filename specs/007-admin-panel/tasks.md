# Admin Panel - Implementation Tasks

**Feature Branch**: `007-admin-panel`
**Spec**: [spec.md](./spec.md)
**Started**: 2025-12-29
**Status**: Planning

---

## Phase 1: Foundation (Day 1)

### T001 - Install Refine Dependencies
- [ ] Add `@refinedev/core`, `@refinedev/cli`
- [ ] Add `@refinedev/supabase` (data provider)
- [ ] Add `@refinedev/antd`, `antd`, `@ant-design/icons` (UI)
- [ ] Add `@refinedev/react-router`
- [ ] Verify no dependency conflicts with existing packages

**Executor**: MAIN (trivial install)
**Artifacts**: `package.json`

---

### T002 - Create Admin Route Structure
- [ ] Create `/admin` route in main `App.tsx`
- [ ] Create `src/admin/App.tsx` — Refine wrapper
- [ ] Create `src/admin/layout/AdminLayout.tsx` — Sidebar + Header
- [ ] Setup Ant Design CSS isolation (prevent Tailwind conflicts)

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/App.tsx`, `src/admin/layout/AdminLayout.tsx`, `src/App.tsx`

---

### T003 - Implement Auth Provider
- [ ] Create `src/admin/authProvider.ts`
- [ ] Integrate Supabase Auth login
- [ ] Add `is_admin()` email whitelist check
- [ ] Create `/admin/login` page
- [ ] Redirect non-admins to 403

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/authProvider.ts`, `src/admin/pages/login/index.tsx`

---

### T004 - Create Database RLS Policies
- [ ] Create `is_admin()` function in Supabase
- [ ] Add RLS policy for `system_config` (admin read/update)
- [ ] Add RLS policy for `unified_users` (admin read)
- [ ] Add RLS policy for `unified_user_credits` (admin read/update)
- [ ] Add RLS policy for `messages` (admin read)
- [ ] Add RLS policy for `analysis_history` (admin read)
- [ ] Add RLS policy for `user_states` (admin read/update)
- [ ] Test policies in Supabase Dashboard

**Executor**: database-architect
**Artifacts**: Supabase migrations

---

## Phase 2: Core Resources (Day 2)

### T005 - System Config Resource
- [ ] Create `src/admin/pages/system-config/list.tsx`
- [ ] Create `src/admin/pages/system-config/edit.tsx`
- [ ] Create `src/admin/components/JsonEditor.tsx` (JSONB editing)
- [ ] Add validation for JSON format
- [ ] Connect to Refine dataProvider

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/system-config/*`

---

### T006 - Users Resource
- [ ] Create `src/admin/pages/users/list.tsx`
- [ ] Create `src/admin/pages/users/show.tsx`
- [ ] Join `unified_users` + `unified_user_credits` data
- [ ] Add pagination (25 per page)
- [ ] Add search by `telegram_id`, `display_name`
- [ ] Add sorting by `last_active_at`, `created_at`

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/users/*`

---

### T007 - Credits Resource
- [ ] Create `src/admin/pages/credits/edit.tsx`
- [ ] Create `admin_adjust_credits` RPC function
- [ ] Implement atomic credit updates
- [ ] Log changes to `backend_credit_transactions`
- [ ] Link from Users page

**Executor**: react-vite-specialist + database-architect
**Artifacts**: `src/admin/pages/credits/*`, Supabase migration

---

## Phase 3: Advanced Features (Day 3)

### T008 - Messages Resource
- [ ] Create `src/admin/pages/messages/list.tsx`
- [ ] Add filters: `conversation_id`, `role`, `content_type`
- [ ] Show metadata in expandable row
- [ ] Add pagination
- [ ] Link to user details

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/messages/*`

---

### T009 - User States Resource
- [ ] Create `src/admin/pages/user-states/list.tsx`
- [ ] Highlight stuck users (onboarding_step != null > 24h)
- [ ] Add "Reset State" action button
- [ ] Implement reset functionality (clear onboarding_step, onboarding_data)

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/user-states/*`

---

## Phase 4: Analytics Dashboard (Day 4)

### T010 - LLM Costs Aggregation View
- [ ] Create `admin_llm_costs` view in Supabase
- [ ] Aggregate by: user, model, day
- [ ] Include: request_count, total_tokens, avg_processing_ms
- [ ] Grant SELECT to authenticated

**Executor**: database-architect
**Artifacts**: Supabase migration

---

### T011 - Dashboard Page
- [ ] Create `src/admin/pages/dashboard/index.tsx`
- [ ] Stats cards: total users, total requests, active today
- [ ] Quick links to all resources

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/dashboard/*`

---

### T012 - Costs Dashboard
- [ ] Create `src/admin/pages/costs/index.tsx`
- [ ] Create `src/admin/components/CostChart.tsx`
- [ ] Add date range filter (7d, 30d, custom)
- [ ] Show: total requests, total tokens, top models
- [ ] Calculate estimated cost from tokens (client-side)

**Executor**: react-vite-specialist
**Artifacts**: `src/admin/pages/costs/*`, `src/admin/components/CostChart.tsx`

---

## Phase 5: Polish & Testing (Day 5)

### T013 - Error Handling & Loading States
- [ ] Add error boundaries
- [ ] Add loading skeletons
- [ ] Add empty states
- [ ] Handle network errors gracefully

**Executor**: react-vite-specialist
**Artifacts**: Updates to all pages

---

### T014 - Manual Testing
- [ ] Test admin login flow
- [ ] Test system config edit
- [ ] Test user list & search
- [ ] Test credit adjustment
- [ ] Test message viewer
- [ ] Test user state reset
- [ ] Test costs dashboard

**Executor**: MAIN (manual)
**Artifacts**: None (verification)

---

### T015 - Documentation
- [ ] Update `docs/ADMIN_PANEL_SPEC.md` with final implementation
- [ ] Add admin guide section to README or separate doc
- [ ] Document how to add new admin emails

**Executor**: technical-writer
**Artifacts**: `docs/ADMIN_PANEL.md`

---

## Summary

| Phase | Tasks | Priority | Days |
|-------|-------|----------|------|
| 1. Foundation | T001-T004 | P0 | Day 1 |
| 2. Core Resources | T005-T007 | P1 | Day 2 |
| 3. Advanced Features | T008-T009 | P2 | Day 3 |
| 4. Analytics | T010-T012 | P2 | Day 4 |
| 5. Polish | T013-T015 | P3 | Day 5 |

**Total**: 15 tasks, 5 days estimated
