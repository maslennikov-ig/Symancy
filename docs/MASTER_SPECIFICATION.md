# Master Specification: Symancy Platform

**Version:** 1.0 (Post-MVP Transition)
**Last Updated:** 18.12.2025
**Repository:** maslennikov-ig/symancy2 (Public)

---

## 1. Project Overview
**Symancy** (Coffee Reader) — платформа для психологического самопознания через анализ кофейной гущи с использованием AI (Computer Vision + LLM).
**Целевая аудитория:** Женщины 25-45 лет, интересующиеся психологией, эзотерикой, саморазвитием.
**Ключевая ценность:** Мгновенная интерпретация фото кофейной чашки с фокусом на позитивную психологию.

---

## 2. Current Architecture (As-Is)

### Frontend
- **Stack:** React 19, Vite, TailwindCSS, Lucide Icons.
- **Hosting:** Netlify / Vercel (Static).
- **Key Components:**
  - `ImageUploader`: Drag & Drop загрузка.
  - `ResultDisplay`: Рендер Markdown ответа.
  - `HistoryDisplay`: Список прошлых гаданий.
- **State:** `AuthContext` (Supabase Session).

### Backend & Infrastructure
- **Database:** Supabase (PostgreSQL).
  - Tables: `profiles`, `user_credits`, `purchases`, `analysis_history`, `payment_analytics`.
  - Security: RLS Policies enabled.
- **Auth:** Supabase Auth (Email, OAuth).
- **Functions (Edge):**
  - `create-payment`: Интеграция с ЮKassa.
  - `payment-webhook`: Обработка статусов оплаты.
- **AI Engine (Legacy):**
  - **n8n Workflow:** Оркестрация Vision LLM (OpenRouter).
  - **Risk:** Public webhook, no auth check within n8n.

### Payment
- **Provider:** ЮKassa (ООО «ЮМани»).
- **Model:** Покупка кредитов (разовые платежи).
- **Tariffs:** Новичок (100р), Любитель (300р), Мудрец (500р), Кассандра (1000р).

---

## 3. Implementation Roadmap (To-Be)

### Phase 0: Core Security & Optimization (Critical)
**Objective:** Eliminate security risks and optimize costs before scaling.

1.  **Backend Migration (n8n -> Edge Functions):**
    -   Create `supabase/functions/analyze-coffee`.
    -   Move AI logic from n8n to TypeScript code.
    -   Implement **Atomic Transaction**: Check Credit -> Deduct -> Analyze -> Save.
    -   Secure API Key storage (Supabase Secrets).
2.  **Client-Side Optimization:**
    -   Implement image compression (`browser-image-compression`).
    -   Target: WebP, max 1024px, <500KB.
3.  **Full Localization:**
    -   Refactor `Pricing.tsx` and error messages to use `lib/i18n.ts`.
    -   Add English translations for tariffs.

### Phase 1: Deep Telegram Integration (TMA)
**Objective:** Native feel inside Telegram.

1.  **SDK Integration:**
    -   Init `@twa-dev/sdk`.
    -   Sync Theme params.
    -   Handle `BackButton`.
2.  **Auth-less Login:**
    -   Verify `initData` string on backend.
    -   Auto-create/login user by Telegram ID.
    -   Link Telegram account to existing Email account (optional).

### Phase 2: Virality & Growth
**Objective:** Organic traffic via sharing.

1.  **Social Sharing:**
    -   Generate "Prediction Card" image on client (Canvas).
    -   Native Telegram Share (`tg.shareUrl`).
2.  **Referral System:**
    -   `start_payload` handling.
    -   Reward: +1 Credit for invite.

### Phase 3: Retention
**Objective:** User lifecycle management.

1.  **Mood Diary:** Post-analysis feedback loop.
2.  **Achievements:** "First Cup", "Week Streak".
3.  **Push Notifications:** Reminders (via Telegram Bot API).

---

## 4. Technical Constraints & Standards

- **Code Style:** TypeScript, Functional React, Tailwind Utility Classes.
- **Performance:** Lighthouse Score > 90 (Mobile).
- **Security:**
  - No client-side API keys for AI.
  - All DB writes via RLS or Service Role Functions.
  - Input validation (Zod) on all Edge Functions.
- **Localization:** All user-facing text must be in `i18n` dictionaries.

---

## 5. API Reference (Internal)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/functions/v1/create-payment` | POST | Init YooKassa payment | Yes (Bearer) |
| `/functions/v1/analyze-coffee` | POST | Analyze image & deduct credit | Yes (Bearer) |
| `/functions/v1/payment-webhook`| POST | YooKassa Callback | No (Signature check) |

