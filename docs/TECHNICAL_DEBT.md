# Technical Debt & TODOs

**Last Updated:** 18.12.2025

This document tracks temporary solutions, stubs, and areas requiring refactoring to ensure code quality and maintainability.

---

## 1. Frontend (React)

### 🔴 Critical
- **`App.tsx` UserData Stub:**
  - *Current:* `userData` is manually constructed with `{ name: 'Friend', intent: focusArea }`.
  - *Goal:* Remove this once `ChatOnboarding` component is fully integrated. Real user input (Name, Intent) must be passed.
  - *Impact:* Personalization features (Arina using the user's name) are currently broken/generic.

### 🟡 Medium
- **Error Handling in `analysisService.ts`:**
  - *Current:* Basic `throw Error`.
  - *Goal:* Map specific backend error codes (e.g., `INSUFFICIENT_CREDITS`, `AI_SERVICE_UNAVAILABLE`) to user-friendly UI states (e.g., open Payment Modal).

---

## 2. Backend (Edge Functions)

### 🟡 Medium
- **Credit Consumption Logic (`analyze-coffee/index.ts`):**
  - *Current:* Hardcoded check: `if (mode === 'esoteric') creditType = 'cassandra'`.
  - *Goal:* Implement a proper mapping or pass `creditType` explicitly from the client based on the selected tariff/product.
- **Prompts Storage (`analyze-coffee/prompts.ts`):**
  - *Current:* System prompts are hardcoded strings constants.
  - *Goal:* Move prompts to a Database table (`app_config` or `prompts`) to allow dynamic updates via Admin Panel without redeploying the function.

---

## 3. Infrastructure & Database

### 🟢 Low
- **Legacy Tables:**
  - *Current:* Database may still contain tables/columns from the old Pre-MVP (Telegram Bot) era.
  - *Goal:* Audit and drop unused tables after full migration verification.

---

## 4. Testing

### 🔴 Critical
- **No E2E Tests:**
  - *Current:* Manual testing only.
  - *Goal:* Add Playwright/Cypress tests for the critical path: `Upload -> Analyze -> Result`.
