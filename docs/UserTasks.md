 реализация backend-миграции Telegram-бота Symancy с n8n на Node.js.

  ## Основа
  Прочитай техническое задание: docs/TZ_BACKEND_MIGRATION.md (v2.2, Ready for Implementation)

  ## Контекст проекта
  Прочитай: docs/MASTER_SPECIFICATION.md

  ## Что нужно реализовать
  - Modular Monolith на Node.js 22+ (Fastify + grammY + pg-boss)
  - LangChain.js 1.x для LLM (PostgresChatMessageHistory)
  - LangGraph 1.0 для Onboarding state machine
  - 5 режимов: Photo Analysis, Chat, Cassandra Premium, Onboarding, Proactive
  - Использовать существующую Supabase PostgreSQL инфраструктуру

  ## Структура проекта
  Новая папка: symancy-backend/ (отдельно от frontend)

  ## План реализации
  6 фаз согласно ТЗ (раздел 11), ~21 день:
  1. Foundation (Fastify + grammY + pg-boss)
  2. Photo Analysis (Vision + Interpretation chains)
  3. Chat & Memory (PostgresChatMessageHistory)
  4. Onboarding (LangGraph StateGraph)
  5. Cassandra & Proactive (Premium persona + schedulers)
  6. Production Hardening (Docker, deployment) 