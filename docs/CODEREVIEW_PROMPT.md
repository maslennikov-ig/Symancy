# Code Review & Migration Prompt

**Role:** Senior Full-Stack Engineer / Security Auditor
**Context:** Migration of "Symancy" (Coffee Reader) from a Low-Code MVP (n8n + Telegram Bot) to a Production-Ready Architecture (React + Supabase Edge Functions + Refine Admin).

---

## 1. Summary of Changes

We have just completed **Phase 0 (Core Architecture)** of the roadmap. The goal was to eliminate security risks associated with public webhooks and optimize performance.

### Key Implementations:
1.  **Backend Migration (n8n -> Deno):**
    -   Replaced the public n8n webhook with a secured Supabase Edge Function (`analyze-coffee`).
    -   Implemented atomic credit consumption logic (RPC call).
    -   Integrated OpenRouter for AI processing (Vision + Text Interpretation).
2.  **Frontend Optimization:**
    -   Replaced static `ImageUploader` with an interactive **Chat Onboarding** flow (`ChatOnboarding.tsx`).
    -   Implemented **Client-side Image Compression** (`browser-image-compression`) targeting WebP format < 300KB.
    -   Refactored `Pricing` and `PaymentWidget` to support **Internationalization (i18n)** (EN/RU/ZH).
3.  **Admin Panel:**
    -   Integrated **Refine** framework with Ant Design (`pages/admin`).
    -   Added resources to manage `app_config` (AI models/prompts) and view `purchases`/`users`.

---

## 2. Files to Review

Please review the following files for code quality, security, and logic errors:

### Backend (Supabase Edge Functions)
-   `supabase/functions/analyze-coffee/index.ts`: Main logic. Check Auth validation, Error handling, and OpenRouter fetch calls.
-   `supabase/functions/analyze-coffee/prompts.ts`: System prompts.
-   **Critical Check:** Ensure `OPENROUTER_API_KEY` is used securely and not exposed.

### Frontend (React)
-   `App.tsx`: Main entry point. Check the integration of `ChatOnboarding` and lazy loading of `AdminApp`.
-   `components/ChatOnboarding.tsx`: New chat UI. Check state machine logic.
-   `services/analysisService.ts`: Replaced `geminiService`. Check `supabase.functions.invoke` usage.
-   `lib/i18n.ts`: Translation dictionaries.

### Admin Panel
-   `pages/admin/AdminApp.tsx`: AuthProvider logic (check `is_admin` simulation).
-   `pages/admin/resources/*`: List and Edit views.

---

## 3. Database Migrations (Action Required)

A unified SQL bundle has been prepared at `docs/MIGRATION_BUNDLE.sql`.

**Your Tasks regarding DB:**
1.  **Review the SQL:** Check if the RLS policies are secure. Specifically, verify the `is_admin()` function and how it restricts access to `app_config`.
2.  **Apply Migrations:** Execute the SQL against the Supabase instance using your MCP tools.
    -   Create `app_config` table.
    -   Insert default AI config.
    -   Apply RLS policies for Admin access.

---

## 4. Specific Questions for Reviewer

1.  **Security:** Is the `is_admin()` function in PostgreSQL (checking email whitelist) sufficient for this stage, or should we strictly move to Claims immediately?
2.  **Performance:** Is the `imageCompression` configuration (WebP, 0.3MB) optimal for GPT-4o/Gemini Vision models?
3.  **Error Handling:** In `App.tsx`, are we correctly handling cases where `analyze-coffee` returns a 402 (Insufficient Credits)?

---

## 5. Next Steps (Context for you)

After this review and migration application, the team will proceed to **Phase 1: Deep Telegram Integration** (TMA SDK).

**Please provide your review report and confirm when migrations are applied.**
