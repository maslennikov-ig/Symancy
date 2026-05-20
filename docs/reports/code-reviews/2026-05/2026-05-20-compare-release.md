# Code Review: Compare Release (T2-T3)

**Date**: 2026-05-20
**Scope**: Commit `c2c5b09` — full two-cup comparison flow (Telegram + Web)
**Reviewer**: Code Reviewer Worker v2.0
**Files**: 29 files | **Changes**: +4409 / -352

---

## Summary

|              | Critical | High | Medium | Low |
| ------------ | -------- | ---- | ------ | --- |
| Issues       | 1        | 4    | 4      | 3   |
| Improvements | —        | 2    | 3      | 2   |

**Verdict**: NEEDS WORK — один P0 (DoS/data integrity), четыре P1 блокируют надёжность.

**Quality Gates**
- Type Check: PASS (tsc --noEmit --skipLibCheck)
- Build: PASS (vite build, ~8.7s)

---

## Issues

### Critical (P0)

#### 1. DoS через неограниченные base64-изображения в Edge Function

- **File**: `supabase/functions/compare-coffee/index.ts:380-396`
- **Problem**: Edge Function не валидирует размер `firstImage`/`secondImage` (base64-строки) до вызова Vision API. Злоумышленник может послать два изображения по 30 МБ каждое в base64 (~40 МБ строка) в одном запросе. Supabase Edge Functions лимитируют тело запроса примерно в 6 МБ по умолчанию — значит функция упадёт с 413 без refund-a (кредит уже не был списан, т.к. это происходит до consumeCredit). Однако если лимит выше (или изменится), это открывает возможность отправки огромных payload-ов напрямую в OpenRouter (наш операционный расход).

  Важнее: функция не проверяет OPENROUTER_API_KEY на null до первого обращения к API. Если env-переменная не выставлена, `Authorization: Bearer undefined` отправится в OpenRouter, получим 401, кредит к тому моменту уже может быть списан (consumeCredit идёт до Vision), и refund сработает — но логи будут вводить в заблуждение.

- **Impact**: Uncontrolled resource consumption; misleading error logs; denial of service if Supabase body limit is ever relaxed.
- **Fix**:
  ```typescript
  // После parse body, до consumeCredit:
  const MAX_BASE64_LEN = 10 * 1024 * 1024 * 1.37; // ~10 MB original → ~13.7 MB base64
  if (firstImage.length > MAX_BASE64_LEN || secondImage.length > MAX_BASE64_LEN) {
    return errorResponse("Image too large (max 10 MB)", "IMAGE_TOO_LARGE", 413);
  }

  // Startup check:
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set");
    // fail fast at module level or return 500 immediately
  }
  ```

---

### High (P1)

#### 2. Race condition: fallback credit path в Edge Function не атомарен (TOCTOU)

- **File**: `supabase/functions/compare-coffee/index.ts:255-285`
- **Problem**: Для web-only пользователей (без telegram_id) кредит списывается через read-then-write:
  1. `SELECT credits_pro FROM unified_user_credits WHERE unified_user_id = ?` → balance = 1
  2. Проверка `balance > 0` → true
  3. `UPDATE ... SET credits_pro = 0`

  Два одновременных запроса одного пользователя (двойной клик, медленный интернет + повтор) оба прочитают balance=1, оба пройдут проверку, оба напишут 0. Итог: два анализа за один кредит.

  Аналогичная race есть в `refundCreditForAuthUser` fallback (строки 308-326): fetch → increment — может потерять concurrent refund.

- **Impact**: Credit theft — один пользователь получает два comparison за один кредит.
- **Fix**: Заменить read-then-write на атомарный UPDATE с WHERE-guard, аналогично тому как работает `consume_unified_credit` RPC:
  ```sql
  -- В RPC или inline:
  UPDATE unified_user_credits
  SET credits_pro = credits_pro - 1
  WHERE unified_user_id = $1 AND credits_pro > 0
  RETURNING credits_pro;
  -- 0 строк = insufficient credits
  ```
  Либо добавить `refund_unified_credit` RPC, который тоже принимает `unified_user_id` (без telegram_id), и использовать его для fallback.

#### 3. pg-boss retry: повторное списание кредита при retryable ошибке

- **File**: `symancy-backend/src/modules/compare/worker.ts:305-315, 385-388`
- **Problem**: При сбое вставки в `analysis_history` (шаг 5) после успешного вызова LLM (шаг 4) worker выбрасывает исключение. Catch-блок делает refund. Затем pg-boss повторяет job (`retryLimit: 3`).

  На повторе шаг 3 (consume credit) снова списывает кредит (предыдущий уже был возвращён). Итого до 4 попыток списания и 4 попыток возврата. При параллельном сбое refund (transient network error) кредит теряется.

  Также: каждая попытка заново вызывает Vision API и LLM (шаги 2 и 4) — прямые денежные расходы на OpenRouter без пользы для пользователя.

- **Impact**: Потенциальная потеря кредита при нескольких одновременных сбоях (refund transient failure + retry). Лишние расходы на OpenRouter при каждом retry.
- **Fix**: Использовать `singletonKey` в pg-boss чтобы дедуплицировать job по `firstAnalysisId`. Более радикально — вынести consume credit за пределы retry-зоны (передавать кредитный токен в job data после однократного списания во handler.ts), либо применить идемпотентное хранение результата перед тем как throw:
  ```typescript
  // В sendComparePhotosJob:
  return boss.send(QUEUE_COMPARE_PHOTOS, validated, {
    retryLimit: 1,        // Уменьшить до 1; или
    singletonKey: data.firstAnalysisId,  // дедуплицировать
    ...
  });
  ```

#### 4. startCompareSession: .update() без проверки кол-ва затронутых строк

- **File**: `symancy-backend/src/modules/compare/handler.ts:275-287`
- **Problem**: Если для пользователя нет строки в `user_states` (например, из-за бага при onboarding или ручного удаления), `supabase.from("user_states").update({...}).eq(...)` вернёт `{ data: null, error: null }` — 0 строк обновлено, ошибки нет. Handler считает, что сессия создана, отправляет приветственное сообщение, но при следующем `loadCompareSession` вернётся null и фото упадёт в обычный flow.

  Supabase-js v2 не бросает ошибку при 0 обновлённых строк.

- **Impact**: Silent failure — пользователь думает, что compare-сессия запущена, но отправленное фото уйдёт в обычный анализ без предупреждения.
- **Fix**:
  ```typescript
  const { error, count } = await supabase
    .from("user_states")
    .update({ ... })
    .eq("telegram_user_id", telegramUserId);

  if (error || count === 0) {
    // Попробовать upsert или уведомить пользователя
    logger.error({ telegramUserId, count }, "compare: user_states row missing, upsert needed");
    await ctx.reply(getBotMessage("error.generic", language));
    return;
  }
  ```
  Либо: использовать `upsert()` с `onConflict: "telegram_user_id"`.

#### 5. Maintenance mode — hardcoded Russian string (нарушение i18n + ошибка роутинга)

- **File**: `symancy-backend/src/modules/compare/handler.ts:187`
- **Problem**: Внутри `handleComparePhoto` при включённом maintenance mode:
  ```typescript
  await ctx.reply("⚙️ Бот находится на обслуживании. Попробуйте позже.");
  ```
  Это hardcoded строка на русском (нарушение i18n). Кроме того, функция возвращает `true` (фото "consumed"), что означает — пользователь в compare-сессии не получит никакой информации о своей сессии; сессия продолжает тикать TTL, следующее фото тоже упрётся в maintenance.

- **Impact**: Английские и китайские пользователи получают ответ на русском. Compare-сессия "зависает" без возможности отменить (хотя `/cancel_compare` работает, т.к. он выполняется до проверки maintenance).
- **Fix**:
  ```typescript
  await ctx.reply(getBotMessage("error.maintenance", language));
  return true;
  ```
  Добавить ключ `error.maintenance` в `bot-messages.ts` для всех 3 локалей.

---

### Medium (P2)

#### 6. TTL expiry — пользователь не получает уведомление

- **File**: `symancy-backend/src/modules/compare/handler.ts:528-535`
- **Problem**: Когда `loadCompareSession` обнаруживает, что TTL истёк, вызывается `clearCompareState()` и возвращается `null` — без уведомления пользователя. Следующая фотография тихо попадёт в обычный flow. Ключ `compare.sessionExpired` определён в i18n но нигде не используется (dead i18n key).

- **Impact**: UX: пользователь через 30+ минут присылает второе фото и не понимает, почему получил обычный анализ вместо сравнения.
- **Fix**:
  ```typescript
  // В loadCompareSession после clearCompareState():
  const bot = getBot();
  try {
    await bot.api.sendMessage(telegramUserId, getBotMessage("compare.sessionExpired", lang));
  } catch { /* best-effort */ }
  return null;
  ```
  Нужен `chatId` (или использовать `telegramUserId` как `chatId` для приватных чатов).

#### 7. HEIC изображения: mime-тип не совпадает с данными

- **File**: `src/pages/Compare.tsx:77-82`
- **Problem**: `normaliseMime("image/heic")` возвращает `"image/jpeg"`. `fileToBase64()` считывает файл через `FileReader.readAsDataURL`, которая возвращает исходные HEIC-байты. Итог: на Edge Function уходит `mimeType=image/jpeg` но `data` — base64-encoded HEIC. Большинство vision API откажутся его обрабатывать (неверный MIME).

  `MultiImageUploader` принимает HEIC в `accept` attribute и в `validateFile`, что создаёт ложное ощущение поддержки формата.

- **Impact**: Пользователи с iPhone (дефолтный формат — HEIC) могут получить загадочный сбой от Vision API.
- **Fix (вариант A — отклонять HEIC в web)**: Убрать `"image/heic"` из `ALLOWED_MIME_TYPES` в `MultiImageUploader` и добавить пояснение в UI.
  **Fix (вариант B — конвертировать)**: Конвертировать HEIC → JPEG в браузере перед отправкой (библиотека `heic2any`).

#### 8. Orphaned `*_first` запись в `analysis_history` при сбое mainRow insert (Edge Function)

- **File**: `supabase/functions/compare-coffee/index.ts:458-504`
- **Problem**: Если `firstRow` вставлен успешно, но вставка `mainRow` падает (DB overload, constraint violation), функция рефандит кредит и возвращает 500. При этом в `analysis_history` остаётся строка с `analysis_type='dynamics_first'` без парной строки `dynamics`. `paired_analysis_id` нет в `mainRow`, но `firstRow` висит в базе.

  Нет FK в обратную сторону (нет CASCADE DELETE при отсутствии mainRow). Эти строки засоряют историю, могут появиться в `/history` пользователя как незаконченный анализ.

- **Impact**: Data quality — пустые «первые чашки» в истории пользователя.
- **Fix**: Обернуть оба insert в транзакцию через Supabase RPC, или при падении `mainRow` сделать soft-delete `firstRow` (update status='failed'). В текущем коде уже есть аналогичная обработка для Telegram flow (handler.ts:424-430) — распространить на Edge Function.

#### 9. Stale credits cache в Compare.tsx — UpgradeCard не показывается после исчерпания кредитов

- **File**: `src/pages/Compare.tsx:337-360`
- **Problem**: Кредиты загружаются один раз при монтировании (useEffect зависит от `isAuthenticated`). После успешного сравнения кредиты не перезагружаются. Если у пользователя был 1 кредит:
  1. hasPro = true → показывается CompareForm
  2. Пользователь делает comparison (кредит списан)
  3. Результат показан
  4. Пользователь нажимает "Сравнить другую пару" (handleReset)
  5. CompareForm снова показана (hasPro всё ещё = true, т.к. cache не обновился)
  6. Пользователь загружает фото, нажимает Compare → получает 402 от Edge Function → generic error

- **Impact**: UX degradation — пользователь видит форму вместо upgrade-карточки.
- **Fix**: В `CompareForm.handleImagesReady` при получении успешного результата вызвать колбэк к Compare-компоненту для перезагрузки кредитов. Либо обновлять credits в `onReset`:
  ```typescript
  const handleReset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setErrorMessage(null);
    setUploaderKey((k) => k + 1);
    onCompletedComparison?.(); // новый проп → Compare.tsx перечитает credits
  }, [...]);
  ```

---

### Low (P3)

#### 10. Dead i18n key `compare.sessionExpired` в bot-messages.ts

- **File**: `symancy-backend/src/services/i18n/bot-messages.ts` (все 3 локали)
- **Problem**: Ключ определён, но не используется нигде в коде (см. Issue 6). Либо надо использовать, либо удалить.

#### 11. ComparisonResult — нестабильный list key

- **File**: `src/components/features/analysis/ComparisonResult.tsx:109`
- **Problem**: `key={`${section.title}-${index}`}` — использование индекса в составном ключе не спасает при одинаковых заголовках секций (например, если LLM вернёт два раздела с `title: ""`). Лучше `key={index}` если порядок не меняется, или добавить UUID в структуру `ComparisonResultData`.
- **Fix**: Достаточно `key={index}` — секции не переупорядочиваются.

#### 12. Maintenance check вызывается внутри handleComparePhoto, не на уровне router

- **File**: `symancy-backend/src/modules/compare/handler.ts:185-190`
- **Problem**: Проверка `isMaintenanceMode()` инкапсулирована внутри `handleComparePhoto`, но не в командных обработчиках `startCompareSession`. Пользователь может начать сессию (/compare_dynamics), а первое фото получит отказ по maintenance. Непоследовательное поведение.
- **Fix**: Вынести maintenance check в router перед routing к compare handler, либо добавить во все точки входа.

---

## Improvements

### High

#### I-1. pg-boss: отсутствует `singletonKey` для compare-photos job

- **File**: `symancy-backend/src/core/queue.ts:166-176`
- **Current**: Один и тот же `firstAnalysisId` может породить несколько jobs (если второе фото было отправлено несколько раз до истечения TTL, или при crash-recovery). Каждый job будет независимо списывать кредит.
- **Recommended**:
  ```typescript
  return boss.send(QUEUE_COMPARE_PHOTOS, validated, {
    retryLimit: 1,
    retryDelay: 10,
    singletonKey: data.firstAnalysisId, // один job на одну первую чашку
    expireInSeconds: JOB_TIMEOUT_MS / 1000,
  });
  ```

#### I-2. Vision result shape: отсутствует общий тип между Edge Function и Backend

- **File**: `supabase/functions/compare-coffee/index.ts:74`, `symancy-backend/src/types/langchain.ts`
- **Current**: Edge Function хранит `vision_result: { description: string }`, backend хранит `vision_result: { symbols, colors, patterns, rawDescription, tokensUsed }`. Это разные схемы в одном JSONB-столбце `analysis_history.vision_result`. Нет типизации ни на уровне DB, ни на уровне кода, которая предотвратила бы смешение.
- **Recommended**: Добавить дискриминатор (`source: "web" | "telegram"`) в vision_result JSONB, либо создать отдельный type guard для web-flow результатов.

---

### Medium

#### I-3. Нет уведомления о рефанде в Telegram worker при недостатке кредитов

- **File**: `symancy-backend/src/modules/compare/worker.ts:232-244`
- **Current**: При недостатке кредитов (редкий кейс — кредит проверялся при старте сессии, но мог быть списан параллельным запросом) пользователь получает сообщение об ошибке, но не уведомляется, что кредит НЕ был списан.
- **Recommended**: Добавить в сообщение `compare.insufficientCreditsPro` уточнение, что кредит не списывался.

#### I-4. Compare.tsx не показывает pending state на уровне кнопки Compare

- **File**: `src/components/features/analysis/MultiImageUploader.tsx:355-370`
- **Current**: После нажатия "Сравнить" MultiImageUploader сразу скрывается (компонент сменяется на spinner в CompareForm), но сам `MultiImageUploader` не получает `disabled=true` сразу. Если пользователь кликает быстро дважды, `handleImagesReady` может вызваться дважды до того как status сменится на 'processing'.
- **Recommended**: Передавать `disabled={status === 'processing'}` в `MultiImageUploader`.

#### I-5. Промпты выводят секции с фиксированными русскими заголовками для всех языков

- **File**: `supabase/functions/analyze-coffee/comparison-prompts.ts:56-90`, `symancy-backend/src/chains/comparison-prompts.ts`
- **Current**: В JSON schema prompt для ARINA_DYNAMICS раздел `"title": "Что изменилось"` — русский заголовок зашит в schema даже для `language=en/zh`. Модель получает указание использовать эти заголовки буквально, что означает русские section titles в английском/китайском ответе.
- **Recommended**: Добавить локализованные заголовки в LANGUAGE_INSTRUCTIONS или сделать секции без фиксированных title-ов, полагаясь на модель для выбора заголовков в нужном языке.

---

### Low

#### I-6. callVision не ограничивает описание по длине

- **File**: `supabase/functions/compare-coffee/index.ts:109-122`
- **Current**: `description = data?.choices?.[0]?.message?.content ?? ""` — без trim/truncate. Если vision model вернёт 10 000 символов, всё это попадёт в userPayload для callComparison.
- **Recommended**: `description.slice(0, 3000)` или добавить `max_tokens` в vision вызов.

#### I-7. Worker не логирует `retryCount` при ошибке

- **File**: `symancy-backend/src/modules/compare/worker.ts:345`
- **Current**: `processComparePhotos` использует `registerWorker` (без metadata), поэтому `job.retryCount` недоступен.
- **Recommended**: Перейти на `registerWorkerWithMetadata` для compare-photos queue, чтобы логировать `{ retryCount, retryLimit }` — это упрощает диагностику флапающих jobs.

---

## Positive Patterns

1. **Ownership check в backend worker** (worker.ts:165-180): проверка `firstAnalysis.telegram_user_id !== telegramUserId` с SECURITY_EVENT-маркером в логе и алертом — хорошая практика.

2. **Параллельные vision-вызовы в Edge Function** (index.ts:434): `Promise.all([callVision(first), callVision(second)])` сокращает latency примерно вдвое по сравнению с sequential вызовами.

3. **Drag-counter pattern в MultiImageUploader** (MultiImageUploader.tsx:111-115): использование `useRef` счётчика для dragenter/dragleave корректно решает проблему ложных leave-событий от дочерних элементов — нестандартная но правильная техника.

4. **Промпты полностью синхронизированы** (diff показал только кавычки single→double и заголовок файла) — процесс dual-file поддержки работает.

---

## Escalation

Требуют внимания senior:

- **Issue 2 (P0/P1)**: Атомарность кредитных операций — нужно обсудить стратегию: отдельные RPC для fallback path vs оптимистичная блокировка vs добавить telegram_id как требование для web-пользователей.
- **Migration schema**: `analysis_history.paired_analysis_id` с `ON DELETE SET NULL` — это означает, что при удалении первой чашки FK обнулится, но mainRow останется с `NULL paired_analysis_id`. Консистентны ли бизнес-правила?
- **Web flow vision_result shape**: различие схем JSONB между web и Telegram flow требует решения на уровне data model (Issue I-2).

---

## Validation

- Type Check: **PASS** (`pnpm type-check` — 0 errors)
- Build: **PASS** (`pnpm build` — успешно, предупреждение о chunk > 500 kB не связано с compare)
