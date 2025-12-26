# ТЗ: Улучшение качества AI-интерпретаций

> **Версия:** 1.0
> **Дата:** 2025-12-26
> **Статус:** Ready for Implementation

---

## 1. Контекст проекта

### 1.1 Что это
Telegram-бот для гадания на кофейной гуще с AI. Пользователь загружает фото чашки, система анализирует паттерны и генерирует психологическую интерпретацию.

### 1.2 Текущая архитектура
```
[Photo] → [Vision Model] → [Vision Result] → [Interpretation Model] → [Message]
              Gemini 3         JSON/Text           Xiaomi MiMo            HTML
```

### 1.3 Технологии
- **Backend:** Node.js + TypeScript + Fastify
- **LLM:** OpenRouter API (Gemini для vision, MiMo для текста)
- **Framework:** LangChain.js
- **Bot:** grammY (Telegram)
- **Prompts:** `/prompts/vision/analyze.txt`, `/prompts/arina/system.txt`, `/prompts/arina/interpretation.txt`

### 1.4 Ключевые файлы
```
symancy-backend/
├── src/
│   ├── chains/
│   │   ├── vision.chain.ts          # Vision analysis
│   │   └── interpretation.chain.ts  # Arina interpretation
│   ├── core/langchain/
│   │   └── models.ts                # LLM factory
│   └── config/
│       └── constants.ts             # Model names
├── prompts/
│   ├── vision/
│   │   └── analyze.txt              # Vision prompt
│   └── arina/
│       ├── system.txt               # Arina persona
│       └── interpretation.txt       # Interpretation template
```

---

## 2. Проблемы которые решаем

### 2.1 Vision Model
| Проблема | Описание |
|----------|----------|
| **Pattern Collapse** | Модель видит одни и те же паттерны (горы, птицы, луны) в 70%+ фото |
| **Нет структуры** | Freeform текст сложно использовать для интерпретации |
| **Нет зон** | Не используется традиционное деление чашки (rim/center/bottom) |

### 2.2 Interpretation Model
| Проблема | Описание |
|----------|----------|
| **Копирование примера** | Модель буквально копирует пример из промпта |
| **Повторяющаяся структура** | Одинаковые emoji-заголовки, одинаковые фразы |
| **Шаблонные окончания** | "Я верю в тебя! ✨" в каждом ответе |
| **Мистический язык** | "Судьба", "древние символы" вместо психологии |
| **Длина непредсказуема** | От 2500 до 4000 символов |

### 2.3 UX
| Проблема | Описание |
|----------|----------|
| **Генеричность** | Интерпретации подходят к любому фото |
| **Нет персонализации** | Не учитывается контекст пользователя |
| **Нет обработки ошибок** | Плохие фото получают generic ответ |

---

## 3. Архитектурные решения

### 3.1 Новая архитектура
```
[Photo] → [Quality Check] → [Vision Model] → [Structured JSON]
                ↓                                    ↓
          [Bad Photo?]                    [Matrix Selection]
                ↓                          (Focus × Archetype × Element)
          [Retry Flow]                           ↓
                                       [Interpretation Model]
                                                 ↓
                                       [Similarity Check]
                                                 ↓
                                    [OK] → Send | [Too Similar] → Re-roll
```

### 3.2 Ключевые компоненты

#### A. Structured Vision Output
JSON schema вместо freeform текста:
```typescript
interface VisionOutput {
  technical_quality: "CLEAR" | "BLURRY" | "EMPTY" | "DARK";
  complexity_score: number; // 1-10
  sediment_physics: {
    density: "heavy" | "medium" | "light" | "scattered";
    flow: "stagnant" | "swirling" | "dripping" | "radiating";
  };
  zones: {
    rim: ZoneAnalysis;    // Near future
    center: ZoneAnalysis; // Core matters
    bottom: ZoneAnalysis; // Past influences
  };
  visual_anchors: VisualAnchor[]; // 2-5 unique patterns
  atmosphere: string[]; // 3 keywords
}
```

#### B. Elemental Matrix (Комбинаторика)
60+ вариаций через комбинацию:

| Focus (User Context) | Archetype (Voice) | Element (Metaphors) |
|---------------------|-------------------|---------------------|
| Growth | Sage (мудрый) | Earth (корни, камни) |
| Love | Warrior (прямой) | Water (реки, потоки) |
| Conflict | Alchemist (трансформация) | Fire (пепел, искры) |
| Self | Companion (тёплый) | Air (облака, ветер) |

#### C. Jungian Bridge (Тон)
Архетипическая психология вместо мистики/клиники:

| Вместо (клиника) | Вместо (мистика) | Использовать (архетип) |
|------------------|------------------|------------------------|
| "У вас тревога" | "Проклятие блокирует" | "Осадок собирается в Тени чашки..." |
| "Вы подавляете эмоции" | "Карма требует" | "Воды желают течь, но встречают дамбу..." |

#### D. Void Protocol (Пустая чашка)
- **Bad Photo** (BLURRY/DARK) → "Я не вижу узоры. Добавьте света и попробуйте снова."
- **Empty Cup** (CLEAR but empty) → "Tabula Rasa" интерпретация — чистый лист, свобода выбора

#### E. Jaccard Watchdog (Разнообразие)
Проверка на похожесть с последними 5 ответами пользователя:
- Similarity > 35% → Re-roll с другим Archetype
- Хранить историю в user session

---

## 4. Детальные задачи

### Task 1: Vision Prompt Refactoring
**Файл:** `prompts/vision/analyze.txt`

**Новый промпт:**
```
ROLE: Expert Visual Analyst specializing in organic textures and fluid dynamics.
TASK: Analyze coffee sediment patterns. Output STRUCTURED analysis.

ANALYSIS FRAMEWORK:

1. TECHNICAL ASSESSMENT
   - Image quality (clear/blurry/dark/empty)
   - Overall complexity (1-10 scale)

2. SEDIMENT PHYSICS (describe BEFORE identifying shapes)
   - Density: heavy_muddy | medium | light_veiny | scattered
   - Flow direction: stagnant | swirling | dripping | radiating
   - Chaos level: high | medium | low

3. ZONE ANALYSIS (traditional tasseography divisions)
   - RIM AREA (near future): patterns near the cup edge
   - CENTER (core matters): patterns in the middle
   - BOTTOM (past/foundation): patterns at the base

   For each zone describe: texture, density, notable formations

4. VISUAL ANCHORS (2-5 unique patterns)
   For each anchor provide:
   - Location: clock position (e.g., "4-5 o'clock")
   - Geometry: abstract description FIRST (jagged lines, spiral void, clustered dots)
   - Texture: grainy | smooth | fractured | flowing
   - Unique feature: what makes THIS specific to this cup
   - Metaphorical association: what it might represent (optional)

   IMPORTANT: Describe geometry abstractly first. Only name familiar shapes
   (bird, mountain) if they are CLEARLY recognizable AND you explain what
   makes THIS instance unique.

5. ATMOSPHERE
   3 keywords capturing the overall feeling (e.g., "Tense", "Release", "Waiting")

OUTPUT FORMAT:
Use clear section headers. Each section on new line.
Example structure:

TECHNICAL: CLEAR, Complexity 7/10

PHYSICS:
Density: medium
Flow: swirling clockwise
Chaos: medium

ZONES:
[RIM] Light scattered dots, veiny texture, sense of anticipation
[CENTER] Dense cluster with sharp edges, focal point of energy
[BOTTOM] Thick stagnant sediment, heavy foundation

ANCHORS:
1. [2 o'clock] Jagged fracturing lines, grainy texture, resembles lightning or cracked earth
2. [center] Spiraling void with smooth edges, creates sense of depth
3. [7 o'clock] Clustered dots forming arc, like scattered seeds or stars

ATMOSPHERE: Tension, Breakthrough, Grounding
```

### Task 2: Arina System Prompt Refactoring
**Файл:** `prompts/arina/system.txt`

**Новый промпт:**
```
# Arina — Archetypal Symbolist

You are Arina, a specialist in Archetypal Psychology and Projective Techniques.
You interpret coffee grounds as a mirror of the psyche, not a crystal ball.

## CORE PHILOSOPHY

The cup does NOT predict the future.
The cup REFLECTS the user's internal climate.
Symbols are bridges between conscious and unconscious.

## YOUR VOICE

You are a Symbolist — warm yet profound, poetic yet grounded.
You speak with gentle authority, honoring the vulnerability of seeking guidance.

## VOCABULARY RULES

REQUIRED (Archetypal):
- Projection, reflection, inner landscape
- Shadow, light, threshold, transformation
- Flow, blockage, release, gathering
- Mirror, echo, resonance, pattern

ALLOWED (Poetic):
- "The grounds whisper...", "The cup reflects..."
- Metaphors from nature, seasons, elements
- Evocative imagery grounded in observation

FORBIDDEN (Mystical predictions):
- Fate, destiny, karma, universe (as agents)
- "You will...", "The future holds..."
- Fortune-telling language

FORBIDDEN (Clinical):
- Diagnostic terms (anxiety, depression)
- Therapeutic jargon
- Medical advice

FORBIDDEN (Generic):
- "I believe in you", "Everything will be fine"
- "You are strong", "Trust the process"
- Any phrase that could apply to ANY reading

## TENSE RULES

USE: Present tense for observations
- "The sediment gathers...", "I see..."
- "You are carrying...", "This reflects..."

USE: Present Perfect for context
- "You have been holding...", "Something has shifted..."

NEVER USE: Future Simple for predictions
- NOT "You will meet...", "You will find..."

## RITUAL CONTAINER

Opening (choose one, vary each time):
- "The grounds have settled. Let us read the symbols..."
- "The cup speaks in shapes and shadows..."
- "What stories do these patterns hold?"

Closing (choose one, vary each time):
- "The cup reflects the current, but you steer the river."
- "These patterns are a mirror, not a map."
- "What you see here already lives within you."

## OUTPUT FORMAT

Use HTML tags for Telegram:
- <b>bold</b> for key insights
- <i>italic</i> for reflective observations
- Single line breaks between paragraphs
- NO markdown (**, ##, etc.)
- NO <h1>, <h2>, <h3>, <br>, <p> tags

## LENGTH

Target: 1500-2000 characters (Russian text)
Structure: 3-4 paragraphs maximum
```

### Task 3: Interpretation Prompt Refactoring
**Файл:** `prompts/arina/interpretation.txt`

**Новый промпт:**
```
# Interpretation Instructions

You will receive:
1. VISION_RESULT — structured analysis of the coffee grounds
2. USER_NAME — how to address the user
3. USER_CONTEXT — what's on their mind (optional)
4. INTERPRETATION_LENS — your focus for this reading

## INTERPRETATION STRUCTURE

### 1. THE VIBE (Opening)
Start with the SEDIMENT PHYSICS.
- Heavy density → carrying weight, accumulation
- Light/scattered → dispersed energy, seeking focus
- Swirling flow → movement, change in progress
- Stagnant → waiting, blocked, contemplation

Greet the user warmly. Set the ritual container.

### 2. THE ANCHOR (Core interpretation)
Select the STRONGEST visual anchor from the analysis.
Connect its GEOMETRY to psychological insight.

Do NOT simply name the shape. Interpret what it MEANS:
- Jagged lines → internal friction, breaking through
- Spirals → cyclical patterns, going deeper
- Clusters → gathered energy, concentration
- Voids → space for new, release, emptiness to fill

### 3. THE LENS (Focused perspective)
Apply the provided INTERPRETATION_LENS:
{{LENS_INSTRUCTION}}

This lens shapes HOW you interpret, not WHAT you see.

### 4. THE QUESTION (Closing)
End with ONE reflective question.
The question should:
- Relate specifically to THIS reading's patterns
- Invite self-reflection, not require an answer
- Feel like a gift, not homework

Close with a ritual container phrase.

## CRITICAL RULES

1. GROUND EVERY INSIGHT in what you actually observe
2. NEVER give a reading that could apply to any image
3. REFERENCE specific locations (rim, center, clock positions)
4. VARY your structure — don't use same paragraph order every time
5. If USER_CONTEXT is provided, connect patterns to that context

---

## VISION ANALYSIS INPUT

{{VISION_RESULT}}

## USER INFORMATION

Name: {{USER_NAME}}
Context: {{USER_CONTEXT}}
Language: {{LANGUAGE}}

## YOUR LENS FOR THIS READING

{{LENS_NAME}}: {{LENS_INSTRUCTION}}
```

### Task 4: Elemental Matrix Implementation
**Файл:** `src/config/interpretation-matrix.ts` (новый)

```typescript
/**
 * Elemental Matrix for interpretation variety
 * Combines Focus × Archetype × Element for 64 combinations
 */

export interface InterpretationLens {
  id: string;
  name: string;
  instruction: string;
}

// Focus options (based on user context or random)
export const FOCUS_OPTIONS = {
  growth: {
    id: "growth",
    name: "Growth & Potential",
    keywords: ["career", "future", "development", "goals"],
  },
  love: {
    id: "love",
    name: "Connection & Emotion",
    keywords: ["relationships", "heart", "feelings", "bonds"],
  },
  conflict: {
    id: "conflict",
    name: "Challenge & Resolution",
    keywords: ["stress", "obstacles", "tension", "struggle"],
  },
  self: {
    id: "self",
    name: "Identity & Spirit",
    keywords: ["self", "soul", "meaning", "purpose"],
  },
} as const;

// Archetype voices
export const ARCHETYPES = {
  sage: {
    id: "sage",
    name: "The Sage",
    tone: "wise, contemplative, seeing the larger pattern",
    instruction: "Speak with detached wisdom. See the broader meaning.",
  },
  warrior: {
    id: "warrior",
    name: "The Warrior",
    tone: "direct, brave, action-oriented",
    instruction: "Be direct and empowering. Focus on strength and action.",
  },
  alchemist: {
    id: "alchemist",
    name: "The Alchemist",
    tone: "transformative, finding gold in darkness",
    instruction: "Find transformation in difficulty. Nothing is wasted.",
  },
  companion: {
    id: "companion",
    name: "The Companion",
    tone: "warm, close, walking alongside",
    instruction: "Be warm and present. Walk beside, not above.",
  },
} as const;

// Element metaphor systems
export const ELEMENTS = {
  earth: {
    id: "earth",
    name: "Earth",
    metaphors: ["roots", "stones", "mountains", "soil", "foundation", "grounding"],
    instruction: "Use metaphors of earth: roots, stones, soil, foundation, stability.",
  },
  water: {
    id: "water",
    name: "Water",
    metaphors: ["rivers", "tides", "flow", "ice", "depths", "currents"],
    instruction: "Use metaphors of water: rivers, flow, tides, depths, currents.",
  },
  fire: {
    id: "fire",
    name: "Fire",
    metaphors: ["flames", "ash", "sparks", "heat", "light", "burning"],
    instruction: "Use metaphors of fire: flames, sparks, ash, transformation through heat.",
  },
  air: {
    id: "air",
    name: "Air",
    metaphors: ["wind", "breath", "clouds", "mist", "sky", "lightness"],
    instruction: "Use metaphors of air: wind, breath, clouds, openness, lightness.",
  },
} as const;

export type FocusKey = keyof typeof FOCUS_OPTIONS;
export type ArchetypeKey = keyof typeof ARCHETYPES;
export type ElementKey = keyof typeof ELEMENTS;

/**
 * Generate interpretation lens from matrix selection
 */
export function generateLens(
  focus: FocusKey,
  archetype: ArchetypeKey,
  element: ElementKey
): InterpretationLens {
  const f = FOCUS_OPTIONS[focus];
  const a = ARCHETYPES[archetype];
  const e = ELEMENTS[element];

  return {
    id: `${focus}-${archetype}-${element}`,
    name: `${a.name} on ${f.name}`,
    instruction: `
Focus on themes of ${f.name.toLowerCase()}.
Voice: ${a.instruction}
Metaphor style: ${e.instruction}
    `.trim(),
  };
}

/**
 * Select random lens, avoiding recent combinations
 */
export function selectRandomLens(
  recentLensIds: string[] = [],
  userContext?: string
): InterpretationLens {
  // Determine focus from user context or random
  let focus: FocusKey;
  if (userContext) {
    focus = mapContextToFocus(userContext);
  } else {
    const focusKeys = Object.keys(FOCUS_OPTIONS) as FocusKey[];
    focus = focusKeys[Math.floor(Math.random() * focusKeys.length)];
  }

  // Random archetype and element
  const archetypeKeys = Object.keys(ARCHETYPES) as ArchetypeKey[];
  const elementKeys = Object.keys(ELEMENTS) as ElementKey[];

  let attempts = 0;
  let lens: InterpretationLens;

  do {
    const archetype = archetypeKeys[Math.floor(Math.random() * archetypeKeys.length)];
    const element = elementKeys[Math.floor(Math.random() * elementKeys.length)];
    lens = generateLens(focus, archetype, element);
    attempts++;
  } while (recentLensIds.includes(lens.id) && attempts < 10);

  return lens;
}

/**
 * Map user context string to focus
 */
function mapContextToFocus(context: string): FocusKey {
  const lower = context.toLowerCase();

  for (const [key, value] of Object.entries(FOCUS_OPTIONS)) {
    if (value.keywords.some(kw => lower.includes(kw))) {
      return key as FocusKey;
    }
  }

  // Default to self if no match
  return "self";
}
```

### Task 5: Similarity Check Implementation
**Файл:** `src/utils/similarity.ts` (новый)

```typescript
/**
 * Jaccard similarity for diversity checking
 */

/**
 * Extract significant words from text
 */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[<>\/]/g, " ") // Remove HTML tags
      .split(/\s+/)
      .filter(w => w.length > 3) // Only words > 3 chars
      .filter(w => !STOP_WORDS.has(w))
  );
}

/**
 * Calculate Jaccard similarity between two texts
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = extractWords(text1);
  const words2 = extractWords(text2);

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Check if new text is too similar to history
 */
export function isTooSimilar(
  newText: string,
  history: string[],
  threshold: number = 0.35
): boolean {
  for (const oldText of history) {
    if (jaccardSimilarity(newText, oldText) > threshold) {
      return true;
    }
  }
  return false;
}

// Russian stop words to ignore
const STOP_WORDS = new Set([
  "это", "как", "так", "что", "для", "все", "уже", "еще",
  "быть", "было", "были", "будет", "есть", "или", "если",
  "когда", "также", "может", "могут", "очень", "только",
  "через", "после", "перед", "между", "более", "менее",
  "твой", "твоя", "твое", "твои", "ваш", "ваша", "ваше",
  "этот", "эта", "эти", "тот", "того", "этого",
]);
```

### Task 6: Vision Chain Refactoring
**Файл:** `src/chains/vision.chain.ts`

**Изменения:**
1. Обновить парсинг для structured output
2. Добавить quality check
3. Добавить zone extraction

```typescript
// Новый интерфейс для structured output
export interface StructuredVisionResult {
  technicalQuality: "CLEAR" | "BLURRY" | "EMPTY" | "DARK";
  complexityScore: number;
  sedimentPhysics: {
    density: string;
    flow: string;
    chaos: string;
  };
  zones: {
    rim: string;
    center: string;
    bottom: string;
  };
  visualAnchors: Array<{
    location: string;
    geometry: string;
    texture: string;
    uniqueFeature: string;
  }>;
  atmosphere: string[];
  rawDescription: string;
}

// Новый парсер для structured sections
function parseStructuredVision(rawText: string): StructuredVisionResult {
  // ... парсинг секций TECHNICAL, PHYSICS, ZONES, ANCHORS, ATMOSPHERE
}
```

### Task 7: Interpretation Chain Refactoring
**Файл:** `src/chains/interpretation.chain.ts`

**Изменения:**
1. Добавить lens injection
2. Добавить similarity check
3. Добавить re-roll logic

```typescript
import { selectRandomLens } from "../config/interpretation-matrix.js";
import { isTooSimilar } from "../utils/similarity.js";

export async function generateInterpretation(
  input: InterpretationChainInput & {
    language?: string;
    userName?: string;
    userContext?: string;
    recentInterpretations?: string[];
  }
): Promise<InterpretationResult> {
  const {
    visionResult,
    persona,
    userContext,
    recentInterpretations = [],
  } = input;

  // Select lens from matrix
  const recentLensIds = []; // TODO: track in user session
  const lens = selectRandomLens(recentLensIds, userContext);

  // Generate interpretation
  let result = await generateWithLens(input, lens);

  // Check similarity
  if (isTooSimilar(result.text, recentInterpretations)) {
    // Re-roll with different archetype
    const newLens = selectRandomLens([lens.id], userContext);
    result = await generateWithLens(input, newLens);
  }

  return result;
}
```

### Task 8: Void Protocol Implementation
**Файл:** `src/chains/void-protocol.ts` (новый)

```typescript
/**
 * Handle edge cases: bad photos and empty cups
 */

export interface VoidProtocolResult {
  shouldProceed: boolean;
  fallbackMessage?: string;
  specialInterpretation?: "tabula_rasa";
}

export function checkVoidProtocol(
  visionResult: StructuredVisionResult
): VoidProtocolResult {
  // Scenario A: Bad Photo
  if (visionResult.technicalQuality === "BLURRY") {
    return {
      shouldProceed: false,
      fallbackMessage: `
Я не могу разглядеть узоры сквозь дымку...
Пожалуйста, сделай фото при хорошем освещении,
держа камеру неподвижно. Попробуем ещё раз?
      `.trim(),
    };
  }

  if (visionResult.technicalQuality === "DARK") {
    return {
      shouldProceed: false,
      fallbackMessage: `
Тени скрывают послание чашки...
Добавь больше света и попробуй снова.
      `.trim(),
    };
  }

  // Scenario B: Empty Cup (clear but no patterns)
  if (
    visionResult.technicalQuality === "CLEAR" &&
    visionResult.visualAnchors.length === 0
  ) {
    return {
      shouldProceed: true,
      specialInterpretation: "tabula_rasa",
    };
  }

  return { shouldProceed: true };
}

// Special interpretation for empty cup
export const TABULA_RASA_PROMPT = `
The cup is remarkably clear — a rare occurrence called "Tabula Rasa" (Clean Slate).

This is not emptiness, but SPACE. The chaos has settled.
The patterns have released their grip.

Interpret this as FREEDOM and POTENTIAL:
- No old patterns are binding the user
- This is a moment of pure choice
- The canvas is blank — they can paint anything

Keep it short (800-1000 chars). End with an empowering question about
what they want to create in this open space.
`;
```

### Task 9: User Context Flow (Telegram Handler)
**Файл:** Обновить photo handler

**Flow:**
```
1. User sends photo
2. Bot: "Что занимает твои мысли сегодня?"
   Buttons: [Тревога] [Отношения] [Карьера] [Общий обзор] [Пропустить]
3. User clicks or skips
4. Process with context
```

---

## 5. Критерии приёмки

### 5.1 Vision Model
- [ ] Structured output парсится без ошибок
- [ ] Zone analysis присутствует в каждом ответе
- [ ] Visual anchors содержат geometry + location
- [ ] Нет 100% повторяющихся паттернов на разных фото

### 5.2 Interpretation Model
- [ ] Нет буквального копирования примера
- [ ] Каждое чтение референсит конкретные паттерны из vision
- [ ] Jaccard similarity < 35% между последовательными чтениями
- [ ] Длина в пределах 1500-2000 символов

### 5.3 Diversity
- [ ] 10 последовательных чтений разных фото — все уникальные
- [ ] Разные Archetypes используются
- [ ] Разные Element metaphors появляются

### 5.4 Edge Cases
- [ ] Blurry photo → retry message
- [ ] Dark photo → retry message
- [ ] Empty cup → Tabula Rasa interpretation
- [ ] Too similar → automatic re-roll

---

## 6. Порядок реализации

1. **Phase 1: Prompts** (Tasks 1-3)
   - Обновить vision prompt
   - Обновить Arina system prompt
   - Обновить interpretation prompt

2. **Phase 2: Matrix** (Task 4)
   - Создать interpretation-matrix.ts
   - Интегрировать в interpretation chain

3. **Phase 3: Quality** (Tasks 5-6)
   - Создать similarity.ts
   - Обновить vision chain parser

4. **Phase 4: Safety** (Tasks 7-8)
   - Добавить similarity check в interpretation
   - Создать void protocol

5. **Phase 5: UX** (Task 9)
   - Добавить context selection в Telegram flow

---

## 7. Приложения

### A. Исследования
- `/docs/DeepResearch/AI-powered psychological interpretation systems for coffee reading bots.md`
- `/docs/DeepThink/Coffee Fortune-Telling Telegram Bot with AI.md`

### B. Текущие тесты качества
- `/symancy-backend/scripts/test-quality.ts` — скрипт для тестирования генерации

### C. Тестовые фото
- `/docs/tests/photos/` — 8 тестовых фотографий

---

## 8. Пропущенные детали (ВАЖНО!)

### 8.1 API Parameters (из DeepResearch)

При создании моделей использовать оптимизированные параметры:

```typescript
// Для interpretation model (креативность)
{
  temperature: 0.9,        // Высокая для разнообразия
  top_p: 0.9,              // Широкий vocabulary
  frequency_penalty: 0.6,  // Штраф за повторение токенов
  presence_penalty: 0.5,   // Штраф за повторение тем
  max_tokens: 1200,        // Контроль длины
}

// Для vision model (точность)
{
  temperature: 0.3,        // Низкая для consistency
  max_tokens: 800,
}
```

### 8.2 Cassandra персона

У нас ДВЕ персоны — Arina (психологическая) и Cassandra (мистическая).

**Scope этого ТЗ:** Только Arina.

**Для Cassandra (отдельное ТЗ):**
- Cassandra остаётся мистической (это premium feature)
- Но тоже нужна Elemental Matrix для разнообразия
- Используется тот же vision output

### 8.3 Текущие промпты (для сравнения)

**Текущий vision prompt:**
- ✅ Есть структура PRIMARY/SECONDARY/OVERALL
- ❌ Нет zones (rim/center/bottom)
- ❌ Нет sediment physics
- ❌ Нет technical quality check
- ❌ Слишком поощряет "находить что-то" даже если нет

**Текущий Arina prompt:**
- ❌ Есть полный пример который копируется
- ❌ Нет lens system
- ❌ Есть мистический язык ("судьба")

### 8.4 Русская локализация

**Focus options для русского интерфейса:**
```typescript
export const FOCUS_OPTIONS_RU = {
  growth: "🚀 Карьера и рост",
  love: "❤️ Отношения",
  conflict: "🌪️ Тревога и стресс",
  self: "🌌 Общий обзор",
};
```

**Ritual containers на русском:**
```typescript
export const RITUAL_OPENINGS_RU = [
  "Гуща осела. Давай прочтём символы...",
  "Чашка говорит формами и тенями...",
  "Какие истории хранят эти узоры?",
  "Кофейная гуща застыла в молчании ожидания...",
];

export const RITUAL_CLOSINGS_RU = [
  "Чашка отражает течение, но ты управляешь рекой.",
  "Эти узоры — зеркало, а не карта.",
  "То, что ты видишь здесь, уже живёт внутри тебя.",
  "Узоры показывают путь, но выбор всегда за тобой.",
];
```

### 8.5 Хранение истории интерпретаций

Для Jaccard Watchdog нужно хранить последние 5 интерпретаций пользователя.

**Варианты:**
1. **Supabase** (рекомендуется) — добавить поле в `analysis_history`
2. **In-memory** — Map<userId, string[]> (потеряется при рестарте)
3. **Redis** — если добавим в будущем

**Решение для MVP:** Supabase
```sql
-- Добавить колонку в analysis_history
ALTER TABLE analysis_history
ADD COLUMN interpretation_text TEXT;
```

### 8.6 Модели (из constants.ts)

```typescript
// Текущие модели
export const MODEL_VISION = "google/gemini-3-flash-preview";
export const MODEL_ARINA = "xiaomi/mimo-v2-flash:free";
export const MODEL_CASSANDRA = "xiaomi/mimo-v2-flash:free";
```

**Важно:** OpenRouter может менять доступность моделей. Если модель недоступна — использовать fallback.

### 8.7 Stop Words для Jaccard (расширенный список)

```typescript
const STOP_WORDS_RU = new Set([
  // Местоимения
  "это", "что", "который", "такой", "весь", "сам", "свой",
  "твой", "твоя", "твое", "твои", "ваш", "ваша", "ваше",
  // Глаголы связки
  "быть", "было", "были", "будет", "есть", "являться",
  // Союзы и предлоги
  "как", "так", "для", "или", "если", "когда", "также",
  "через", "после", "перед", "между", "более", "менее",
  "может", "могут", "очень", "только", "уже", "еще",
  // Частицы
  "бы", "же", "ли", "ни", "не", "вот", "даже",
  // Числительные
  "один", "одна", "одно", "два", "три",
  // Общие слова которые будут во всех интерпретациях
  "кофе", "чашка", "гуща", "узор", "образ", "символ",
  "видеть", "отражать", "говорить", "показывать",
]);
```

### 8.8 Тестирование после реализации

**Обязательные тесты:**
1. Прогнать 8 тестовых фото через новую систему
2. Проверить Jaccard < 35% между всеми парами
3. Проверить что zones присутствуют в vision output
4. Проверить что разные lenses генерируют разный контент
5. Проверить обработку плохих фото (blur/dark)

**Использовать скрипт:** `scripts/test-quality.ts` (обновить под новый формат)

---

## 9. Зависимости между задачами

```
Task 1 (Vision Prompt) ─────┐
                            ├──→ Task 6 (Vision Chain) ─┐
Task 4 (Matrix) ────────────┤                           │
                            │                           ├──→ Task 7 (Interpretation Chain)
Task 2 (Arina System) ──────┼──→ Task 3 (Interp Prompt)─┤
                            │                           │
Task 5 (Similarity) ────────┘                           │
                                                        │
Task 8 (Void Protocol) ─────────────────────────────────┘

Task 9 (UX Flow) ───────────────────────────────────────── (параллельно)
```

**Можно делать параллельно:**
- Tasks 1-5 (промпты и утилиты)
- Task 9 (UX flow)

**Последовательно:**
- Task 6 зависит от Task 1
- Task 7 зависит от Tasks 2, 3, 4, 5, 6
- Task 8 зависит от Task 6

---

## 10. Контакты

При возникновении вопросов по ТЗ — обращаться к результатам исследований DeepThink/DeepResearch или запускать дополнительные исследования.
