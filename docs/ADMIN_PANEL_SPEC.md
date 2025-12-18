# Technical Specification: Admin Panel Implementation (Refine + Supabase)

**Goal:** Create a lightweight, secure Admin Panel to manage AI Configuration (`app_config`) and view User Data, integrated into the existing React application.

**Stack:**
- **Framework:** Refine (`@refinedev/core`)
- **UI Kit:** Ant Design (`@refinedev/antd`) - for "out of the box" pro-grade UI.
- **Backend:** Supabase (`@refinedev/supabase`)
- **Router:** React Router v6 (Integrated with existing app)

---

## 1. Architecture

### 1.1. Access Control
- **Route:** `/admin/*` (Protected Route).
- **Role:** Access restricted to users with `role: 'admin'` or specific `email` whitelist (e.g., your email).
- **Logic:**
  - If user is NOT logged in -> Redirect to `/admin/login` (Refine's Auth Page).
  - If user IS logged in but NOT admin -> Show "403 Unauthorized".

### 1.2. Resources (Menu Items)
The admin panel will manage the following resources:

#### A. `app_config` (AI Configuration)
- **Purpose:** Configure AI Models and Prompts without code deployment.
- **Table:** `app_config` (created in Phase 0.4).
- **Columns:**
  - `config_key` (Read-only after creation)
  - `config_value` (Text Area / JSON Editor)
  - `description` (Read-only / Helper text)
- **Operations:** List, Edit. (Create/Delete restricted to prevent breaking backend).

#### B. `users` (Read-only View)
- **Purpose:** See who is using the app.
- **Source:** Supabase `profiles` table.
- **Columns:** `id`, `full_name`, `email`, `created_at`.
- **Operations:** List, Show.

#### C. `purchases` (Financials)
- **Purpose:** Track revenue.
- **Source:** `purchases` table.
- **Columns:** `amount_rub`, `status`, `product_type`, `created_at`.
- **Operations:** List.

---

## 2. Implementation Steps

### Phase 1: Installation & Setup
1.  **Install Dependencies:**
    ```bash
    npm install @refinedev/core @refinedev/antd @refinedev/simple-rest @refinedev/supabase ant-design/icons antd
    ```
    *(Note: Using `@refinedev/supabase` data provider)*

2.  **Theme Integration:**
    -   Ensure Ant Design styles don't conflict with existing Tailwind CSS.
    -   Use `ConfigProvider` to scope AntD styles if necessary.

### Phase 2: Coding the Admin App
1.  **Component:** `pages/admin/AdminApp.tsx`.
    -   Wraps the Refine `<Refine>` component.
    -   Defines `resources`.
2.  **Routing:**
    -   Add `<Route path="/admin/*" element={<AdminApp />} />` to `App.tsx`.

### Phase 3: Resources Implementation
1.  **ConfigResource:**
    -   `list`: Table with `key` and truncated `value`.
    -   `edit`: Form with `TextArea` for `config_value`.
2.  **Auth Provider:**
    -   Map Refine's `login/logout/check` to our existing `supabaseClient`.

---

## 3. Security (RLS)

**Crucial:** The frontend Admin Panel is just a UI. Security is enforced by **Database RLS Policies**.

- **Table `app_config`:**
  - `SELECT`: Public (or Authenticated) - already set.
  - `UPDATE`: **Admin Only**.
  - *Action:* Need to create a migration to enforce "Admin Only" write access.

**Migration Required:**
```sql
-- Create custom claim or check for admin email
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Simple check by email for MVP
  RETURN (auth.jwt() ->> 'email') IN ('admin@buhbot.local', 'maslennikov-ig@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for app_config
CREATE POLICY "Admins can update config" ON app_config
FOR UPDATE USING (is_admin());
```

---

## 4. Deliverables

1.  Fully functional `/admin` route.
2.  Ability to change `VISION_MODEL` from `google/gemini-1.5-flash` to `openai/gpt-4o` via UI.
3.  Changes reflected immediately in `analyze-coffee` function (since it queries DB).

