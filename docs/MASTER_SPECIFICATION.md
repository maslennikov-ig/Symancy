# Master Specification: Symancy Platform

**Version:** 2.0 (Backend Migration Edition)
**Last Updated:** 25.12.2025
**Repository:** maslennikov-ig/symancy2 (Public)

---

## 1. Project Overview

**Symancy** (Coffee Reader) — платформа для психологического самопознания через анализ кофейной гущи с использованием AI (Computer Vision + LLM).

**Целевая аудитория:** Женщины 25-45 лет, интересующиеся психологией, эзотерикой, саморазвитием.

**Ключевая ценность:** Мгновенная интерпретация фото кофейной чашки с фокусом на позитивную психологию.

**Каналы:**
- Web: symancy.ru (React 19 + Vite)
- Telegram Bot: @SymancyBot

---

## 2. Current Architecture (As-Is)

### Frontend (Completed)
- **Stack:** React 19, Vite, TailwindCSS, Lucide Icons
- **Features:**
  - ✅ Image Compression (WebP, ~300KB)
  - ✅ Localization (EN/RU/ZH)
  - ✅ Payments Integration (YooKassa)
- **State:** `AuthContext` (Supabase Session)

### Backend (Migration in Progress)
- **Current:** n8n workflow + Edge Functions (being deprecated)
- **Target:** Node.js Backend with LangChain.js + LangGraph

### Database (Supabase PostgreSQL)
- **Existing Tables:** `profiles`, `user_credits`, `purchases`, `analysis_history`
- **New Tables (spec-003):** `chat_messages`, `user_states`, `scheduled_messages`, `system_config`
- **Security:** RLS Policies enabled

### AI Engine
- **Provider:** OpenRouter (access to OpenAI, Anthropic, Google, Meta models)
- **Personas:** Arina (психолог) & Cassandra (оракул)

---

## 3. Target Architecture (To-Be)

### Backend Stack (spec-003)

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Server** | Fastify | HTTP webhook handler |
| **Bot Framework** | grammY | Telegram Bot API |
| **LLM Framework** | LangChain.js | Chains, memory, retry/fallback |
| **State Machine** | LangGraph | Onboarding flow with branching |
| **Job Queue** | pg-boss | Background jobs (uses PostgreSQL) |
| **Database** | Supabase | Existing infrastructure |

### 5 Interaction Modes

| Mode | Type | Description | Credits |
|------|------|-------------|---------|
| **1. Photo Analysis** | Async | Vision + Interpretation → Reading | 1 basic |
| **2. Chat** | Async | Follow-up questions with memory | Free (50/day) |
| **3. Cassandra Premium** | Async | Premium analysis with mystical style | 1 cassandra |
| **4. Onboarding** | Sync | Multi-step flow with LangGraph | Free + 1 bonus |
| **5. Proactive** | Scheduled | Engagement reminders | Free |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYMANCY BACKEND                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Fastify    │    │   pg-boss    │    │    Worker    │       │
│  │  HTTP Server │───▶│  Job Queue   │───▶│   Process    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  LangChain.js                         │       │
│  │  chains/ (Vision, Interpretation, Chat)               │       │
│  │  graphs/ (Onboarding StateGraph)                      │       │
│  │  PostgresChatMessageHistory (Memory)                  │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  OpenRouter  │    │   Supabase   │    │  Telegram    │       │
│  │   (LLM API)  │    │  PostgreSQL  │    │   Bot API    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Roadmap

### ✅ Spec 001: Landing Page Research (100% Complete)
- Research-only phase, documentation created

### ✅ Spec 002: Pre-MVP Payments (88% Complete)
- YooKassa integration
- Credit system
- Edge Functions for payments

### 🔄 Spec 003: Backend Migration (Planned)
**Objective:** Migrate from n8n to Node.js backend with LangChain.js + LangGraph

**Phases:**
1. **Foundation (Days 1-3):** Fastify + grammY + pg-boss + LangChain setup
2. **Photo Analysis (Days 4-7):** Vision + Interpretation chains
3. **Chat & Memory (Days 8-10):** PostgresChatMessageHistory
4. **Onboarding (Days 11-13):** LangGraph StateGraph
5. **Cassandra & Proactive (Days 14-17):** Premium persona + schedulers
6. **Production (Days 18-21):** Docker, deployment, hardening

**Documentation:** [TZ_BACKEND_MIGRATION.md](./TZ_BACKEND_MIGRATION.md)

### Future Phases
- **Phase 3+:** LangChain Agents for complex tool orchestration
- **Telegram Mini App:** Deep TMA integration
- **Virality:** Social sharing, referral system

---

## 5. Technical Constraints & Standards

### Code Style
- TypeScript 5.8+, Strict mode
- Functional React, Hooks
- Tailwind utility classes

### Dependencies
- **Frontend:** React 19, Vite 6, TailwindCSS
- **Backend:** Fastify 5, grammY, LangChain.js, pg-boss
- **Database:** Supabase (PostgreSQL 15)
- **Package Manager:** pnpm

### AI Configuration
- All models configurable via `system_config` table
- Fallback chains for resilience
- Cost tracking per request

---

## 6. API Reference

### Edge Functions (Current)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/functions/v1/create-payment` | POST | Init YooKassa payment |
| `/functions/v1/analyze-coffee` | POST | Analyze image (deprecated after migration) |
| `/functions/v1/payment-webhook` | POST | Handle payment callbacks |

### Node.js Backend (spec-003)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/telegram` | POST | Telegram bot webhook |
| `/health` | GET | Health check |

---

## 7. Key Documents

| Document | Purpose |
|----------|---------|
| [TZ_BACKEND_MIGRATION.md](./TZ_BACKEND_MIGRATION.md) | Technical specification for backend migration |
| [Deep Research](./DeepResearch/) | LangChain.js, pg-boss, grammY research |
| [Deep Think](./DeepThink/) | Architecture design decisions |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 18.12.2025 | 1.3 | Post-MVP Transition |
| 25.12.2025 | 2.0 | Backend Migration Edition: Added 5 modes, LangChain.js architecture, spec-003 roadmap |
