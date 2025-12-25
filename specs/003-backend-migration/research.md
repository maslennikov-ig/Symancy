# Research: Backend Migration (n8n to Node.js)

**Date**: 2025-12-25
**Status**: Complete
**Sources**: Context7 documentation, npm packages

---

## 1. LangChain.js 1.x PostgresChatMessageHistory

### Decision
Использовать `PostgresSaver` и `PostgresStore` из `@langchain/langgraph-checkpoint-postgres` вместо устаревшего `PostgresChatMessageHistory` из `@langchain/community`.

### Rationale
- В LangChain.js 1.x рекомендуется использовать LangGraph с PostgresSaver для persistence
- `PostgresStore` поддерживает semantic search для memories
- Единый подход для checkpointing и memory storage

### API Reference

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

const DB_URI = "postgresql://postgres:password@host:port/database";

// Checkpointer для state persistence
const checkpointer = PostgresSaver.fromConnString(DB_URI);
await checkpointer.setup(); // Создает необходимые таблицы

// Store для cross-thread memories
const store = PostgresStore.fromConnString(DB_URI);
await store.setup();

// Использование в StateGraph
const graph = builder.compile({ checkpointer, store });

// Invoke с thread_id
const config = { configurable: { thread_id: "user_123" } };
await graph.invoke({ messages: [...] }, config);
```

### Alternatives Considered
- `PostgresChatMessageHistory` from `@langchain/community` — deprecated в пользу LangGraph approach
- In-memory storage — не подходит для production

---

## 2. LangGraph 1.0 PostgresSaver Checkpointer + StateGraph

### Decision
Использовать `StateGraph` с `PostgresSaver` для Onboarding flow. Не использовать grammY conversations plugin.

### Rationale
- PostgresSaver обеспечивает persistence состояния между перезапусками
- StateGraph поддерживает conditional edges для ветвления (goals → разные пути)
- Единая экосистема LangChain/LangGraph для всей LLM логики
- grammY conversations — отдельная система, требует дополнительного хранилища

### API Reference

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { registry } from "@langchain/langgraph/zod";
import * as z from "zod";

// State definition с Zod
const OnboardingState = z.object({
  step: z.string(),
  name: z.string().nullable(),
  goals: z.array(z.string()),
  notifications: z.string().nullable(),
});

// Checkpointer
const checkpointer = PostgresSaver.fromConnString(DB_URI);

// Graph definition
const graph = new StateGraph(OnboardingState)
  .addNode("welcome", welcomeNode)
  .addNode("ask_name", askNameNode)
  .addNode("ask_goals", askGoalsNode)
  .addNode("complete", completeNode)
  .addEdge(START, "welcome")
  .addEdge("welcome", "ask_name")
  .addConditionalEdges("ask_goals", routeByGoals)
  .addEdge("complete", END);

const app = graph.compile({ checkpointer });

// Invoke с thread_id (telegram_user_id)
const config = { configurable: { thread_id: `onboarding_${telegramUserId}` } };
const result = await app.invoke({ step: "welcome" }, config);
```

### grammY Conversations vs LangGraph

| Feature | grammY Conversations | LangGraph |
|---------|---------------------|-----------|
| Storage | File/Memory adapter | PostgreSQL (native) |
| Integration | Telegram-specific | LLM ecosystem |
| State Machine | Implicit | Explicit graph |
| Persistence | Separate setup | Built-in |
| Branching | Manual | Conditional edges |

**Вывод**: LangGraph лучше подходит для нашего use case, так как:
1. Уже используем LangChain.js для chains
2. PostgreSQL уже есть (Supabase)
3. Нужно ветвление по целям пользователя

---

## 3. pg-boss 12.x Cron Job Syntax

### Decision
Использовать `boss.schedule()` с cron syntax и timezone support для scheduled messages.

### Rationale
- pg-boss 12.x поддерживает стандартный cron синтаксис
- Timezone support через опцию `tz`
- Jobs persisted в PostgreSQL (Supabase)

### API Reference

```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss(DATABASE_URL);
await boss.start();

// Schedule daily job at 10:00 MSK
await boss.schedule('inactive-reminder', '0 10 * * *',
  { type: 'inactive_7d' },
  { tz: 'Europe/Moscow' }
);

// Schedule weekly job (Monday 10:00 MSK)
await boss.schedule('weekly-checkin', '0 10 * * 1',
  { type: 'weekly' },
  { tz: 'Europe/Moscow' }
);

// Schedule every 2 minutes (for testing)
await boss.schedule('health-check', '*/2 * * * *', {});

// Multiple schedules per queue with custom key
await boss.schedule('proactive-message', '0 9 * * *',
  { type: 'daily_fortune' },
  { key: 'daily-fortune', tz: 'Europe/Moscow' }
);

// Worker
await boss.work('inactive-reminder', async ([job]) => {
  const { type } = job.data;
  await sendInactiveReminders();
});

// Unschedule
await boss.unschedule('inactive-reminder');

// Get all schedules
const schedules = await boss.getSchedules();
```

### Queue Creation with Retry

```typescript
await boss.createQueue('analyze_photo', {
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 5, // seconds
});

await boss.createQueue('chat_reply', {
  retryLimit: 2,
  retryDelay: 2,
});
```

---

## 4. grammY Conversations Plugin vs LangGraph

### Decision
**Не использовать** grammY conversations plugin для Onboarding. Использовать LangGraph StateGraph.

### Rationale
См. сравнение в разделе 2. Ключевые причины:
1. Единая экосистема LangChain/LangGraph
2. Native PostgreSQL persistence
3. Explicit state machine с визуализацией
4. Подготовка к будущим Agents

### grammY Usage
grammY остается для:
- Webhook handling
- Message sending
- Inline keyboards
- Typing indicators

```typescript
import { Bot } from "grammy";

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Middleware для auth и state loading
bot.use(async (ctx, next) => {
  ctx.userState = await getUserState(ctx.from?.id);
  await next();
});

// Photo handler → pg-boss queue
bot.on("message:photo", async (ctx) => {
  await boss.send('analyze_photo', { ... });
  await ctx.reply("Смотрю в гущу...");
});

// Text handler → определение режима
bot.on("message:text", async (ctx) => {
  if (ctx.userState?.current_mode === 'onboarding') {
    // Передаем в LangGraph
    await processOnboardingInput(ctx);
  } else {
    // Chat mode → pg-boss queue
    await boss.send('chat_reply', { ... });
  }
});
```

---

## 5. Zod 4.x Migration from 3.x

### Decision
Использовать Zod 4.2.1 с учетом breaking changes.

### Rationale
- Zod 4.x — stable release
- Лучшая производительность
- Улучшенный TypeScript inference

### Key Changes

```typescript
// Import остается тем же
import * as z from "zod";

// Основные изменения:

// 1. .meta() вместо .describe() для JSON Schema
const schema = z.string().meta({
  title: "Email",
  description: "User email address"
});

// 2. z.globalRegistry для metadata
const emailSchema = z.string().register(z.globalRegistry, {
  title: "Email"
});

// 3. JSON Schema generation
import { toJSONSchema } from "zod/json-schema";
const jsonSchema = toJSONSchema(schema);

// 4. Subpath imports для совместимости
import * as z3 from "zod/v3"; // Если нужна совместимость
import * as z4 from "zod/v4";
```

### Environment Validation Example

```typescript
// src/config/env.ts
import * as z from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(3000),
  MODE: z.enum(["API", "WORKER", "BOTH"]).default("BOTH"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().startsWith("sk-or-"),

  // Optional
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ADMIN_CHAT_ID: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
```

---

## 6. Sharp 0.34 WebP Resize API

### Decision
Использовать Sharp для download и resize фото до 800x800 WebP.

### API Reference

```typescript
import sharp from 'sharp';

// Download и resize
async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(800, 800, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
}

// С метаданными
async function processImageWithMeta(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const processed = await image
    .resize(800, 800, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    buffer: processed,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    format: metadata.format,
  };
}
```

---

## 7. Additional Findings

### LangChain OpenRouter Integration

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "google/gemini-1.5-flash",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
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
```

### Fastify + grammY Webhook

```typescript
import Fastify from 'fastify';
import { Bot, webhookCallback } from 'grammy';

const app = Fastify({ logger: true });
const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Webhook endpoint
app.post('/webhook/telegram', async (request, reply) => {
  // Validate secret
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (secret !== TELEGRAM_WEBHOOK_SECRET) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  await webhookCallback(bot, 'fastify')(request, reply);
});

// Health check
app.get('/health', async () => ({ status: 'ok' }));
```

---

## Summary

| Question | Resolution |
|----------|------------|
| PostgresChatMessageHistory API | Use PostgresSaver + PostgresStore from langgraph-checkpoint-postgres |
| LangGraph PostgresSaver setup | `PostgresSaver.fromConnString(DB_URI)` + `await checkpointer.setup()` |
| grammY vs LangGraph for Onboarding | LangGraph StateGraph (unified LLM ecosystem) |
| pg-boss cron syntax | Standard cron + `tz: 'Europe/Moscow'` option |
| Zod 4.x migration | Minor changes, `.meta()` for JSON Schema |
| Sharp WebP resize | `sharp(buffer).resize(800, 800).webp().toBuffer()` |

All research questions resolved. Ready for Phase 1: Design Artifacts.
