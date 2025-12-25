# Техническое задание: Миграция Telegram-бота с n8n на Supabase Edge Functions

**Дата создания:** 2025-12-25
**Статус:** Draft
**Приоритет:** P0 (Critical)
**Связанные спецификации:** 001-landing-n8n-improvements, 002-pre-mvp-payments

---

## 1. Резюме

### Текущее состояние

Платформа Symancy имеет **два раздельных бэкенда**:

| Канал | Технология | Функционал |
|-------|------------|------------|
| **Web** | Supabase Edge Functions | Анализ, платежи, история |
| **Telegram** | n8n (self-hosted/cloud) | Анализ фото, Chat Memory, диалоги |

### Проблема

- Дублирование логики (Vision + Interpretation реализованы дважды)
- Разные AI-модели на разных каналах
- n8n требует отдельного хостинга/подписки
- Сложность отладки и мониторинга
- Credentials разбросаны по разным системам
- Нет единого Git-версионирования

### Цель

**Полная миграция Telegram-бота на Supabase Edge Functions** с сохранением всего функционала и улучшением архитектуры.

---

## 2. Анализ n8n Workflow

### 2.1 Компоненты текущего workflow

```
/home/me/code/coffee/n8n/Pre-MVP workflow n8n.json
```

| Нода | Тип | Функция | Миграция |
|------|-----|---------|----------|
| `question` | Telegram Trigger | Получение сообщений | Edge Function webhook |
| `Switch` | Router | Фото vs Текст | TypeScript logic |
| `Get ready` | Set | Извлечение metadata | TypeScript |
| `Get Image` | Telegram API | Скачивание фото | fetch() |
| `Edit Image` | Image Processing | Resize 800x800, JPEG | Sharp/Canvas |
| `Analyze image` | OpenAI/Vision | Vision анализ | OpenRouter API |
| `Send Typing` | HTTP Request | Typing индикатор | Telegram API |
| `Arina writer` | LangChain Agent | Интерпретация (новое фото) | OpenRouter API |
| `Arina answerer` | LangChain Agent | Follow-up вопросы | OpenRouter API |
| `Postgres Chat Memory` | Memory | Контекст диалога (20 сообщений) | Supabase table |
| `Markdown` | Converter | MD → HTML | showdown.js |
| `Code1` | JS Code | Очистка HTML для Telegram | TypeScript |
| `Code` | JS Code | Разбиение на части (4096 лимит) | TypeScript |
| `Loop Over Items` | Iterator | Отправка по частям | for loop |
| `answer` | Telegram | Отправка ответа | Telegram API |
| `Wait` | Delay | Пауза между частями | setTimeout |

### 2.2 AI-модели в n8n

| Назначение | Модель | Провайдер |
|------------|--------|-----------|
| Vision | `deepcogito/cogito-v2-preview-llama-109b-moe` | OpenRouter |
| Interpretation (primary) | `openai/gpt-oss-120b` | OpenRouter |
| Interpretation (fallback) | `qwen/qwen3-235b-a22b` | OpenRouter |

### 2.3 Системные промпты

**Arina writer** (для новых фото):
- Роль: Психолог-консультант
- Подход: Символическая терапия, позитивная психология
- Формат: HTML для Telegram (без Markdown!)
- Особенности: Баланс позитива/негатива, практические рекомендации

**Arina answerer** (для follow-up):
- Роль: Тот же психолог
- Контекст: Использует Chat Memory (20 сообщений)
- Особенности: Связь с предыдущим анализом

### 2.4 Chat Memory

```sql
-- Текущая реализация в n8n (Postgres Chat Memory node)
-- sessionKey = telegram_user_id
-- contextWindowLength = 20
```

---

## 3. Требования к миграции

### 3.1 Функциональные требования

#### FR-001: Telegram Webhook Handler
- Принимать все типы сообщений (фото, текст, команды)
- Роутинг по типу контента
- Валидация Telegram подписи (опционально)

#### FR-002: Image Processing
- Скачивание фото через Telegram Bot API
- Ресайз до 800x800 px
- Конвертация в JPEG качество 80%
- Конвертация в base64 для Vision API

#### FR-003: Vision Analysis
- Интеграция с OpenRouter API
- Использование Vision-модели (configurable)
- Обработка ошибок и fallback

#### FR-004: Interpretation (Arina)
- Два режима: writer (новое фото) и answerer (follow-up)
- Инъекция userData в промпт
- Поддержка Chat Memory контекста
- Конфигурируемые модели

#### FR-005: Chat Memory
- Таблица `telegram_chat_memory` в Supabase
- Хранение последних 20 сообщений на пользователя
- Формат: user message + assistant response
- Очистка старых записей (FIFO)

#### FR-006: Message Formatting
- Конвертация Markdown → HTML (если нужно)
- Очистка неподдерживаемых Telegram тегов
- Разбиение на части (лимит 4096 символов)
- Балансировка HTML тегов при разбиении

#### FR-007: Telegram Response
- Отправка typing индикатора
- Отправка сообщений по частям
- Пауза между частями (2-4 сек)
- Обработка ошибок отправки

#### FR-008: Credit System Integration
- Проверка баланса кредитов перед анализом
- Списание кредита после успешного анализа
- Сообщение о недостатке кредитов

### 3.2 Нефункциональные требования

| Требование | Метрика | Текущее (n8n) | Целевое |
|------------|---------|---------------|---------|
| Latency (до ответа) | секунды | 15-30 | 10-20 |
| Cold start | ms | N/A | < 500 |
| Reliability | uptime | 95% | 99% |
| Concurrent users | RPS | ~5 | ~20 |
| Memory | MB | 256 (n8n instance) | 128 per invocation |

### 3.3 Out of Scope

- Web-версия анализа (уже мигрирована)
- Платежи в Telegram (уже мигрированы в telegram-bot-webhook)
- Admin Panel
- Telegram Mini App SDK интеграция

---

## 4. Архитектура решения

### 4.1 Целевая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         Telegram Bot                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           supabase/functions/telegram-analysis/                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  1. Validate & Route (photo vs text vs command)             ││
│  │  2. Download & Process Image                                 ││
│  │  3. Load Chat Memory                                         ││
│  │  4. Vision Analysis (OpenRouter)                             ││
│  │  5. Interpretation (Arina writer/answerer)                   ││
│  │  6. Save to Chat Memory                                      ││
│  │  7. Format & Split Message                                   ││
│  │  8. Send Response (with typing)                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Supabase        OpenRouter      Telegram
         (Memory,        (Vision,        (Send
          Credits,        LLM)           Messages)
          History)
```

### 4.2 Новые таблицы Supabase

```sql
-- Таблица для Chat Memory
CREATE TABLE telegram_chat_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Индекс для быстрого доступа
CREATE INDEX idx_chat_memory_user_created
ON telegram_chat_memory(telegram_user_id, created_at DESC);

-- RLS (только service role может читать/писать)
ALTER TABLE telegram_chat_memory ENABLE ROW LEVEL SECURITY;
```

### 4.3 Структура файлов

```
supabase/functions/
├── telegram-analysis/           # НОВАЯ функция
│   ├── index.ts                 # Main handler
│   ├── handlers/
│   │   ├── photo.ts             # Photo message handler
│   │   ├── text.ts              # Text/follow-up handler
│   │   └── command.ts           # Commands (/start, /help, /history)
│   ├── services/
│   │   ├── vision.ts            # OpenRouter Vision API
│   │   ├── interpretation.ts    # Arina writer/answerer
│   │   ├── memory.ts            # Chat Memory operations
│   │   └── telegram.ts          # Telegram API helpers
│   ├── utils/
│   │   ├── image.ts             # Image processing
│   │   ├── html.ts              # HTML cleanup & splitting
│   │   └── markdown.ts          # MD → HTML conversion
│   └── prompts/
│       ├── vision.ts            # Vision system prompt
│       ├── arina-writer.ts      # Interpretation prompt
│       └── arina-answerer.ts    # Follow-up prompt
│
├── telegram-bot-webhook/        # СУЩЕСТВУЮЩАЯ (платежи)
│   └── index.ts                 # Добавить роутинг на telegram-analysis
│
└── _shared/
    ├── cors.ts
    └── types.ts
```

### 4.4 Интеграция с существующим webhook

**Вариант A**: Отдельная функция + роутинг
```
telegram-bot-webhook → /buy, payments
telegram-analysis    → photos, text, other commands
```

**Вариант B**: Единая функция с роутингом
```
telegram-bot-webhook → all telegram updates
  ├── /buy, payments  → existing logic
  └── photos, text    → new analysis logic
```

**Рекомендация**: Вариант B (единая точка входа, проще настройка webhook)

---

## 5. План миграции

### Phase 1: Infrastructure (2-3 дня)

| ID | Задача | Артефакты |
|----|--------|-----------|
| M001 | Создать миграцию `telegram_chat_memory` | SQL migration |
| M002 | Создать структуру `telegram-analysis/` | Folder structure |
| M003 | Перенести промпты из n8n в TypeScript | prompts/*.ts |
| M004 | Создать Telegram API helpers | services/telegram.ts |

### Phase 2: Core Logic (3-4 дня)

| ID | Задача | Артефакты |
|----|--------|-----------|
| M005 | Реализовать image download & processing | utils/image.ts |
| M006 | Реализовать Vision API интеграцию | services/vision.ts |
| M007 | Реализовать Interpretation (writer + answerer) | services/interpretation.ts |
| M008 | Реализовать Chat Memory CRUD | services/memory.ts |

### Phase 3: Message Handling (2-3 дня)

| ID | Задача | Артефакты |
|----|--------|-----------|
| M009 | Реализовать HTML cleanup | utils/html.ts |
| M010 | Реализовать message splitting с балансировкой тегов | utils/html.ts |
| M011 | Реализовать photo handler | handlers/photo.ts |
| M012 | Реализовать text handler (follow-up) | handlers/text.ts |

### Phase 4: Integration (2-3 дня)

| ID | Задача | Артефакты |
|----|--------|-----------|
| M013 | Интегрировать в telegram-bot-webhook | index.ts |
| M014 | Добавить credit check/consume | handlers/photo.ts |
| M015 | Добавить typing indicators | services/telegram.ts |
| M016 | Deploy & configure webhook | Supabase Dashboard |

### Phase 5: Testing & Cleanup (2-3 дня)

| ID | Задача | Артефакты |
|----|--------|-----------|
| M017 | E2E тестирование всех сценариев | Test report |
| M018 | Performance testing | Metrics |
| M019 | Отключить n8n workflow | n8n dashboard |
| M020 | Удалить папку n8n/ из репозитория | Git commit |
| M021 | Обновить документацию | README, MASTER_SPEC |

---

## 6. Риски и митигации

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Edge Function timeout (30s) | Medium | High | Streaming response, оптимизация |
| Image processing в Deno | Medium | Medium | Использовать внешний сервис или wasm |
| Chat Memory performance | Low | Medium | Индексы, лимит записей |
| Разные AI-модели | Low | Low | Унифицировать конфигурацию |
| Downtime при миграции | Low | High | Blue-green deployment |

---

## 7. Критерии успеха

### Функциональные

- [ ] Пользователь отправляет фото → получает анализ
- [ ] Пользователь задает follow-up вопрос → получает ответ с контекстом
- [ ] Длинные ответы разбиваются на части корректно
- [ ] Typing индикатор показывается
- [ ] Кредиты списываются корректно
- [ ] История диалога сохраняется (20 сообщений)

### Нефункциональные

- [ ] Latency < 20 секунд для типичного запроса
- [ ] Нет 5xx ошибок в течение 24 часов после запуска
- [ ] Папка n8n/ удалена из репозитория
- [ ] Все credentials в Supabase Vault

---

## 8. Зависимости

### Внешние

- OpenRouter API (уже используется)
- Telegram Bot API (уже используется)
- Supabase Edge Functions (уже используется)

### Внутренние

- Spec 002 должен быть завершен (платежи работают)
- Telegram bot token должен быть настроен
- Supabase secrets должны быть установлены

---

## 9. Оценка трудозатрат

| Phase | Оценка | Зависимости |
|-------|--------|-------------|
| Infrastructure | 2-3 дня | Нет |
| Core Logic | 3-4 дня | Phase 1 |
| Message Handling | 2-3 дня | Phase 2 |
| Integration | 2-3 дня | Phase 3 |
| Testing & Cleanup | 2-3 дня | Phase 4 |

**Итого: 11-16 дней** (2-3 недели)

---

## 10. Ссылки

- [n8n Workflow JSON](/home/me/code/coffee/n8n/Pre-MVP workflow n8n.json)
- [Существующий telegram-bot-webhook](/home/me/code/coffee/supabase/functions/telegram-bot-webhook/index.ts)
- [Существующий analyze-coffee](/home/me/code/coffee/supabase/functions/analyze-coffee/index.ts)
- [Spec 001 - n8n Improvements Spec](/home/me/code/coffee/specs/001-landing-n8n-improvements/deliverables/n8n-workflow/improvements-spec.md)

---

## Changelog

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2025-12-25 | 1.0 | Создание документа |
