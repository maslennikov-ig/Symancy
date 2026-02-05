# DeepTech Strategy for Astana Hub + AFSA

## Status: Phase 2 — Waiting for AFSA Clarifications + Deep Research

### Key Updates (2026-02-05)
- ✅ Astana Hub questions answered (see Section 2.6)
- ⏳ AFSA follow-up questions pending (see Section 2.7)
- ⏳ Deep Research prompt prepared (see Section 8)

---

## 1. Current State Analysis

Symancy - AI-платформа для анализа кофейной гущи (тассеография).

**Текущий пайплайн:**
- Фото -> сжатие (Sharp/browser-image-compression) -> Gemini 1.5 Flash (vision API) -> LLM интерпретация (Арина/Кассандра) -> результат

**Проблема:** Нет собственных CV-алгоритмов. Система - промпт-обёртка над чужой vision API. Это не квалифицируется как DeepTech.

---

## 2. Questions for Astana Hub

Before planning implementation, need answers to:

### 2.1 Technical Criteria
> "Какие технические критерии используются для определения проекта как DeepTech? Достаточно ли наличия собственных алгоритмов обработки данных (computer vision, NLP), или необходимо именно обучение собственных ML-моделей?"

### 2.2 Technical Review Process
> "Проходит ли проект техническую экспертизу при вступлении? Если да — в каком формате: презентация, демонстрация продукта, ревью кода/архитектуры?"

### 2.3 AI Project Examples
> "Есть ли среди участников хаба проекты, использующие computer vision или AI для анализа изображений? Можете привести примеры, чтобы мы понимали планку?"

### 2.4 Technology vs Business
> "Что для вас важнее при оценке: глубина технологии (собственные алгоритмы, патенты, R&D) или бизнес-модель и трекшн?"

### 2.5 External API Usage
> "Есть ли ограничения по типу AI-проектов? Например, проекты, которые используют внешние API (OpenAI, Google) с собственной обработкой — подходят ли они?"

---

### 2.6 ✅ Answers Received (2026-02-05)

#### Astana Hub:
- **DeepTech критерии**: Использовать внешние API допустимо, НО нужен собственный значимый слой обработки (пре-процессинг, анализ). CV-модуль и дообучение под наши данные = основа для ИС и налоговых льгот.
- **Процесс оценки**: Оценивают R&D-составляющую. Нужно показать, что это наша разработка, а не интеграция.
- **AI Ethics**: Нет отдельных требований. Ключевое — соответствие приоритетному списку IT + 90% дохода от этой деятельности.

#### AFSA (критично!):
- **Надёжность**: Собственный CV-слой = аргумент для контроля над цепочкой. Без этого шансы на регистрацию низкие.
- **Model Bias**: Требуют минимизации предвзятости. Гибридная архитектура (CV + NLP) — инструмент для снижения риска.
- **Explainable AI (КРИТИЧНО)**: Категорически против "чёрного ящика". Нужно технически доказать, что каждый инсайт строится СТРОГО на том, что увидел CV-модуль, а не на выдумках LLM.
- **External API**: Можно использовать, но CV-модуль должен жёстко фильтровать данные и задавать точный контекст для LLM (Model Misuse prevention).

---

### 2.7 ⏳ Additional Questions for AFSA

> **Цель**: Уточнить требования к Explainable AI для корректного проектирования архитектуры.

#### 2.7.1 Формат доказательства объяснимости
> "В каком формате AFSA ожидает доказательство связи между визуальными данными и выводами AI? Это должен быть:
> - Технический аудит-лог (JSON/XML с трассировкой CV features → LLM input → LLM output)?
> - Визуальная демонстрация для регулятора (UI показывает: вот паттерн на фото → вот что CV увидел → вот что LLM сказал)?
> - Формальная документация (whitepaper с описанием методологии)?
> - Комбинация вышеперечисленного?"

#### 2.7.2 Стандарты Explainable AI
> "Ссылается ли AFSA на конкретные стандарты или фреймворки Explainable AI при оценке проектов?
> - EU AI Act (европейское регулирование)?
> - ISO/IEC 22989 (AI concepts and terminology)?
> - NIST AI Risk Management Framework?
> - Собственные требования/чеклист AFSA?
> - Иные стандарты?"

#### 2.7.3 Уровень детализации
> "Насколько детальной должна быть трассировка? Достаточно ли показать:
> - Высокоуровневую связь (CV обнаружил паттерн X → LLM интерпретировал как Y)?
> - Или нужна полная атрибуция (каждое слово/фраза в ответе LLM привязана к конкретному CV-признаку)?"

#### 2.7.4 Аудит и воспроизводимость
> "Требуется ли возможность воспроизвести результат анализа для аудита? То есть, должна ли система гарантировать, что одно и то же фото всегда даёт идентичный результат, или допускается вариативность в рамках одного смыслового поля?"

---

## 3. Recommended Approach: Custom CV Pipeline

### 3.1 Concept

Построить собственный Computer Vision Pipeline, который анализирует изображение кофейной гущи **ДО** отправки в LLM. Результат - структурированные данные, которые обогащают интерпретацию.

**Ключевая идея:** Система не просто "показывает картинку AI". Она ВИДИТ и ПОНИМАЕТ паттерны через собственные алгоритмы, а LLM используется для финальной интерпретации на естественном языке.

### 3.2 Pipeline Stages

```
Photo Input
    |
    v
[1. Preprocessing] -----> Нормализация, коррекция освещения
    |
    v
[2. Cup Segmentation] --> Находит чашку, отделяет от фона (собственный алгоритм)
    |
    v
[3. Zone Detection] ----> Алгоритмическое разделение на RIM/CENTER/BOTTOM
    |
    v
[4. Density Map] -------> Тепловая карта плотности осадка кофе
    |
    v
[5. Texture Analysis] --> Gabor-фильтры, LBP, контрастность, зернистость
    |
    v
[6. Flow Direction] ----> Анализ направления "течения" гущи
    |
    v
[7. Feature Vector] ----> JSON с числовыми характеристиками
    |
    v
[8. LLM + Features] ---> Gemini получает И изображение, И structured features
    |
    v
[9. Interpretation] ----> Более точная и воспроизводимая интерпретация
```

### 3.3 Technical Implementation Options

| Option | Technology | Pros | Cons |
|--------|-----------|------|------|
| A. Python microservice | OpenCV + FastAPI | Full CV power, GPU support | Separate deployment, latency |
| B. Node.js native | Sharp + custom algorithms | Same stack, simple deploy | Limited CV capabilities |
| C. WASM in browser | OpenCV.js | No server cost, fast | Complex, limited |

**Recommendation:** Option A (Python microservice) - strongest DeepTech argument + most capable.

### 3.4 What This Proves to Astana Hub

1. **Proprietary algorithms** - собственная сегментация, feature extraction
2. **Domain expertise** - уникальная обработка для кофейных паттернов
3. **R&D component** - исследование и разработка CV для нишевой задачи
4. **Demonstrable** - можно показать каждый этап визуально
5. **Improvement over API** - LLM с structured features точнее, чем просто "посмотри на картинку"

### 3.5 Presentation Pitch

> "Symancy разработала собственный computer vision pipeline для анализа визуальных паттернов кофейной гущи. Система использует алгоритмы сегментации, построения карт плотности, текстурного анализа и определения направления потока. Эти структурированные данные обогащают LLM-интерпретацию, обеспечивая точность и воспроизводимость результатов, недостижимую при использовании только API."

---

## 4. Alternative/Additional DeepTech Components

### 4.1 Fine-tuned Vision Model (Phase 2)
- Дообучить модель на датасете кофейных паттернов
- Требует: 1000+ размеченных изображений
- Timeline: 2-3 месяца после запуска CV Pipeline

### 4.2 Visual Embeddings + Similarity Search (Phase 2)
- Генерировать визуальные эмбеддинги для каждого анализа
- Хранить в Qdrant (уже есть инфраструктура)
- "Похожие чтения" - найти в базе похожие паттерны

### 4.3 Reproducibility Metrics (Phase 1-2)
- Доказать, что одно и то же фото дает стабильный результат
- A/B тестирование: с CV Pipeline vs без

---

## 5. Next Steps

- [ ] Get answers from Astana Hub (questions in section 2)
- [ ] Based on answers, finalize implementation plan
- [ ] Implement CV Pipeline (estimated: 1-2 weeks for MVP)
- [ ] Create demo visualization for presentation
- [ ] Prepare technical documentation for review

---

## 6. Files to Modify (Draft)

| File | Change |
|------|--------|
| `symancy-backend/src/utils/image-processor.ts` | Add CV pipeline stages |
| `symancy-backend/src/chains/vision.chain.ts` | Inject CV features into LLM prompt |
| NEW: `symancy-backend/src/cv/` | CV pipeline module |
| NEW: `symancy-backend/src/cv/segmentation.ts` | Cup segmentation |
| NEW: `symancy-backend/src/cv/density-map.ts` | Density analysis |
| NEW: `symancy-backend/src/cv/texture.ts` | Texture features |
| NEW: `symancy-backend/src/cv/zones.ts` | Zone detection |
| `supabase/functions/analyze-coffee/index.ts` | Integrate CV features |

*This list will be refined after AFSA answers.*

---

## 7. Explainable AI (XAI) Architecture Concept

### 7.1 Core Requirement
AFSA требует доказать, что каждый вывод LLM привязан к конкретным визуальным данным из CV-модуля. Система не должна быть "чёрным ящиком".

### 7.2 Proposed XAI Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPLAINABILITY LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1. CV Feature Extraction]                                      │
│       │                                                          │
│       ├─► density_map: { zones: [...], values: [...] }          │
│       ├─► texture_features: { contrast: 0.7, grain: 0.3, ... }  │
│       ├─► flow_direction: { angle: 45°, confidence: 0.85 }      │
│       └─► detected_patterns: ["spiral", "cluster", "line"]      │
│                                                                  │
│  [2. Structured Prompt Construction]                             │
│       │                                                          │
│       └─► "Based on CV analysis:                                 │
│            - High density in RIM zone (0.78)                     │
│            - Spiral pattern detected (confidence: 0.9)           │
│            - Flow direction: clockwise                           │
│            Interpret ONLY these findings..."                     │
│                                                                  │
│  [3. LLM Response with Attribution]                              │
│       │                                                          │
│       └─► Each interpretation statement tagged with              │
│            source CV feature ID                                  │
│                                                                  │
│  [4. Audit Log (JSON)]                                           │
│       │                                                          │
│       └─► { timestamp, image_hash, cv_features, prompt,          │
│            llm_response, attribution_map }                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Attribution Mechanism (Concept)

**Идея**: LLM получает структурированный prompt, где каждый CV-признак имеет ID. LLM обязан в ответе ссылаться на эти ID.

**Пример**:
```json
// CV Output
{
  "features": [
    { "id": "F1", "type": "density", "zone": "rim", "value": 0.78 },
    { "id": "F2", "type": "pattern", "name": "spiral", "confidence": 0.9 },
    { "id": "F3", "type": "flow", "direction": "clockwise", "strength": 0.6 }
  ]
}

// LLM Prompt (structured)
"Interpret the following CV-detected features. For each statement, cite the feature ID.
Features: [F1] High density in rim zone (0.78). [F2] Spiral pattern (0.9 confidence). [F3] Clockwise flow (0.6 strength)."

// LLM Response (with attribution)
"[F1→F2] The concentrated energy at the rim forming into a spiral suggests incoming opportunities that require attention. [F3] The clockwise flow indicates positive momentum in your current direction."
```

### 7.4 Verification Mechanism

1. **Parse LLM response** — извлечь все attribution tags
2. **Validate coverage** — каждый тег должен соответствовать реальному CV feature ID
3. **Reject hallucinations** — если LLM упоминает что-то без attribution, пометить как "ungrounded"
4. **Audit score** — % высказываний с valid attribution

---

## 8. Deep Research Prompt (English)

> **Для использования с Claude Deep Research или аналогичным инструментом.**
> Скопировать и вставить как есть.

```
# Deep Research Request: Explainable AI Architecture for Hybrid CV+LLM Systems

## Context

I'm building Symancy — an AI platform for coffee ground reading (tasseography). The system analyzes photos of coffee grounds to provide interpretive readings.

### Current Architecture
- User uploads photo of coffee cup with grounds
- Image preprocessing (Sharp/browser-image-compression)
- Gemini 1.5 Flash (vision API) analyzes the image
- LLM (custom personas) generates interpretive text
- Result displayed to user

### Problem
This architecture is essentially a "prompt wrapper" over external vision APIs. We're applying to:
1. **Astana Hub** (Kazakhstan tech hub) — requires DeepTech qualification with demonstrable R&D
2. **AFSA** (Astana Financial Services Authority) — requires Explainable AI compliance

AFSA specifically demands that we prove every LLM output is strictly grounded in visual data from CV analysis, not LLM hallucinations. They are "categorically against black boxes."

### Planned Solution
Build a custom Computer Vision pipeline that extracts structured features BEFORE sending to LLM:
- Cup segmentation
- Zone detection (rim/center/bottom)
- Density mapping
- Texture analysis (Gabor filters, LBP)
- Flow direction analysis
- Pattern detection

These features are passed to LLM as structured data, constraining its interpretation to CV-detected elements.

## Research Questions

### 1. XAI Patterns for Vision+LLM Systems
What are the established patterns for Explainable AI in hybrid systems that combine:
- Custom CV feature extraction
- LLM-based natural language generation

Specifically interested in:
- **Feature Attribution**: How to trace LLM output back to specific CV features
- **Attention Mapping**: Techniques for showing which image regions influenced which parts of the response
- **Structured Prompting**: Prompt engineering patterns that enforce grounded responses
- **Post-hoc Verification**: Methods to validate LLM didn't hallucinate beyond provided features

### 2. Regulatory Compliance Frameworks
What XAI frameworks and standards are relevant for regulatory compliance?
- EU AI Act requirements for transparency
- ISO/IEC 22989 (AI concepts and terminology)
- ISO/IEC 23894 (AI risk management)
- NIST AI Risk Management Framework
- Any financial services-specific AI guidelines (similar to AFSA context)

### 3. Technical Implementation
Best practices for implementing:
- **Audit logging** for CV→LLM pipelines (what to log, format, retention)
- **Reproducibility** guarantees (same image → same features → consistent interpretation)
- **Attribution tags** in LLM responses (forcing LLM to cite feature IDs)
- **Hallucination detection** for multimodal systems
- **Confidence scoring** for both CV features and LLM interpretations

### 4. Case Studies
Examples of production systems that achieved XAI compliance for:
- Medical imaging + LLM diagnosis explanation
- Financial document analysis + AI insights
- Any creative/interpretive AI with regulatory oversight

### 5. Architecture Patterns
Recommended architectures for:
- **Constrained generation**: LLM can ONLY reference provided features
- **Chain-of-thought with attribution**: Each reasoning step tied to specific input
- **Verification layer**: Automated check that output doesn't exceed input scope

## Desired Output Format

1. **Executive Summary** — Key findings in 3-5 bullet points
2. **XAI Patterns Catalog** — Table of patterns with pros/cons/complexity
3. **Regulatory Mapping** — Which standards apply, what they require
4. **Technical Recommendations** — Specific technologies, libraries, approaches
5. **Architecture Proposal** — High-level diagram for CV+LLM+XAI system
6. **Implementation Roadmap** — Phased approach with quick wins first
7. **Risk Assessment** — What could go wrong, how to mitigate

## Constraints

- Must work with external LLM APIs (Gemini, OpenAI) — not self-hosted models
- CV pipeline will be Python (OpenCV/FastAPI) or Node.js (Sharp + custom)
- Budget: startup-scale, not enterprise
- Timeline: MVP in 2-4 weeks, full compliance in 2-3 months
```

---

## 9. Next Steps (Updated)

### Immediate (before implementation)
- [ ] Send AFSA follow-up questions (Section 2.7)
- [ ] Run Deep Research (Section 8 prompt)
- [ ] Finalize XAI architecture based on research + AFSA answers

### Phase 1: CV Pipeline MVP
- [ ] Implement core CV feature extraction
- [ ] Structured prompt construction
- [ ] Basic audit logging

### Phase 2: XAI Compliance
- [ ] Attribution mechanism in LLM responses
- [ ] Verification layer
- [ ] Demo UI for regulators

### Phase 3: Documentation & Presentation
- [ ] Technical whitepaper for AFSA
- [ ] Demo for Astana Hub
- [ ] R&D documentation for IP claims
