# План: Замена модели и динамическая загрузка из OpenRouter

## Решения пользователя

- **API подход**: Edge Function (безопасно скрывает API ключ)
- **Фильтрация**: Все модели (полный список ~300+)

## Задачи

1. **Заменить `xiaomi/mimo-v2-flash:free` → `xiaomi/mimo-v2-flash`** во всех файлах кода
2. **Реализовать динамическую загрузку моделей** из OpenRouter API через Edge Function

---

## Задача 1: Замена модели

### Файлы для изменения

| Файл | Строка | Изменение |
|------|--------|-----------|
| `symancy-backend/src/config/constants.ts` | 277, 287 | `MODEL_ARINA`, `MODEL_CHAT` |
| `src/admin/pages/SystemConfigPage.tsx` | 379 | default value |
| `src/admin/components/config/PersonasSettings.tsx` | 52 | `PERSONA_MODELS[0]` |
| `src/admin/pages/CostsPage.tsx` | 110 | `MODEL_PRICES` |
| `symancy-backend/scripts/test-quality.ts` | 54 | test script |

**Документация** (не меняем - устареет сама):
- `docs/specs/INTERPRETATION-QUALITY-IMPROVEMENT.md`
- `docs/tests/E2E-TEST-PLAN.md`
- `supabase/migrations/...` (комментарии в SQL)

---

## Задача 2: Динамическая загрузка моделей из OpenRouter API

### OpenRouter Models API

```
GET https://openrouter.ai/api/v1/models
Authorization: Bearer $OPENROUTER_API_KEY
```

Возвращает массив моделей с полями: `id`, `name`, `pricing`, `context_length`, etc.

### Архитектура решения

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Admin Panel)                                     │
│  src/admin/hooks/useOpenRouterModels.ts                     │
│    - Вызывает Edge Function                                 │
│    - Кэширует результат (5 мин)                            │
│    - Fallback на захардкоженный список при ошибке          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Edge Function                                     │
│  supabase/functions/openrouter-models/index.ts              │
│    - Проксирует запрос к OpenRouter API                     │
│    - Скрывает API ключ от клиента                          │
│    - Фильтрует/сортирует модели                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenRouter API                                             │
│  https://openrouter.ai/api/v1/models                        │
└─────────────────────────────────────────────────────────────┘
```

### Файлы для создания/изменения

#### 1. Новая Edge Function: `supabase/functions/openrouter-models/index.ts`

```typescript
// Проксирует запрос к OpenRouter, фильтрует модели
// Возвращает: { id: string, name: string, pricing: {...} }[]
```

#### 2. Новый хук: `src/admin/hooks/useOpenRouterModels.ts`

```typescript
// React Query хук для загрузки моделей
// Кэширование, loading state, error handling
// Fallback на FALLBACK_MODELS при ошибке
```

#### 3. Изменить: `src/admin/components/config/PersonasSettings.tsx`

- Удалить `PERSONA_MODELS` константу
- Использовать `useOpenRouterModels()` хук
- Показывать loading state при загрузке
- Сортировать модели по провайдеру

#### 4. Изменить: `src/admin/pages/CostsPage.tsx`

- Удалить захардкоженный `MODEL_PRICES`
- Использовать цены из OpenRouter API (`pricing.prompt`, `pricing.completion`)

---

## Критические файлы

- `symancy-backend/src/config/constants.ts` - константы моделей
- `src/admin/components/config/PersonasSettings.tsx` - UI выбора моделей
- `src/admin/hooks/useOpenRouterModels.ts` - новый хук (создать)
- `supabase/functions/openrouter-models/index.ts` - новая Edge Function (создать)

---

## Верификация

1. **Замена модели**: `grep -r "mimo-v2-flash:free" --include="*.ts" --include="*.tsx"` должен вернуть пустой результат
2. **Edge Function**: `curl` запрос к функции возвращает список моделей
3. **Admin Panel**: Открыть System Config → Personas, убедиться что модели загружаются динамически
4. **Type-check**: `pnpm type-check` проходит без ошибок
5. **Build**: `pnpm build` проходит успешно
