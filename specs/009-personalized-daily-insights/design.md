# 009: Персонализированные AI-инсайты дня

## Статус: DRAFT

**Дата создания**: 2026-01-04
**Автор**: Claude Code

---

## 1. Обзор

### 1.1 Проблема

Текущая реализация "Инсайта дня" имеет несколько критических недостатков:

1. **Статичные сообщения**: Используются заранее написанные тексты из пула (14 на фронте, 7 на бэке)
2. **Отсутствие синхронизации**: Frontend (`dailyInsightService.ts`) и Backend (`daily-fortune.ts`) используют разные пулы текстов
3. **Нет персонализации**: Сообщения не учитывают историю общения с пользователем
4. **Нет взаимосвязи**: Утренний совет и вечерний инсайт никак не связаны
5. **Бесполезная кнопка**: "Узнать больше" в WebApp просто закрывает приложение без какого-либо действия

### 1.2 Решение

Создать систему персонализированных AI-генерируемых инсайтов:

- **Утро (8:00)**: AI генерирует персональную рекомендацию на день на основе истории общения
- **Вечер (20:00)**: AI генерирует follow-up инсайт, связанный с утренней рекомендацией
- **Персонализация**: Используем историю сообщений и user_memories для контекста
- **Синхронизация**: Один источник данных для Telegram и WebApp

---

## 2. Архитектура

### 2.1 Текущее состояние

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ dailyInsightService.ts                               │    │
│  │ - INSIGHT_POOL[14 texts per language]                │    │
│  │ - getInsightContent(language, persona, cache)        │    │
│  │ - Rotation: dayOfYear % pool.length                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ DailyInsightCard.tsx                                 │    │
│  │ - Shows teaser (first 100 chars)                     │    │
│  │ - "Learn more" button → close() in WebApp            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ daily-fortune.ts                                     │    │
│  │ - fortunes[7 texts, Russian only]                    │    │
│  │ - createDailyFortuneMessage()                        │    │
│  │ - Rotation: dayOfYear % 7                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ scheduler.ts (pg-boss)                               │    │
│  │ - daily-fortune: "0 8 * * *" (8:00 MSK)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ProactiveMessageService                              │    │
│  │ - findDailyFortuneUsers()                            │    │
│  │ - sendBatchEngagementMessages()                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Проблема рассинхронизации:**
- День года 10: Frontend показывает `INSIGHT_POOL[10 % 14]` = insight #10
- День года 10: Backend отправляет `fortunes[10 % 7]` = fortune #3
- Разные тексты на одну и ту же тему!

### 2.2 Целевое состояние

```
┌─────────────────────────────────────────────────────────────┐
│                     NEW DATABASE TABLE                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ daily_insights                                       │    │
│  │ - id: UUID                                           │    │
│  │ - unified_user_id: UUID (FK → unified_users)         │    │
│  │ - date: DATE (unique per user per day)               │    │
│  │ - morning_advice: TEXT (AI-generated, ~200-400 chars)│    │
│  │ - morning_sent_at: TIMESTAMPTZ                       │    │
│  │ - evening_insight: TEXT (AI-generated, ~200-400 chars│    │
│  │ - evening_sent_at: TIMESTAMPTZ                       │    │
│  │ - context_messages: JSONB (last N message IDs used)  │    │
│  │ - context_memories: JSONB (memory IDs used)          │    │
│  │ - tokens_used: INTEGER                               │    │
│  │ - created_at: TIMESTAMPTZ                            │    │
│  │ - updated_at: TIMESTAMPTZ                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ DailyInsightChain (NEW)                              │    │
│  │ - generateMorningAdvice(userId, context)             │    │
│  │ - generateEveningInsight(userId, morningAdvice, ctx) │    │
│  │ - Uses: chat history, user memories, persona prompts │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ scheduler.ts (UPDATED)                               │    │
│  │ - morning-insight: "0 8 * * *" (8:00 MSK)            │    │
│  │ - evening-insight: "0 20 * * *" (20:00 MSK)          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ worker.ts (UPDATED)                                  │    │
│  │ - processMorningInsight()                            │    │
│  │ - processEveningInsight()                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ API: GET /api/insights/today (NEW)                   │    │
│  │ - Returns today's insight for current user           │    │
│  │ - Used by frontend DailyInsightCard                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ DailyInsightCard.tsx (UPDATED)                       │    │
│  │ - Fetches from /api/insights/today                   │    │
│  │ - Shows morning advice OR evening insight            │    │
│  │ - Removes "Learn more" button in WebApp mode         │    │
│  │ - Fallback to static pool if API fails               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Детальный дизайн

### 3.1 Новая таблица: daily_insights

```sql
-- Migration: 20260104_create_daily_insights.sql

CREATE TABLE IF NOT EXISTS daily_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Morning advice (generated at ~8:00)
  morning_advice TEXT,
  morning_advice_short TEXT, -- First 100 chars for teaser
  morning_sent_at TIMESTAMPTZ,
  morning_tokens_used INTEGER DEFAULT 0,

  -- Evening insight (generated at ~20:00)
  evening_insight TEXT,
  evening_insight_short TEXT, -- First 100 chars for teaser
  evening_sent_at TIMESTAMPTZ,
  evening_tokens_used INTEGER DEFAULT 0,

  -- Context used for generation (for debugging/analytics)
  context_data JSONB DEFAULT '{}',
  -- Structure: {
  --   "message_ids": ["uuid1", "uuid2", ...],
  --   "memory_ids": ["uuid1", "uuid2", ...],
  --   "last_analysis_id": "uuid" | null
  -- }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One insight record per user per day
  UNIQUE(unified_user_id, date)
);

-- Index for fast lookup by user and date
CREATE INDEX idx_daily_insights_user_date
  ON daily_insights(unified_user_id, date DESC);

-- RLS policies
ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

-- Users can only read their own insights
CREATE POLICY "Users can read own insights" ON daily_insights
  FOR SELECT USING (
    unified_user_id IN (
      SELECT id FROM unified_users
      WHERE auth_id = auth.uid()
    )
  );

-- Service role can insert/update (for background jobs)
CREATE POLICY "Service role full access" ON daily_insights
  FOR ALL USING (auth.role() = 'service_role');
```

### 3.2 Промпты для генерации

#### 3.2.1 Morning Advice Prompt

Файл: `prompts/arina/morning-advice.txt`

```
## ЗАДАЧА

Сгенерируй персональную рекомендацию на день для пользователя.

## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ

{{USER_CONTEXT}}

## ИСТОРИЯ ПОСЛЕДНИХ СООБЩЕНИЙ (если есть)

{{CHAT_HISTORY}}

## РЕЛЕВАНТНЫЕ ВОСПОМИНАНИЯ О ПОЛЬЗОВАТЕЛЕ

{{USER_MEMORIES}}

## ПОСЛЕДНИЙ АНАЛИЗ КОФЕЙНОЙ ГУЩИ (если есть)

{{LAST_ANALYSIS}}

## ТРЕБОВАНИЯ К ОТВЕТУ

1. **Длина**: 150-300 символов (короткий, ёмкий совет)
2. **Тон**: Тёплый, поддерживающий, как от близкого друга-психолога
3. **Персонализация**: Учитывай историю общения и информацию о пользователе
4. **Практичность**: Дай конкретное действие или фокус на день
5. **Связь с контекстом**: Если есть недавний анализ — можешь отсылать к нему

## ФОРМАТ

Просто текст совета. Без заголовков, списков, markdown.
Используй 1-2 эмодзи для акцента (✨, 💫, 🌟, ☀️, 💡).

## ПРИМЕР

"✨ Сегодня хороший день обратить внимание на детали — помнишь, в твоём последнем раскладе была концентрация энергии в области мелочей? Попробуй найти что-то важное в том, мимо чего обычно проходишь."
```

#### 3.2.2 Evening Insight Prompt

Файл: `prompts/arina/evening-insight.txt`

```
## ЗАДАЧА

Сгенерируй вечерний инсайт-рефлексию для пользователя, связанный с утренней рекомендацией.

## УТРЕННИЙ СОВЕТ СЕГОДНЯ

{{MORNING_ADVICE}}

## НОВЫЕ СООБЩЕНИЯ ЗА ДЕНЬ (если были)

{{TODAYS_MESSAGES}}

## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ

{{USER_CONTEXT}}

## ТРЕБОВАНИЯ К ОТВЕТУ

1. **Длина**: 150-350 символов
2. **Связь с утром**: Обязательно отсылка к утреннему совету
3. **Вопрос или рефлексия**: Спроси как прошёл день или дай пищу для размышлений
4. **Тёплое завершение**: Пожелай хорошего вечера/ночи

## ФОРМАТ

Текст без markdown. 1-2 эмодзи (🌙, ✨, 💫, 🌟, 💭).

## ПРИМЕР

"🌙 Как прошёл день? Удалось ли заметить те самые детали, о которых я говорила утром? Иногда самое важное прячется именно в мелочах. Расскажи мне завтра, если что-то интересное откроется. Хорошего вечера ✨"
```

### 3.3 DailyInsightChain

Файл: `symancy-backend/src/chains/daily-insight.chain.ts`

```typescript
/**
 * Daily Insight Chain
 * Generates personalized morning advice and evening insights using AI
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createArinaModel } from "../core/langchain/models.js";
import { getSupabase } from "../core/database.js";
import { searchMemories } from "../services/memory.service.js";
import { readFile } from "fs/promises";
import path from "path";

// Cached prompts
let morningPrompt: string | null = null;
let eveningPrompt: string | null = null;

interface InsightContext {
  userId: string;
  telegramId: number;
  displayName: string | null;
  languageCode: string;
}

interface GeneratedInsight {
  text: string;
  shortText: string; // First 100 chars
  tokensUsed: number;
  contextData: {
    message_ids: string[];
    memory_ids: string[];
    last_analysis_id: string | null;
  };
}

/**
 * Load chat history for user (last N messages)
 */
async function loadRecentMessages(
  userId: string,
  limit: number = 10
): Promise<{ id: string; role: string; content: string }[]> {
  const supabase = getSupabase();

  // Get user's conversations
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("unified_user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(1);

  if (!conversations || conversations.length === 0) {
    return [];
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", conversations[0].id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return messages?.reverse() || [];
}

/**
 * Load last analysis for user
 */
async function loadLastAnalysis(telegramId: number): Promise<{
  id: string;
  interpretation: string;
} | null> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("analysis_history")
    .select("id, interpretation")
    .eq("telegram_user_id", telegramId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

/**
 * Generate morning advice for user
 */
export async function generateMorningAdvice(
  context: InsightContext
): Promise<GeneratedInsight> {
  // Load prompt
  if (!morningPrompt) {
    morningPrompt = await readFile(
      path.join(process.cwd(), "prompts/arina/morning-advice.txt"),
      "utf-8"
    );
  }

  // Load context data
  const [recentMessages, memories, lastAnalysis] = await Promise.all([
    loadRecentMessages(context.userId),
    searchMemories(context.telegramId, "личность характер интересы цели", 5)
      .catch(() => []),
    loadLastAnalysis(context.telegramId),
  ]);

  // Build prompt with context
  const userContextStr = `
Имя: ${context.displayName || "Пользователь"}
Язык: ${context.languageCode}
  `.trim();

  const chatHistoryStr = recentMessages.length > 0
    ? recentMessages
        .map(m => `${m.role === "user" ? "Пользователь" : "Арина"}: ${m.content}`)
        .join("\n")
    : "Нет недавних сообщений.";

  const memoriesStr = memories.length > 0
    ? memories.map(m => `- ${m.content}`).join("\n")
    : "Нет сохранённых воспоминаний.";

  const analysisStr = lastAnalysis
    ? lastAnalysis.interpretation.substring(0, 500) + "..."
    : "Нет недавних анализов.";

  // Replace placeholders
  const filledPrompt = morningPrompt
    .replace("{{USER_CONTEXT}}", userContextStr)
    .replace("{{CHAT_HISTORY}}", chatHistoryStr)
    .replace("{{USER_MEMORIES}}", memoriesStr)
    .replace("{{LAST_ANALYSIS}}", analysisStr);

  // Load system prompt
  const systemPrompt = await readFile(
    path.join(process.cwd(), "prompts/arina/system.txt"),
    "utf-8"
  );

  // Generate with LLM
  const model = await createArinaModel({ maxTokens: 500 });
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(filledPrompt),
  ]);

  const text = response.content as string;
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text,
    shortText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    tokensUsed,
    contextData: {
      message_ids: recentMessages.map(m => m.id),
      memory_ids: memories.map(m => m.id),
      last_analysis_id: lastAnalysis?.id || null,
    },
  };
}

/**
 * Generate evening insight linked to morning advice
 */
export async function generateEveningInsight(
  context: InsightContext,
  morningAdvice: string
): Promise<GeneratedInsight> {
  // Load prompt
  if (!eveningPrompt) {
    eveningPrompt = await readFile(
      path.join(process.cwd(), "prompts/arina/evening-insight.txt"),
      "utf-8"
    );
  }

  // Load today's messages (after morning advice was sent)
  const todaysMessages = await loadRecentMessages(context.userId, 5);

  // Build prompt
  const userContextStr = `
Имя: ${context.displayName || "Пользователь"}
Язык: ${context.languageCode}
  `.trim();

  const todaysMessagesStr = todaysMessages.length > 0
    ? todaysMessages
        .map(m => `${m.role === "user" ? "Пользователь" : "Арина"}: ${m.content}`)
        .join("\n")
    : "Пользователь сегодня не писал.";

  // Replace placeholders
  const filledPrompt = eveningPrompt
    .replace("{{MORNING_ADVICE}}", morningAdvice)
    .replace("{{TODAYS_MESSAGES}}", todaysMessagesStr)
    .replace("{{USER_CONTEXT}}", userContextStr);

  // Load system prompt
  const systemPrompt = await readFile(
    path.join(process.cwd(), "prompts/arina/system.txt"),
    "utf-8"
  );

  // Generate with LLM
  const model = await createArinaModel({ maxTokens: 500 });
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(filledPrompt),
  ]);

  const text = response.content as string;
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  return {
    text,
    shortText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    tokensUsed,
    contextData: {
      message_ids: todaysMessages.map(m => m.id),
      memory_ids: [],
      last_analysis_id: null,
    },
  };
}
```

### 3.4 Scheduler Updates

Файл: `symancy-backend/src/modules/engagement/scheduler.ts`

```typescript
const SCHEDULES = {
  // ... existing schedules ...

  // DEPRECATED: Remove after migration
  // "daily-fortune": {
  //   cron: "0 8 * * *",
  //   tz: "Europe/Moscow",
  //   description: "Daily fortune for users with spiritual goal",
  // },

  // NEW: Personalized insights
  "morning-insight": {
    cron: "0 8 * * *", // Daily at 8:00 MSK
    tz: "Europe/Moscow",
    description: "Generate and send personalized morning advice",
  },
  "evening-insight": {
    cron: "0 20 * * *", // Daily at 20:00 MSK
    tz: "Europe/Moscow",
    description: "Generate and send personalized evening insight",
  },
} as const;
```

### 3.5 Worker Updates

Файл: `symancy-backend/src/modules/engagement/worker.ts`

```typescript
/**
 * Process morning insight job
 * Generates personalized AI advice for each eligible user
 */
export async function processMorningInsight(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "morning-insight" });
  jobLogger.info("Starting morning insight processing");

  try {
    const proactiveService = getProactiveMessageService();
    const users = await proactiveService.findDailyInsightUsers();

    if (users.length === 0) {
      jobLogger.info("No users for morning insight");
      return;
    }

    jobLogger.info({ count: users.length }, "Generating morning insights");

    let successCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        // Generate personalized advice
        const insight = await generateMorningAdvice({
          userId: user.id,
          telegramId: user.telegramId,
          displayName: user.displayName,
          languageCode: user.languageCode,
        });

        // Save to database
        await saveMorningInsight(user.id, insight);

        // Send to Telegram
        const message = `☀️ Совет на день\n\n${insight.text}`;
        await proactiveService.sendEngagementMessage(
          user,
          "morning-insight",
          message
        );

        successCount++;

        // Rate limiting
        await sleep(200);
      } catch (error) {
        failedCount++;
        jobLogger.error({ error, userId: user.id }, "Failed to process user");
      }
    }

    jobLogger.info(
      { total: users.length, success: successCount, failed: failedCount },
      "Morning insight processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Morning insight processing failed");
    throw error;
  }
}

/**
 * Process evening insight job
 * Generates follow-up insight linked to morning advice
 */
export async function processEveningInsight(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "evening-insight" });
  jobLogger.info("Starting evening insight processing");

  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split("T")[0];

    // Find users who received morning insight today
    const { data: todaysInsights } = await supabase
      .from("daily_insights")
      .select(`
        id,
        unified_user_id,
        morning_advice,
        unified_users!inner(
          id,
          telegram_id,
          display_name,
          language_code,
          is_telegram_linked
        )
      `)
      .eq("date", today)
      .not("morning_advice", "is", null)
      .is("evening_insight", null);

    if (!todaysInsights || todaysInsights.length === 0) {
      jobLogger.info("No users for evening insight");
      return;
    }

    const proactiveService = getProactiveMessageService();
    let successCount = 0;
    let failedCount = 0;

    for (const insight of todaysInsights) {
      const user = insight.unified_users as any;

      if (!user.is_telegram_linked || !user.telegram_id) {
        continue;
      }

      try {
        // Generate evening insight linked to morning
        const eveningInsight = await generateEveningInsight(
          {
            userId: user.id,
            telegramId: user.telegram_id,
            displayName: user.display_name,
            languageCode: user.language_code,
          },
          insight.morning_advice
        );

        // Update database
        await supabase
          .from("daily_insights")
          .update({
            evening_insight: eveningInsight.text,
            evening_insight_short: eveningInsight.shortText,
            evening_sent_at: new Date().toISOString(),
            evening_tokens_used: eveningInsight.tokensUsed,
          })
          .eq("id", insight.id);

        // Send to Telegram
        const message = `🌙 Вечерний инсайт\n\n${eveningInsight.text}`;
        await proactiveService.sendEngagementMessage(
          {
            id: user.id,
            telegramId: user.telegram_id,
            displayName: user.display_name,
            languageCode: user.language_code,
            lastActiveAt: new Date(),
          },
          "evening-insight",
          message
        );

        successCount++;
        await sleep(200);
      } catch (error) {
        failedCount++;
        jobLogger.error({ error, userId: user.id }, "Failed to process user");
      }
    }

    jobLogger.info(
      { total: todaysInsights.length, success: successCount, failed: failedCount },
      "Evening insight processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Evening insight processing failed");
    throw error;
  }
}
```

### 3.6 API Endpoint

Файл: `symancy-backend/src/api/insights/today.ts`

```typescript
/**
 * GET /api/insights/today
 * Returns today's insight for the authenticated user
 */
export async function getTodayInsight(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const supabase = getSupabase();
  const userId = request.user?.sub; // From JWT middleware

  if (!userId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const today = new Date().toISOString().split("T")[0];
  const currentHour = new Date().getHours();

  const { data: insight } = await supabase
    .from("daily_insights")
    .select("morning_advice, morning_advice_short, evening_insight, evening_insight_short")
    .eq("unified_user_id", userId)
    .eq("date", today)
    .single();

  if (!insight) {
    // No insight generated yet - return empty
    return reply.send({
      hasInsight: false,
      type: null,
      content: null,
      shortContent: null,
    });
  }

  // After 20:00 - show evening insight if available
  if (currentHour >= 20 && insight.evening_insight) {
    return reply.send({
      hasInsight: true,
      type: "evening",
      content: insight.evening_insight,
      shortContent: insight.evening_insight_short,
    });
  }

  // Before 20:00 or no evening insight - show morning
  if (insight.morning_advice) {
    return reply.send({
      hasInsight: true,
      type: "morning",
      content: insight.morning_advice,
      shortContent: insight.morning_advice_short,
    });
  }

  return reply.send({
    hasInsight: false,
    type: null,
    content: null,
    shortContent: null,
  });
}
```

### 3.7 Frontend Updates

Файл: `src/components/features/home/DailyInsightCard.tsx`

```typescript
// Key changes:
// 1. Fetch from API instead of static pool
// 2. Remove "Learn more" button in WebApp mode
// 3. Keep static fallback for API failures

function DailyInsightCardComponent({
  t,
  language,
  dailyInsightCache,
  className,
}: DailyInsightCardProps) {
  const { isWebApp, hapticFeedback } = useTelegramWebApp();
  const [insight, setInsight] = useState<{
    content: string;
    type: "morning" | "evening" | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInsight() {
      try {
        const token = getStoredToken();
        if (!token) {
          throw new Error("No token");
        }

        const response = await fetch("/api/insights/today", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (data.hasInsight) {
          setInsight({
            content: data.content,
            type: data.type,
          });
        }
      } catch (error) {
        console.error("Failed to fetch insight:", error);
        // Fallback to static content
      } finally {
        setIsLoading(false);
      }
    }

    fetchInsight();
  }, []);

  // Use API content or fallback to static
  const displayContent = insight?.content || getInsightContent(language, "arina", dailyInsightCache);
  const teaserText = displayContent.length > 100
    ? displayContent.substring(0, 100) + "..."
    : displayContent;

  const titleKey = insight?.type === "evening"
    ? "home.eveningInsight"
    : "home.dailyInsight";

  return (
    <Card /* ... styles ... */>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {insight?.type === "evening" ? "🌙" : "☀️"}
            </span>
            <h3 className="text-base font-semibold text-white">
              {t(titleKey)}
            </h3>
          </div>

          {/* Insight text */}
          <p className="text-sm text-white/90 leading-relaxed">
            {teaserText}
          </p>

          {/* REMOVED: "Learn more" button in WebApp mode */}
          {/* Only show on web (non-WebApp) where it navigates to chat */}
          {!isWebApp && (
            <Button
              onClick={handleLearnMore}
              variant="secondary"
              size="sm"
              className="self-start bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {t("home.dailyInsight.learnMore")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 4. Миграция

### 4.1 План миграции

1. **Phase 1: Database** (День 1)
   - Создать таблицу `daily_insights`
   - Добавить RLS политики
   - Добавить индексы

2. **Phase 2: Backend** (День 1-2)
   - Создать `DailyInsightChain`
   - Создать промпты
   - Обновить scheduler и workers
   - Добавить API endpoint

3. **Phase 3: Frontend** (День 2)
   - Обновить `DailyInsightCard`
   - Добавить i18n ключи для evening insight
   - Убрать кнопку "Узнать больше" в WebApp

4. **Phase 4: Cleanup** (День 3)
   - Удалить `daily-fortune` из scheduler
   - Удалить `dailyInsightService.ts` (или пометить deprecated)
   - Удалить `daily-fortune.ts` trigger

### 4.2 Rollback план

- Если что-то пойдёт не так:
  1. Вернуть `daily-fortune` в scheduler
  2. Вернуть статичный пул во фронтенд
  3. Не удалять таблицу `daily_insights` (данные сохранятся)

---

## 5. Мониторинг и метрики

### 5.1 Ключевые метрики

- **Generation success rate**: % успешных генераций
- **Tokens used per insight**: Средний расход токенов
- **Delivery success rate**: % успешных доставок в Telegram
- **User engagement**: Отвечают ли на вечерний инсайт

### 5.2 Алерты

- Generation failure rate > 10%
- Average tokens > 1000 (cost alert)
- Delivery failure rate > 5%

---

## 6. Расчёт стоимости

### 6.1 Token usage

- Morning advice: ~300-500 input tokens + ~100-200 output = ~500-700 total
- Evening insight: ~400-600 input + ~100-200 output = ~600-800 total
- Total per user per day: ~1100-1500 tokens

### 6.2 Cost estimate (OpenRouter pricing)

При использовании модели типа Claude 3 Haiku ($0.25/1M input, $1.25/1M output):
- Per user per day: ~$0.0002-0.0003
- 1000 daily active users: ~$0.20-0.30/day
- Monthly (1000 DAU): ~$6-9

При Claude 3.5 Sonnet ($3/1M input, $15/1M output):
- Per user per day: ~$0.002-0.003
- 1000 daily active users: ~$2-3/day
- Monthly (1000 DAU): ~$60-90

**Рекомендация**: Использовать Haiku для инсайтов (достаточно для коротких текстов).

---

## 7. Открытые вопросы

1. **Timezone support**: Сейчас все в MSK. Нужна ли поддержка timezone пользователя?
   - Поле `timezone` уже есть в `unified_users`
   - Потребует batch processing по timezone groups

2. **Opt-out**: Как пользователю отписаться от инсайтов?
   - Добавить в `notification_settings`
   - Добавить UI в Profile

3. **Retry logic**: Что если генерация упала?
   - pg-boss retry mechanism (default 3 attempts)
   - Fallback к статичным сообщениям?

4. **A/B testing**: Тестировать разные промпты?
   - Можно добавить `prompt_version` в `daily_insights`

---

## 8. Связанные файлы

### Существующие (будут изменены)
- `symancy-backend/src/modules/engagement/scheduler.ts`
- `symancy-backend/src/modules/engagement/worker.ts`
- `symancy-backend/src/services/proactive/ProactiveMessageService.ts`
- `src/components/features/home/DailyInsightCard.tsx`
- `src/lib/i18n.ts`

### Новые
- `symancy-backend/src/chains/daily-insight.chain.ts`
- `symancy-backend/prompts/arina/morning-advice.txt`
- `symancy-backend/prompts/arina/evening-insight.txt`
- `symancy-backend/src/api/insights/today.ts`
- `supabase/migrations/20260104_create_daily_insights.sql`

### Для удаления (после миграции)
- `symancy-backend/src/modules/engagement/triggers/daily-fortune.ts`
- `src/services/dailyInsightService.ts` (или deprecate)

---

## 9. Чеклист для реализации

- [ ] Создать миграцию `daily_insights` table
- [ ] Создать `morning-advice.txt` prompt
- [ ] Создать `evening-insight.txt` prompt
- [ ] Создать `daily-insight.chain.ts`
- [ ] Обновить scheduler (morning + evening jobs)
- [ ] Обновить worker (new processors)
- [ ] Добавить `ProactiveMessageType` для новых типов
- [ ] Создать API `GET /api/insights/today`
- [ ] Обновить `DailyInsightCard.tsx`
- [ ] Добавить i18n ключи
- [ ] Убрать кнопку "Узнать больше" в WebApp
- [ ] Написать тесты для chain
- [ ] Написать тесты для worker
- [ ] Deploy и мониторинг
- [ ] Cleanup deprecated code
