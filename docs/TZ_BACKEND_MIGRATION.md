# Техническое задание: Миграция Telegram-бота с n8n на Node.js Backend

**Версия:** 2.2 (LTS Versions)
**Дата:** 2025-12-25
**Статус:** Ready for Implementation
**Основа:** Deep Research + Deep Think synthesis + LangChain decision

---

## 1. Резюме проекта

### Что мигрируем

Telegram-бот Symancy для анализа кофейной гущи. Текущая реализация на n8n (low-code) переносится на полноценный Node.js backend.

### Почему мигрируем

- n8n требует отдельного хостинга/подписки
- Сложность отладки визуального workflow
- Нет версионирования кода
- Ограниченная гибкость для 5 режимов взаимодействия

### Целевой результат

Модульный Node.js backend, поддерживающий 5 режимов взаимодействия с пользователями, использующий существующую инфраструктуру Supabase.

---

## 2. Архитектурное решение

### Паттерн: Modular Monolith + Async Job Queue

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
│  │              Supabase PostgreSQL                      │       │
│  │  (users, credits, memory, states, analysis, jobs)     │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  OpenRouter  │    │  Telegram    │    │   Resend     │       │
│  │   (LLM API)  │    │   Bot API    │    │   (Email)    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Ключевые решения

| Решение | Выбор | Альтернатива | Обоснование |
|---------|-------|--------------|-------------|
| **Server** | Fastify | Express | 2x производительнее, native TypeScript |
| **Bot** | grammY | Telegraf | Лучший TypeScript, conversations plugin |
| **Queue** | pg-boss | BullMQ | Использует Supabase, без Redis |
| **LLM** | LangChain.js | Direct SDK | PostgresChatMessageHistory, retry/fallback встроены, единственный фреймворк с нативной PostgreSQL памятью |
| **State Machine** | LangGraph | XState | Интеграция с LangChain, визуализация графов, персистентность состояний |
| **Validation** | Zod | Joi | Type-safe, работает с TypeScript |
| **DB Client** | Supabase SDK | Drizzle | Уже используется, RPC функции есть |

### Почему LangChain.js, а не Direct SDK?

**Проблема Direct SDK для MVP:**
- Придётся писать вручную: retry logic, fallback chains, chat memory
- При масштабировании (новые персоны, режимы) код станет спагетти
- Миграция с Direct SDK на LangChain — болезненна, требует переписывания

**Преимущества LangChain.js:**
1. **PostgresChatMessageHistory** — единственный фреймворк с нативной PostgreSQL памятью (идеально для Supabase)
2. **Retry/Fallback из коробки** — `.withRetry()`, `.withFallbacks()`
3. **Prompt Templates** — версионируемые, с переменными
4. **Structured Output** — Zod-валидация ответов LLM
5. **Observability** — callbacks для логирования, cost tracking

**LangGraph для Onboarding:**
- State machine с ветвлением (goals → разные пути)
- Персистентность через PostgreSQL checkpointer
- Визуализация графа для отладки
- Подготовка к Agents (Phase 3+)

**Agents — отложено до Phase 3+:**

| Режим | Подход | Почему |
|-------|--------|--------|
| Photo Analysis | **Chain** | Pipeline детерминирован: Download→Vision→Interpret→Send. Нет решений. |
| Chat | **Chain** | Load history→Generate response. Простой flow. |
| Onboarding | **LangGraph** | Ветвление есть, но детерминированное (по выбору пользователя). |
| **Ассистент** (future) | **Agent** | Динамический выбор: какой контекст загрузить? Какой tool вызвать? |

Agents станут нужны когда добавим:
- "Расскажи про мой анализ за прошлую неделю" → Agent решает: вызвать DB tool, найти анализ
- "Сравни два моих анализа" → Agent: загрузить оба, сравнить, сформулировать
- Complex tool orchestration → Agent планирует последовательность действий

### Примеры кода LangChain.js

```typescript
// LLM с OpenRouter и автоматическим retry/fallback
import { ChatOpenAI } from "@langchain/openai";

const arinaModel = new ChatOpenAI({
  model: "google/gemini-1.5-flash",
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
  apiKey: process.env.OPENROUTER_API_KEY,
})
.withRetry({ stopAfterAttempt: 3 })
.withFallbacks([
  new ChatOpenAI({
    model: "openai/gpt-4o-mini",
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    apiKey: process.env.OPENROUTER_API_KEY,
  })
]);

// Чат с PostgreSQL памятью (Supabase)
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

const chatHistory = new PostgresChatMessageHistory({
  sessionId: `telegram_${telegramUserId}`,
  pool: supabasePool,  // pg.Pool из DATABASE_URL
  tableName: "chat_messages",
});

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: arinaChain,
  getMessageHistory: (sessionId) => new PostgresChatMessageHistory({
    sessionId,
    pool: supabasePool,
    tableName: "chat_messages",
  }),
  inputMessagesKey: "input",
  historyMessagesKey: "history",
});
```

---

## 3. Пять режимов взаимодействия

### Mode 1: Photo Analysis (Arina Basic)

```
Триггер: Пользователь отправляет фото
Обработка: ASYNC (через job queue)

Flow:
1. Webhook получает фото
2. Проверка: есть ли pending job? (антиспам)
3. Проверка: достаточно кредитов?
4. Создание job в pg-boss: 'analyze_photo'
5. Быстрый ответ: "Смотрю в гущу..."
6. Worker: скачать фото, resize 800x800
7. Worker: Vision API → распознание паттернов
8. Worker: Interpretation API → психологический анализ
9. Worker: сохранить в memory + analysis_history
10. Worker: списать кредит
11. Worker: отправить ответ (возможно splitting)

Модели:
- Vision: google/gemini-1.5-flash (configurable)
- Interpretation: google/gemini-1.5-flash (configurable)

Кредиты: 1 basic credit
```

### Mode 2: Chat / Follow-up

```
Триггер: Пользователь отправляет текст (не команда)
Обработка: ASYNC

Flow:
1. Webhook получает текст
2. Создание job: 'chat_reply'
3. Worker: загрузить последние 20 сообщений
4. Worker: загрузить последний анализ для контекста
5. Worker: сформировать prompt с контекстом
6. Worker: вызвать LLM
7. Worker: сохранить в memory
8. Worker: отправить ответ

Модели:
- Chat: openai/gpt-4o-mini (cheaper, fast)

Кредиты: Бесплатно (лимит 50 сообщений/день)
```

### Mode 3: Cassandra Premium

```
Триггер: /cassandra команда ИЛИ caption "premium"
Обработка: ASYNC

Flow:
- Аналогичен Mode 1, но:
  - Другой персонаж (Cassandra vs Arina)
  - Premium модель (claude-3.5-sonnet)
  - Расширенный анализ (больше секций)
  - Мистический стиль ответа

Модели:
- Vision: anthropic/claude-3.5-sonnet
- Interpretation: anthropic/claude-3.5-sonnet

Кредиты: 1 cassandra credit
```

### Mode 4: Onboarding

```
Триггер: /start ИЛИ новый пользователь
Обработка: SYNC (быстрые ответы)

Flow (LangGraph State Machine):
1. WELCOME: Приветствие + объяснение
2. ASK_NAME: "Как тебя зовут?"
3. ASK_GOALS: Inline keyboard с целями (ветвление по ответу)
4. ASK_NOTIFICATIONS: Частота напоминаний
5. COMPLETE: Первый бесплатный анализ

Состояния хранятся в: user_states table + LangGraph checkpointer
Реализация: LangGraph StateGraph + grammY (для Telegram UI)

Почему LangGraph:
- Ветвление: разные пути после выбора целей
- Персистентность: resume после disconnect
- Визуализация: граф для отладки
- Подготовка к Agents: те же паттерны

Кредиты: Бесплатно + 1 бонусный кредит
```

```typescript
// LangGraph Onboarding Example
import { StateGraph, Annotation } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const OnboardingState = Annotation.Root({
  step: Annotation<string>(),
  name: Annotation<string | null>(),
  goals: Annotation<string[]>(),
  notifications: Annotation<string | null>(),
  messages: Annotation<any[]>(),
});

const onboardingGraph = new StateGraph(OnboardingState)
  .addNode("welcome", welcomeNode)
  .addNode("ask_name", askNameNode)
  .addNode("ask_goals", askGoalsNode)
  .addNode("ask_notifications", askNotificationsNode)
  .addNode("complete", completeNode)
  .addEdge("welcome", "ask_name")
  .addEdge("ask_name", "ask_goals")
  .addConditionalEdges("ask_goals", routeByGoals)  // ← Ветвление!
  .addEdge("ask_notifications", "complete");

const checkpointer = new PostgresSaver(supabasePool);
const app = onboardingGraph.compile({ checkpointer });
```

### Mode 5: Proactive Engagement

```
Триггер: Scheduled jobs (pg-boss cron)
Обработка: ASYNC

Сценарии:
1. INACTIVE_7D: "Давно не виделись!" (7 дней неактивности)
2. WEEKLY_CHECKIN: "Как дела с рекомендациями?" (понедельник 10:00)
3. DAILY_FORTUNE: "Предсказание дня" (для подписчиков)
4. ABANDONED_ONBOARDING: "Завершите регистрацию"

Модели:
- Cheap model для генерации (meta-llama/llama-3.2-3b)

Кредиты: Бесплатно
```

---

## 4. Схема базы данных

### Новые таблицы

```sql
-- ============================================
-- 1. CHAT MEMORY (Conversation History)
-- ============================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  session_id UUID,                    -- Группировка по сессиям
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT,                  -- 'photo_analysis', 'chat', 'cassandra', 'onboarding'
  metadata JSONB DEFAULT '{}',        -- vision_result, model_used, tokens, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user_recent
  ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_telegram
  ON chat_messages(telegram_user_id, created_at DESC);

-- ============================================
-- 2. USER STATE (State Machine)
-- ============================================
CREATE TABLE user_states (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  current_mode TEXT DEFAULT 'idle',   -- 'idle', 'onboarding', 'processing'
  flow_step TEXT,                     -- 'welcome', 'ask_name', 'ask_goals', etc.
  buffer_data JSONB DEFAULT '{}',     -- Temporary data during flow
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. USER PROFILES (Extended)
-- ============================================
-- Extend existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  name TEXT,
  goals TEXT[],                       -- ['career', 'relationships', 'health']
  notification_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'never'
  onboarding_completed BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'Europe/Moscow',
  last_analysis_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  daily_chat_count INTEGER DEFAULT 0,
  daily_chat_reset_at DATE DEFAULT CURRENT_DATE;

-- ============================================
-- 4. SCHEDULED MESSAGES
-- ============================================
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  message_type TEXT NOT NULL,         -- 'inactive_reminder', 'weekly_checkin', etc.
  scheduled_for TIMESTAMPTZ NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',      -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pending
  ON scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';

-- ============================================
-- 5. SYSTEM CONFIG (Dynamic Settings)
-- ============================================
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default configuration
INSERT INTO system_config (key, value, description) VALUES
  ('model_vision', 'google/gemini-1.5-flash', 'Vision model for photo analysis'),
  ('model_arina', 'google/gemini-1.5-flash', 'Arina interpretation model'),
  ('model_cassandra', 'anthropic/claude-3.5-sonnet', 'Cassandra premium model'),
  ('model_chat', 'openai/gpt-4o-mini', 'Chat follow-up model'),
  ('cost_basic', '1', 'Credits for basic analysis'),
  ('cost_cassandra', '1', 'Credits for Cassandra'),
  ('chat_daily_limit', '50', 'Free chat messages per day'),
  ('inactive_reminder_days', '7', 'Days before inactive reminder');

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY service_chat_messages ON chat_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_user_states ON user_states
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_scheduled ON scheduled_messages
  FOR ALL USING (auth.role() = 'service_role');
```

---

## 5. Структура проекта

```
symancy-backend/
├── src/
│   ├── app.ts                      # Entry point
│   ├── config/
│   │   ├── env.ts                  # Environment variables (Zod)
│   │   └── constants.ts            # Static constants
│   │
│   ├── core/                       # Shared infrastructure
│   │   ├── database.ts             # Supabase client + pg.Pool
│   │   ├── queue.ts                # pg-boss wrapper
│   │   ├── telegram.ts             # grammY bot instance
│   │   ├── logger.ts               # Pino logger
│   │   └── langchain/              # LangChain infrastructure
│   │       ├── models.ts           # OpenRouter-backed ChatOpenAI instances
│   │       ├── memory.ts           # PostgresChatMessageHistory factory
│   │       └── checkpointer.ts     # PostgresSaver for LangGraph
│   │
│   ├── chains/                     # LangChain chains (reusable)
│   │   ├── vision.chain.ts         # Vision analysis chain
│   │   ├── interpretation.chain.ts # Arina/Cassandra interpretation
│   │   ├── chat.chain.ts           # Follow-up chat chain
│   │   └── prompts/                # ChatPromptTemplate definitions
│   │       ├── arina.prompts.ts
│   │       ├── cassandra.prompts.ts
│   │       └── vision.prompts.ts
│   │
│   ├── graphs/                     # LangGraph state machines
│   │   └── onboarding/
│   │       ├── graph.ts            # StateGraph definition
│   │       ├── state.ts            # Annotation.Root state schema
│   │       └── nodes/              # Graph nodes
│   │           ├── welcome.ts
│   │           ├── ask-name.ts
│   │           ├── ask-goals.ts
│   │           └── complete.ts
│   │
│   ├── modules/
│   │   ├── router/                 # Main message dispatcher
│   │   │   ├── index.ts            # Router setup
│   │   │   ├── detector.ts         # Message type detection
│   │   │   └── middleware.ts       # Auth, state loading
│   │   │
│   │   ├── photo-analysis/         # Mode 1 & 3
│   │   │   ├── handler.ts          # Webhook handler
│   │   │   ├── worker.ts           # Job processor (uses chains/)
│   │   │   └── personas/
│   │   │       ├── arina.strategy.ts
│   │   │       └── cassandra.strategy.ts
│   │   │
│   │   ├── chat/                   # Mode 2
│   │   │   ├── handler.ts
│   │   │   └── worker.ts           # Uses chains/chat.chain.ts
│   │   │
│   │   ├── onboarding/             # Mode 4
│   │   │   ├── handler.ts          # Telegram handler → graphs/
│   │   │   └── keyboards.ts        # Inline keyboards
│   │   │
│   │   ├── engagement/             # Mode 5
│   │   │   ├── scheduler.ts        # Cron job setup
│   │   │   ├── worker.ts
│   │   │   └── triggers/
│   │   │       ├── inactive.ts
│   │   │       ├── weekly-checkin.ts
│   │   │       └── daily-fortune.ts
│   │   │
│   │   ├── credits/                # Credit management
│   │   │   └── service.ts
│   │   │
│   │   └── config/                 # Dynamic config
│   │       └── service.ts          # DB config with caching
│   │
│   └── utils/
│       ├── image-processor.ts      # Download, resize
│       ├── html-formatter.ts       # Format for Telegram
│       ├── message-splitter.ts     # Split long messages
│       └── typing-indicator.ts     # Continuous typing
│
├── migrations/                     # Supabase migrations
│   └── 003_backend_tables.sql
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 6. Ключевые алгоритмы

### Message Router

```typescript
// modules/router/index.ts
bot.on("message", async (ctx) => {
  const telegramUserId = ctx.from.id;
  const state = await getUserState(telegramUserId);

  // 1. Priority: Onboarding (sync)
  if (state?.current_mode === 'onboarding') {
    return; // Handled by conversation middleware
  }

  // 2. Check for processing lock
  if (state?.current_mode === 'processing') {
    return ctx.reply("⏳ Я ещё читаю твою предыдущую чашку...");
  }

  // 3. Photo Analysis (async)
  if (ctx.message.photo) {
    const isPremium = ctx.message.caption?.toLowerCase().includes('cassandra');
    const persona = isPremium ? 'cassandra' : 'arina';
    const creditType = isPremium ? 'cassandra' : 'basic';

    // Check credits
    const hasCredits = await checkCredits(ctx.from.id, creditType);
    if (!hasCredits) {
      return ctx.reply("💫 Нужно пополнить баланс...", {
        reply_markup: buyCreditsKeyboard
      });
    }

    // Lock user
    await setUserMode(telegramUserId, 'processing');

    // Enqueue job
    await queue.send('analyze_photo', {
      userId: state.user_id,
      telegramUserId,
      chatId: ctx.chat.id,
      fileId: ctx.message.photo.at(-1).file_id,
      persona,
      replyToMessageId: ctx.message.message_id
    });

    return ctx.reply(getLoadingMessage(persona));
  }

  // 4. Chat / Follow-up (async)
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    // Check daily limit
    const canChat = await checkChatLimit(telegramUserId);
    if (!canChat) {
      return ctx.reply("📝 Лимит бесплатных сообщений на сегодня исчерпан...");
    }

    await queue.send('chat_reply', {
      userId: state.user_id,
      telegramUserId,
      chatId: ctx.chat.id,
      text: ctx.message.text,
      messageId: ctx.message.message_id
    });

    // No immediate reply - worker will respond
  }
});
```

### Message Splitter (HTML-aware)

```typescript
// utils/message-splitter.ts
const TELEGRAM_LIMIT = 4096;
const SAFE_LIMIT = 4000; // Leave room for tags

export function splitMessage(text: string): string[] {
  if (text.length <= SAFE_LIMIT) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;
  const tagStack: string[] = [];

  while (remaining.length > 0) {
    if (remaining.length <= SAFE_LIMIT) {
      parts.push(remaining);
      break;
    }

    // Find split point
    let splitIndex = SAFE_LIMIT;
    const searchArea = remaining.slice(0, SAFE_LIMIT);

    // Prefer paragraph breaks
    const paragraphBreak = searchArea.lastIndexOf('\n\n');
    if (paragraphBreak > SAFE_LIMIT * 0.7) {
      splitIndex = paragraphBreak;
    } else {
      // Fallback to sentence end
      const sentenceEnd = Math.max(
        searchArea.lastIndexOf('. '),
        searchArea.lastIndexOf('! '),
        searchArea.lastIndexOf('? ')
      );
      if (sentenceEnd > SAFE_LIMIT * 0.5) {
        splitIndex = sentenceEnd + 1;
      }
    }

    let part = remaining.slice(0, splitIndex);
    remaining = remaining.slice(splitIndex).trim();

    // Balance HTML tags
    part = closeOpenTags(part, tagStack);
    if (remaining && tagStack.length > 0) {
      remaining = tagStack.map(t => `<${t}>`).join('') + remaining;
    }

    parts.push(part.trim());
  }

  return parts;
}
```

### Continuous Typing Indicator

```typescript
// utils/typing-indicator.ts
export async function withTyping<T>(
  ctx: Context,
  operation: () => Promise<T>
): Promise<T> {
  let active = true;

  const typingLoop = async () => {
    while (active) {
      try {
        await ctx.api.sendChatAction(ctx.chat!.id, "typing");
      } catch (e) {
        // Ignore errors
      }
      await sleep(4000); // Typing expires after 5s
    }
  };

  // Start non-blocking
  typingLoop();

  try {
    return await operation();
  } finally {
    active = false;
  }
}
```

---

## 7. Job Definitions (pg-boss)

```typescript
// core/queue.ts
import PgBoss from 'pg-boss';

export const QUEUES = {
  ANALYZE_PHOTO: 'analyze_photo',
  CHAT_REPLY: 'chat_reply',
  SEND_MESSAGE: 'send_message',
  INACTIVE_REMINDER: 'inactive_reminder',
  WEEKLY_CHECKIN: 'weekly_checkin',
  DAILY_FORTUNE: 'daily_fortune',
} as const;

export async function setupQueues(boss: PgBoss) {
  // Photo analysis - with retry
  await boss.createQueue(QUEUES.ANALYZE_PHOTO, {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 5,
  });

  // Chat - faster, less retries
  await boss.createQueue(QUEUES.CHAT_REPLY, {
    retryLimit: 2,
    retryDelay: 2,
  });

  // Scheduled jobs
  await boss.schedule(
    QUEUES.INACTIVE_REMINDER,
    '0 10 * * *',  // Daily at 10:00
    {},
    { tz: 'Europe/Moscow' }
  );

  await boss.schedule(
    QUEUES.WEEKLY_CHECKIN,
    '0 10 * * 1',  // Monday at 10:00
    {},
    { tz: 'Europe/Moscow' }
  );
}
```

---

## 8. Error Handling Matrix

| Сценарий | Сообщение пользователю | Действие системы |
|----------|----------------------|------------------|
| Vision API timeout | "Духи молчат... Попробуй ещё раз 🔮" | Retry 3x, refund credit if all fail |
| Vision: нет паттернов | "Не могу разглядеть гущу. Сделай фото ближе ☕" | Mark failed, refund credit |
| Недостаточно кредитов | "Нужно пополнить баланс ✨" + кнопка | Показать inline keyboard с тарифами |
| LLM invalid JSON | (нет сообщения) | Retry с "fix JSON" prompt |
| Telegram rate limit | (нет сообщения) | pg-boss auto-throttle |
| User abandoned onboarding | "Продолжим знакомство? 😊" | Scheduled reminder через 24h |
| Long response (>4096) | (разбить на части) | Split + 500ms delay между частями |

---

## 9. Конфигурация

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
MODE=BOTH  # API | WORKER | BOTH

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgres://postgres:xxx@db.xxx.supabase.co:6543/postgres

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_SECRET=random-secret

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Optional
LOG_LEVEL=info
```

### Dynamic Config (database)

Все модели, промпты и лимиты хранятся в `system_config` table и кешируются на 60 секунд.

---

## 10. Deployment

### Docker

```dockerfile
FROM node:20-alpine

# Install tini for proper PID 1
RUN apk add --no-cache tini

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY prompts/ ./prompts/

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/app.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  symancy-backend:
    build: .
    restart: always
    environment:
      - NODE_ENV=production
      - MODE=BOTH
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 11. План реализации

### Phase 1: Foundation (Days 1-3)

| ID | Задача | Артефакты |
|----|--------|-----------|
| F01 | Setup Fastify + grammY + TypeScript | `app.ts`, `core/` |
| F02 | Configure Supabase client | `core/database.ts` |
| F03 | Setup pg-boss | `core/queue.ts` |
| F04 | Basic webhook → queue → worker flow | Echo bot |
| F05 | Create DB migrations | `migrations/003_backend_tables.sql` |

### Phase 2: Photo Analysis (Days 4-7)

| ID | Задача | Артефакты |
|----|--------|-----------|
| P01 | Image download & resize service | `utils/image-processor.ts` |
| P02 | OpenRouter client | `core/openrouter.ts` |
| P03 | Vision service | `modules/photo-analysis/vision.service.ts` |
| P04 | Arina interpretation service | `modules/photo-analysis/interpretation.service.ts` |
| P05 | Photo analysis worker | `modules/photo-analysis/worker.ts` |
| P06 | Message formatter + splitter | `utils/html-formatter.ts`, `utils/message-splitter.ts` |
| P07 | Credit consumption integration | `modules/credits/service.ts` |

### Phase 3: Chat & Memory (Days 8-10)

| ID | Задача | Артефакты |
|----|--------|-----------|
| C01 | Chat memory service | `modules/chat/memory.service.ts` |
| C02 | Chat worker | `modules/chat/worker.ts` |
| C03 | Daily limit tracking | Profile update |
| C04 | Context building with analysis history | Memory service |

### Phase 4: Onboarding (Days 11-13)

| ID | Задача | Артефакты |
|----|--------|-----------|
| O01 | grammY conversation setup | `modules/onboarding/conversation.ts` |
| O02 | Onboarding steps | `modules/onboarding/steps/` |
| O03 | Inline keyboards | `modules/onboarding/keyboards.ts` |
| O04 | Profile saving | Integration with profiles table |

### Phase 5: Cassandra & Proactive (Days 14-17)

| ID | Задача | Артефакты |
|----|--------|-----------|
| K01 | Cassandra persona & prompts | `modules/photo-analysis/personas/cassandra.ts` |
| K02 | Premium flow differentiation | Worker updates |
| E01 | Inactive user scheduler | `modules/engagement/triggers/inactive.ts` |
| E02 | Weekly checkin scheduler | `modules/engagement/triggers/weekly-checkin.ts` |
| E03 | Proactive message worker | `modules/engagement/worker.ts` |

### Phase 6: Production Hardening (Days 18-21)

| ID | Задача | Артефакты |
|----|--------|-----------|
| H01 | Comprehensive error handling | All modules |
| H02 | Retry logic with backoff | `utils/retry.ts` |
| H03 | Health check endpoint | `/health` |
| H04 | Logging (Pino) | `core/logger.ts` |
| H05 | Docker setup | `Dockerfile`, `docker-compose.yml` |
| H06 | Deploy & configure webhook | Production |

---

## 12. Критерии успеха

### Функциональные

- [ ] Пользователь отправляет фото → получает анализ Арины
- [ ] Пользователь задает вопрос → получает контекстный ответ
- [ ] Пользователь покупает Cassandra → получает premium анализ
- [ ] Новый пользователь → проходит onboarding
- [ ] Неактивный пользователь → получает напоминание
- [ ] Длинные ответы → корректно разбиваются

### Нефункциональные

- [ ] Время ответа на webhook < 200ms
- [ ] Время анализа фото < 30s
- [ ] Нет потери сообщений при перезапуске
- [ ] Кредиты списываются атомарно
- [ ] Логи доступны для отладки

### Инфраструктурные

- [ ] Папка `n8n/` удалена из репозитория
- [ ] Backend работает в Docker
- [ ] Все secrets в environment variables
- [ ] Health check проходит

---

## 13. Ссылки

- [Deep Research результаты](./DeepResearch/Backend%20Architecture%20for%20AI-Powered%20Telegram%20Bot%20(Symancy).md)
- [Deep Think результаты](./DeepThink/Architecture%20Design%20Document:%20Symancy%20AI%20Backend.md)
- [Существующий n8n workflow](/home/me/code/coffee/n8n/Pre-MVP%20workflow%20n8n.json)
- [Существующий analyze-coffee Edge Function](/home/me/code/coffee/supabase/functions/analyze-coffee/index.ts)

---

## 14. Зависимости (package.json)

**Актуальные LTS/Stable версии на December 2025:**

### Runtime Requirements
- **Node.js**: 22.x LTS (Maintenance) или 24.x LTS (Active)
- **pnpm**: 10.x (package manager)

### Dependencies

```json
{
  "name": "symancy-backend",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "@langchain/community": "^0.3.57",
    "@langchain/core": "^1.1.8",
    "@langchain/langgraph": "^1.0.7",
    "@langchain/langgraph-checkpoint-postgres": "^1.0.0",
    "@langchain/openai": "^1.2.0",
    "@supabase/supabase-js": "^2.80.0",
    "fastify": "^5.6.2",
    "grammy": "^1.38.4",
    "pg": "^8.16.3",
    "pg-boss": "^12.5.4",
    "pino": "^10.1.0",
    "sharp": "^0.34.5",
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.11",
    "typescript": "^5.8.3",
    "vitest": "^3.0.5",
    "pino-pretty": "^13.0.0"
  }
}
```

### Важные изменения относительно предыдущих версий

| Package | Было в ТЗ | Актуально | Breaking Changes |
|---------|-----------|-----------|------------------|
| **zod** | 3.x | **4.2.1** | ⚠️ Новый API, см. [migration guide](https://zod.dev/v4) |
| **@langchain/core** | 0.3.x | **1.1.8** | ✅ LangChain 1.0 stable |
| **@langchain/langgraph** | 0.2.x | **1.0.7** | ✅ LangGraph 1.0 stable |
| **pg-boss** | 10.x | **12.5.4** | ⚠️ Проверить changelog |
| **pino** | 9.x | **10.1.0** | Minor changes |

### Совместимость

- ✅ **Supabase 2.80.0** требует Node.js ≥20 (Node 18 dropped)
- ✅ **Fastify 5.6.2** требует Node.js ≥20
- ✅ **Sharp 0.34.5** требует Node.js ≥20.3.0
- ✅ Все LangChain пакеты на версии 1.x (stable)

### Sources

- [Fastify npm](https://www.npmjs.com/package/fastify)
- [grammY npm](https://www.npmjs.com/package/grammy)
- [LangChain.js npm](https://www.npmjs.com/package/@langchain/core)
- [pg-boss npm](https://www.npmjs.com/package/pg-boss)
- [Zod npm](https://www.npmjs.com/package/zod)

---

## Changelog

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2025-12-25 | 1.0 | Первая версия (Edge Functions) |
| 2025-12-25 | 2.0 | Полная переработка на Node.js backend после Deep Research/Think |
| 2025-12-25 | 2.1 | **LangChain Edition**: замена Direct SDK на LangChain.js + LangGraph, обновлённая структура проекта, chains/ и graphs/ папки, PostgresChatMessageHistory для памяти, PostgresSaver для Onboarding state |
| 2025-12-25 | 2.2 | **LTS Versions**: обновлены все зависимости до актуальных LTS/Stable версий (LangChain 1.x, Zod 4.x, pg-boss 12.x, Node.js 22+) |
