# План: Исправление обрезания ответов Арины для темы "all"

## Проблема

Бот обрезает ответы Арины на гадании по кофейной гуще, когда пользователь выбирает тему "all" (все 6 сфер жизни). Текст обрывается на полуслове (например, "Тв" вместо "Твоя") в середине последних разделов.

### Пример обрезанного ответа
```
🌟 Духовное
Это сейчас твоя главная тема. Тот самый центр — это ты и твои мысли...
Тв [ОБРЫВ]
```

## Корневая причина

**Несоответствие между требованиями промпта и лимитом токенов:**

1. **Промпт Арины** (`prompts/arina/interpretation.txt` строка 127-128) требует:
   - Single topic: 1500-2500 символов
   - **All topics: 3000-4500 символов** (6 секций + введение + заключение)

2. **Модель Арины** (`src/core/langchain/models.ts` строка 101) настроена с:
   - **max_tokens=1200** (для всех тем одинаково)

3. **Токенизация кириллицы:**
   - 1200 токенов ≈ 1200-1600 символов на русском
   - Это **вдвое меньше**, чем требуемые 3000-4500 символов!

4. **Результат:**
   - Модель `xiaomi/mimo-v2-flash` начинает генерировать полный ответ
   - Достигает лимита 1200 токенов в середине текста
   - Обрезает ответ на полуслове

## Решение

**Просто увеличить max_tokens для Арины до 3000:**

- Это покроет все случаи: и single topic, и all topics
- Модель сама остановится, когда закончит генерацию (не обязательно использует все токены)
- Single topic: модель сгенерирует 1500-2500 символов и остановится (~1200-2000 токенов)
- All topics: модель получит достаточно токенов для полных 3000-4500 символов (~2500-3500 токенов)

## Критический файл

**`symancy-backend/src/core/langchain/models.ts`**
- Функция `createArinaModel` (строка 101)
- Изменить default для `arina_max_tokens` с 1200 на 3000

## Детальный план реализации

### Шаг 1: Модифицировать createArinaModel для поддержки dynamic maxTokens

**Файл:** `symancy-backend/src/core/langchain/models.ts`

**Изменение:**
```typescript
// BEFORE (строка 98-112):
export async function createArinaModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("arina_model", MODEL_ARINA);
  const temperature = await getConfig("arina_temperature", 0.9);
  const maxTokens = await getConfig("arina_max_tokens", 1200); // ФИКСИРОВАННОЕ ЗНАЧЕНИЕ
  const frequencyPenalty = await getConfig("arina_frequency_penalty", 0.6);
  const presencePenalty = await getConfig("arina_presence_penalty", 0.5);

  return createChatOpenAIInstance(modelName, {
    temperature,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
    ...options, // options перезаписывают defaults
  });
}

// AFTER:
export async function createArinaModel(options?: ModelOptions): Promise<ChatOpenAI> {
  const modelName = await getConfig("arina_model", MODEL_ARINA);
  const temperature = await getConfig("arina_temperature", 0.9);
  const defaultMaxTokens = await getConfig("arina_max_tokens", 1200);
  const frequencyPenalty = await getConfig("arina_frequency_penalty", 0.6);
  const presencePenalty = await getConfig("arina_presence_penalty", 0.5);

  return createChatOpenAIInstance(modelName, {
    temperature,
    frequencyPenalty,
    presencePenalty,
    maxTokens: defaultMaxTokens, // default, но options могут перезаписать
    ...options, // options.maxTokens перезапишет defaultMaxTokens
  });
}
```

**Комментарий:** Добавить в комментарии (строка 96), что maxTokens может быть переопределен через options:
```typescript
* - Max tokens (1200 default) for controlled length (can be overridden via options)
```

### Шаг 2: Добавить логику выбора maxTokens по topic в interpretation.chain.ts

**Файл:** `symancy-backend/src/chains/interpretation.chain.ts`

**Изменение в функции generateInterpretation (около строки 199):**

```typescript
// BEFORE (строка 190-211):
if (persona === "arina") {
  await loadArinaPrompts();

  if (!arinaSystemPrompt || !arinaInterpretationPrompt) {
    throw new Error("Failed to load Arina prompts");
  }

  systemPrompt = arinaSystemPrompt;
  interpretationPrompt = arinaInterpretationPrompt;
  model = await createArinaModel(); // БЕЗ dynamic maxTokens
} else {
  // Cassandra persona
  await loadCassandraPrompts();

  if (!cassandraSystemPrompt || !cassandraInterpretationPrompt) {
    throw new Error("Failed to load Cassandra prompts");
  }

  systemPrompt = cassandraSystemPrompt;
  interpretationPrompt = cassandraInterpretationPrompt;
  model = await createCassandraModel();
}

// AFTER:
if (persona === "arina") {
  await loadArinaPrompts();

  if (!arinaSystemPrompt || !arinaInterpretationPrompt) {
    throw new Error("Failed to load Arina prompts");
  }

  systemPrompt = arinaSystemPrompt;
  interpretationPrompt = arinaInterpretationPrompt;

  // Dynamic maxTokens based on topic
  // Single topic: 1200-1500 tokens (enough for 1500-2500 chars)
  // All topics: 2500-3000 tokens (enough for 3000-4500 chars)
  const maxTokens = topic === "all" ? 2500 : 1200;

  logger.debug({ topic, maxTokens }, "Creating Arina model with dynamic max_tokens");

  model = await createArinaModel({ maxTokens });
} else {
  // Cassandra persona
  await loadCassandraPrompts();

  if (!cassandraSystemPrompt || !cassandraInterpretationPrompt) {
    throw new Error("Failed to load Cassandra prompts");
  }

  systemPrompt = cassandraSystemPrompt;
  interpretationPrompt = cassandraInterpretationPrompt;
  model = await createCassandraModel();
}
```

**Добавить логирование:** На строке 219 добавить логирование выбранного maxTokens:
```typescript
logger.info({ lensId: lens.id, lensName: lens.name, topic, maxTokens }, "Selected interpretation lens");
```

### Шаг 3: Проверить передачу topic по всей цепочке

**Файлы для проверки:**

1. **`symancy-backend/src/modules/photo-analysis/worker.ts`**
   - Строка 360: `jobLogger.debug({ persona, topic }, "Generating interpretation");`
   - Убедиться, что topic правильно передается из jobData в вызов стратегии

2. **`symancy-backend/src/modules/photo-analysis/personas/arina.strategy.ts`**
   - Строка 116: `const { language = "ru", userName = "дорогой друг", topic = "all" } = options;`
   - Строка 124: `topic,` - передается в generateInterpretation
   - Всё уже корректно, изменений не требуется

### Шаг 4: Обновить константы (опционально)

**Файл:** `symancy-backend/src/config/constants.ts`

Добавить константы для maxTokens (если их нет):
```typescript
// Arina interpretation tokens
export const ARINA_MAX_TOKENS_SINGLE = 1200; // Single topic
export const ARINA_MAX_TOKENS_ALL = 2500;    // All topics
```

Использовать в interpretation.chain.ts вместо hardcoded значений:
```typescript
import { ARINA_MAX_TOKENS_SINGLE, ARINA_MAX_TOKENS_ALL } from "../config/constants.js";

const maxTokens = topic === "all" ? ARINA_MAX_TOKENS_ALL : ARINA_MAX_TOKENS_SINGLE;
```

## Верификация (Тестирование)

После внедрения изменений:

### 1. Локальное тестирование

```bash
# 1. Перейти в backend
cd symancy-backend

# 2. Проверить TypeScript
pnpm type-check

# 3. Собрать проект
pnpm build

# 4. Запустить бота локально (в dev режиме)
pnpm dev
```

### 2. Тестирование через Telegram

Отправить фото кофейной гущи боту и выбрать тему "all":

**Тестовый сценарий:**
1. Отправить фото кофейной чашки боту
2. Выбрать тему: **"Все сферы жизни"** (topic="all")
3. Дождаться ответа Арины
4. **Проверить:**
   - Ответ содержит ВСЕ 6 секций: ❤️ Любовь, 💼 Карьера, 💰 Финансы, 🏥 Здоровье, 👨‍👩‍👧 Семья, 🌟 Духовное
   - Последняя секция (🌟 Духовное) **полностью завершена** (нет обрыва на полуслове)
   - Есть заключительная рекомендация после всех секций
   - Длина текста: примерно 3000-4500 символов

**Тест single topic:**
1. Отправить фото кофейной чашки боту
2. Выбрать одну тему: **"❤️ Любовь"** (topic="love")
3. **Проверить:**
   - Ответ фокусируется только на любви
   - Длина текста: 1500-2500 символов
   - Ответ завершен корректно (нет обрыва)

### 3. Проверить логи

```bash
# Проверить логи бота на наличие записей о dynamic maxTokens
tail -f symancy-backend/logs/combined.log | grep "dynamic max_tokens"

# Должен быть лог:
# {"topic":"all","maxTokens":2500,"msg":"Creating Arina model with dynamic max_tokens"}
```

### 4. Проверка в базе данных

```sql
-- Проверить сохраненные анализы
SELECT
  id,
  created_at,
  interpretation_text,
  LENGTH(interpretation_text) as text_length,
  topic
FROM analysis_history
WHERE persona = 'arina'
  AND topic = 'all'
ORDER BY created_at DESC
LIMIT 5;

-- Длина текста для topic="all" должна быть 3000-4500 символов
```

## Потенциальные риски

1. **Увеличение стоимости токенов:**
   - До: 1200 токенов × $0.003/1K ≈ $0.0036 за запрос
   - После: 2500 токенов × $0.003/1K ≈ $0.0075 за запрос
   - **Увеличение на ~100%** для темы "all"
   - Но это нормально, т.к. "all" — это premium-функция (3 кредита для Cassandra, 1 для Arina)

2. **Возможное увеличение latency:**
   - Генерация 2500 токенов вместо 1200 займет больше времени
   - Оценка: +5-10 секунд для темы "all"
   - Это приемлемо, т.к. пользователь получает полный ответ

3. **Cassandra уже использует 1500 токенов:**
   - Проверить, не нужно ли увеличить и для Cassandra (если она тоже обрезается)

## Альтернативные решения (не рекомендуются)

### Вариант 1: Уменьшить требования промпта
- Изменить промпт, чтобы требовал 1500-2000 символов для "all"
- **Минусы:** Ухудшение качества ответов, пользователи получат меньше информации

### Вариант 2: Разбить ответ на несколько сообщений
- Генерировать каждую секцию отдельно
- **Минусы:** Сложность реализации, увеличение latency (6 запросов к LLM), увеличение стоимости в 6 раз

### Вариант 3: Использовать streaming
- Генерировать ответ с streaming и отправлять чанки
- **Минусы:** Сложность реализации, нужно переделать всю архитектуру воркера

## Заключение

**Рекомендуемое решение:** Динамически устанавливать maxTokens на основе topic:
- Single topic: 1200 токенов
- All topics: 2500 токенов

Это простое, эффективное решение, которое исправляет проблему без значительных изменений архитектуры.

**Затраты:**
- Время реализации: 30-60 минут
- Изменений в коде: ~20 строк
- Файлов затронуто: 2-3

**Результат:**
- Полные, завершенные ответы для темы "all"
- Улучшение UX
- Соответствие промпту
