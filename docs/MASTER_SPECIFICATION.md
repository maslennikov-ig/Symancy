# Master Specification: Symancy Platform

**Version:** 1.3 (Post-MVP Transition)
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
- **Features:**
  - ✅ **Image Compression:** Client-side WebP compression (~300KB).
  - ✅ **Localization:** Full i18n (EN/RU/ZH) for Tariffs & UI.
  - 🔄 **Onboarding:** Need to implement "Chat with Arina" flow.
- **State:** `AuthContext` (Supabase Session).

### Backend & Infrastructure
- **Database:** Supabase (PostgreSQL).
  - Tables: `profiles`, `user_credits`, `purchases`, `analysis_history`, `payment_analytics`.
  - Security: RLS Policies enabled.
- **Auth:** Supabase Auth (Email, OAuth).
- **Functions (Edge):**
  - `create-payment`: Интеграция с ЮKassa.
  - ✅ `analyze-coffee`: Secure analysis (Vision -> Interpretation) with atomic credit consumption.
  - `payment-webhook`: Обработка статусов оплаты.
- **AI Engine:**
  - **Provider:** OpenRouter.
  - **Models:** Configurable via Env Vars (`VISION_MODEL`, `INTERPRETATION_MODEL`).
  - **Modes:** Psychologist (Arina) & Esoteric (Cassandra).

---

## 3. Implementation Roadmap (To-Be)

### Phase 0: Core Security & Optimization (Critical)
**Objective:** Eliminate security risks and optimize costs before scaling.

1.  ✅ **Backend Migration (n8n -> Edge Functions):**
    -   Implemented `analyze-coffee` with prompt switching and `userData` injection.
    -   Secure OpenRouter calls.
2.  ✅ **Client-Side Optimization:**
    -   Implemented `browser-image-compression` (WebP, 1024px).
3.  ✅ **Full Localization:**
    -   Refactored `Pricing.tsx`, `PaymentWidget`, `TariffSelector`.
4.  **Admin Panel (Simple):**
    -   **Goal:** Configure AI Models and Prompts without deploy.
    -   **Table:** `app_config` (key-value store).
    -   **UI:** Simple page `/admin` (protected by role).

### Phase 1: Deep Telegram Integration (TMA)
**Objective:** Native feel inside Telegram.

1.  **SDK Integration:**
    -   Init `@twa-dev/sdk`.
    -   Sync Theme params.
2.  **Auth-less Login:**
    -   Verify `initData` string on backend.
    -   Auto-create/login user by Telegram ID.
3.  **Chat Onboarding (Frontend):**
    -   Replace static Uploader with "Chat with Arina".
    -   Collect: Name, Age, Intent.

### Phase 2: Virality & Growth
**Objective:** Organic traffic via sharing.

1.  **Social Sharing:**
    -   Generate "Prediction Card" image on client.
2.  **Referral System:**
    -   Reward: +1 Credit for invite.

---

## 4. Technical Constraints & Standards

- **Code Style:** TypeScript, Functional React, Tailwind Utility Classes.
- **UI Libraries:**
  - **Chat:** `@chatscope/chat-ui-kit-react` (Unified Chat UI for Web & TMA).
  - **Payment:** `react-yoomoneycheckoutwidget`.
- **AI Configuration:** All model names must be loaded from Environment Variables or Database Config.

---

## 5. API Reference (Internal)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/functions/v1/create-payment` | POST | Init YooKassa payment | Yes (Bearer) |
| `/functions/v1/analyze-coffee` | POST | Analyze image & deduct credit | Yes (Bearer) |
| `/functions/v1/chat-arina` | POST | Pure chat (Future) | Yes (Bearer) |