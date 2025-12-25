# Technical Specification: Admin Panel Implementation (Refine + Supabase)

**Version:** 2.0 (Backend Migration Edition)
**Last Updated:** 2025-12-25
**Status:** Planned (after spec-003 completion)

**Goal:** Create a lightweight, secure Admin Panel to manage Bot Configuration, monitor User Activity, and track LLM Costs.

**Stack:**
- **Framework:** Refine (`@refinedev/core`)
- **UI Kit:** Ant Design (`@refinedev/antd`)
- **Backend:** Supabase (`@refinedev/supabase`)
- **Router:** React Router v6

---

## 1. Architecture

### 1.1. Access Control
- **Route:** `/admin/*` (Protected Route).
- **Role:** Access restricted to users with `role: 'admin'` or specific `email` whitelist.
- **Logic:**
  - If user is NOT logged in -> Redirect to `/admin/login`.
  - If user IS logged in but NOT admin -> Show "403 Unauthorized".

### 1.2. Resources (Menu Items)

#### A. `system_config` (Bot Configuration)
- **Purpose:** Configure AI Models and system parameters without code deployment.
- **Table:** `system_config` (created in spec-003).
- **Key Configs:**

| Key | Default Value | Description |
|-----|---------------|-------------|
| `model_vision` | `google/gemini-1.5-flash` | Vision model for photo analysis |
| `model_arina` | `google/gemini-1.5-flash` | Arina interpretation model |
| `model_cassandra` | `anthropic/claude-3.5-sonnet` | Cassandra premium model |
| `model_chat` | `openai/gpt-4o-mini` | Chat follow-up model |
| `cost_basic` | `1` | Credits for basic analysis |
| `cost_cassandra` | `1` | Credits for Cassandra |
| `chat_daily_limit` | `50` | Free chat messages per day |
| `inactive_reminder_days` | `7` | Days before inactive reminder |

- **Operations:** List, Edit. (Create/Delete restricted).

#### B. `profiles` (Users)
- **Purpose:** View user profiles and activity.
- **Table:** `profiles` (extended in spec-003).
- **Columns:** `id`, `telegram_user_id`, `name`, `goals`, `notification_frequency`, `onboarding_completed`, `last_interaction_at`, `daily_chat_count`.
- **Operations:** List, Show.

#### C. `purchases` (Financials)
- **Purpose:** Track revenue.
- **Table:** `purchases`.
- **Columns:** `amount_rub`, `status`, `product_type`, `created_at`, `user_id`.
- **Operations:** List.

#### D. `user_credits` (Credit Balances)
- **Purpose:** View and adjust user credit balances.
- **Table:** `user_credits`.
- **Columns:** `user_id`, `basic_credits`, `cassandra_credits`, `updated_at`.
- **Operations:** List, Edit (for support/refunds).

#### E. `chat_messages` (Conversation History)
- **Purpose:** Debug bot conversations, review AI responses.
- **Table:** `chat_messages` (spec-003).
- **Columns:** `user_id`, `telegram_user_id`, `role`, `content`, `message_type`, `metadata`, `created_at`.
- **Filters:** By user, by message_type (photo_analysis, chat, cassandra, onboarding).
- **Operations:** List (read-only).

#### F. `user_states` (Bot State Machine)
- **Purpose:** Debug user flow issues, unstick users.
- **Table:** `user_states` (spec-003).
- **Columns:** `telegram_user_id`, `current_mode`, `flow_step`, `buffer_data`, `updated_at`.
- **Operations:** List, Edit (to reset stuck users).

#### G. `scheduled_messages` (Proactive Engagement)
- **Purpose:** Monitor scheduled notifications.
- **Table:** `scheduled_messages` (spec-003).
- **Columns:** `user_id`, `message_type`, `scheduled_for`, `status`, `sent_at`, `error`.
- **Filters:** By status (pending, sent, failed).
- **Operations:** List.

#### H. LLM Cost Analytics (Dashboard)
- **Purpose:** Track AI costs per user for cost control and optimization.
- **Source:** Aggregated from `chat_messages.metadata` (fields: `tokens_used`, `cost_usd`, `model_used`).
- **Views:**
  - Per-user breakdown: total tokens, total cost, requests count
  - Per-model breakdown: usage statistics by model
  - Daily/weekly/monthly trends
  - Date range filtering
- **Operations:** Read-only dashboard.
- **Implementation:** SQL view or RPC function for aggregation.

---

## 2. Implementation Steps

### Phase 1: Installation & Setup
1. **Install Dependencies:**
   ```bash
   pnpm add @refinedev/core @refinedev/antd @refinedev/supabase antd @ant-design/icons
   ```

2. **Theme Integration:**
   - Scope Ant Design styles to `/admin` routes to avoid Tailwind conflicts.

### Phase 2: Core Admin App
1. **Component:** `pages/admin/AdminApp.tsx`
   - Wraps the Refine `<Refine>` component.
   - Defines all resources.
2. **Routing:**
   - Add `<Route path="/admin/*" element={<AdminApp />} />` to `App.tsx`.

### Phase 3: Resources Implementation
1. **ConfigResource:** Table + Edit form for `system_config`.
2. **UsersResource:** Table with filters for `profiles`.
3. **MessagesResource:** Table with conversation viewer.
4. **StatesResource:** Table with reset action.
5. **CostsDashboard:** Charts for LLM cost analytics.

### Phase 4: Auth Provider
- Map Refine's `login/logout/check` to existing `supabaseClient`.
- Admin check via `is_admin()` function.

---

## 3. Security (RLS)

**Database RLS Policies enforce all access control.**

```sql
-- Admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') IN ('maslennikov-ig@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- system_config: Admin can read/update
CREATE POLICY "Admins can manage config" ON system_config
FOR ALL USING (is_admin());

-- chat_messages: Admin can read all
CREATE POLICY "Admins can read messages" ON chat_messages
FOR SELECT USING (is_admin());

-- user_states: Admin can read/update
CREATE POLICY "Admins can manage states" ON user_states
FOR ALL USING (is_admin());

-- scheduled_messages: Admin can read
CREATE POLICY "Admins can read scheduled" ON scheduled_messages
FOR SELECT USING (is_admin());
```

---

## 4. LLM Cost Analytics SQL

```sql
-- View for per-user cost aggregation
CREATE OR REPLACE VIEW admin_llm_costs AS
SELECT
  user_id,
  p.name as user_name,
  p.telegram_user_id,
  COUNT(*) as total_requests,
  SUM((metadata->>'tokens_used')::int) as total_tokens,
  SUM((metadata->>'cost_usd')::numeric) as total_cost_usd,
  metadata->>'model_used' as model,
  DATE_TRUNC('day', cm.created_at) as date
FROM chat_messages cm
LEFT JOIN profiles p ON cm.user_id = p.id
WHERE metadata->>'cost_usd' IS NOT NULL
GROUP BY user_id, p.name, p.telegram_user_id, metadata->>'model_used', DATE_TRUNC('day', cm.created_at);

-- RPC for cost summary
CREATE OR REPLACE FUNCTION get_llm_cost_summary(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_cost_usd NUMERIC,
  total_tokens BIGINT,
  total_requests BIGINT,
  avg_cost_per_request NUMERIC,
  top_model TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM((metadata->>'cost_usd')::numeric),
    SUM((metadata->>'tokens_used')::int)::bigint,
    COUNT(*)::bigint,
    AVG((metadata->>'cost_usd')::numeric),
    MODE() WITHIN GROUP (ORDER BY metadata->>'model_used')
  FROM chat_messages
  WHERE created_at BETWEEN start_date AND end_date
    AND metadata->>'cost_usd' IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Deliverables

1. Fully functional `/admin` route with all resources.
2. Ability to change LLM models via UI (reflected immediately in bot).
3. LLM cost dashboard with per-user breakdown.
4. User state management (unstick stuck users).
5. Conversation history viewer for debugging.

---

## 6. Dependencies

- **Requires:** spec-003 Backend Migration completion (tables `system_config`, `chat_messages`, `user_states`, `scheduled_messages`).
- **Timeline:** After spec-003 Phase 6 (Production Hardening).

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2024-xx-xx | 1.0 | Initial spec (app_config focus) |
| 2025-12-25 | 2.0 | Backend Migration Edition: Updated for spec-003 architecture, added new resources (chat_messages, user_states, scheduled_messages), LLM cost analytics, correct model names |
