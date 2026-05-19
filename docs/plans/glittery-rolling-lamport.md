# План: Релиз 22 мая 2026 — цены, welcome credits, сравнение чашек, COGS

## Статус (2026-05-19, после первой сессии)

**В мейне (commit `91dd4cd` на `origin/main`) и применено к prod Supabase:**
- ✅ T1.1 Централизация TARIFFS (`src/constants/tariffs.ts` + `supabase/functions/_shared/tariffs-config.ts`)
- ✅ T1.2 Новые цены 50/150/250/500 ₽ + миграция `20260519000001_extend_purchases_amount_check.sql` (применена)
- ✅ T1.3 Summer Sale UI (`SummerSaleBadge.tsx`, strikethrough, баннер, ru/en/zh)
- ✅ T1.4 Welcome credits 3 basic + 1 pro: RPC `grant_unified_initial_credits` (применена), `grantUnifiedInitialCredits()` в backend, `claimWelcomeCredits()` на вебе, intergation в обоих onboarding-флоу

**Осталось:**
- T2.1 Схема БД для сравнения чашек (`paired_analysis_id` UUID + extend `analysis_type` CHECK)
- T2.2 Промпты `ARINA_DYNAMICS_PROMPT` + `CASSANDRA_COMPATIBILITY_PROMPT`
- T2.3 Telegram-флоу `/compare_dynamics` (Advanced) и `/compare_compatibility` (Premium) с state machine через `user_states`
- T2.4 Cost report generator (`scripts/generate-cost-report.ts` → `docs/reports/costs/2026-05.md`)
- T3.1 `MultiImageUploader` для веба
- T3.2 Edge Function `compare-coffee`
- T3.3 Страница `/compare` (Tab Динамика / Совместимость с tier-gating)
- T4 Smoke-tests + advisors check + релиз 22.05

## Технические нюансы окружения (важно для следующей сессии)

- **Worktree**: `\\wsl.localhost\ubuntu\home\me\code\coffee\.claude\worktrees\kind-lumiere-b10b1b` (ветка `ADT/kind-lumiere-b10b1b`).
- **Worktree git-paths починены** на native WSL (`/home/me/...`). Не используй UNC-пути в `.git` файлах.
- **`pnpm` падает с panic через UNC**. Запускай только через WSL: `wsl.exe --cd "/home/me/code/coffee/.claude/worktrees/kind-lumiere-b10b1b" -- pnpm <cmd>`. Аналогично для backend: `.../symancy-backend`.
- **Git операции** в worktree — тоже через WSL (SSH работает только там, PowerShell без ключей).
- **Pushing**: пользователь подтвердил — прямой push в `origin/main`, dev-ветки нет. Не делать PR. CLAUDE.md в этом проекте говорит про dev, но это устарело.
- **Миграции на prod**: применять через `mcp__supabase__apply_migration` ДО `git push origin HEAD:main` (потому что есть GitHub Actions автодеплой на main).

## Решения, принятые в первой сессии

- Платёжная модель: гибрид (кредиты + подписки) сохраняем.
- Сравнение чашек: делаем Telegram + Web, приоритет Telegram.
- Welcome credits: только новым (идемпотентность через `free_credit_granted`).
- Cost report: markdown в `docs/reports/costs/`.

## Context

Заказчик (Jean, 18.05.2026) поставил дедлайн 22.05 и сформулировал пожелания одним сообщением. Сегодня 19.05.2026 — у нас ~3-4 дня. Решения после уточнений:

- **Платёжная модель**: гибрид (кредиты + подписки) сохраняем. Подписки не трогаем, акция применяется только к разовым покупкам кредитов.
- **Welcome credits**: меняем grant с 1 generic-кредита на **1 pro + 3 basic**. Только новые регистрации после релиза.
- **Акция "Summer Time" -50%**: новые цены **50 / 150 / 250 / 500 ₽**, в UI показываем старую цену зачёркнутой + бейдж "Summer Sale".
- **Cost report**: markdown-отчёт в `docs/reports/costs/`, генератор — отдельный скрипт.
- **Сравнение чашек**: делаем **обе платформы**. Приоритет Telegram (MVP едет в релиз 22.05 в любом случае). Web — стараемся успеть, иначе следующим релизом.

Сравнение чашек = две фичи:
- **Динамика** (Advanced): своя старая чашка + своя новая → что изменилось.
- **Совместимость** (Premium): чашка человека А + чашка человека Б → анализ совместимости.

---

## Состояние кода (из разведки)

### Цены — 5 точек дублирования
- `src/types/payment.ts:60-93` — основной TARIFFS на фронте
- `src/pages/Pricing.tsx:30-80` — дубль для лендинга
- `supabase/functions/create-payment/index.ts:24-53` — Edge Function (создание YooKassa-платежа)
- `supabase/functions/payment-webhook/index.ts:57-62` — webhook (грант кредитов после оплаты)
- `supabase/migrations/20251123000001_create_purchases_table.sql:7` — CHECK-констрейнт `amount_rub IN (100, 300, 500, 1000)`

### Welcome credits — централизованно
- Константа: `symancy-backend/src/modules/credits/service.ts:48-50` (`FREE_TIER.ONBOARDING_BONUS = 1`).
- Функция: `grantInitialCredits()` в `service.ts:375-472`, идемпотентна через флаг `free_credit_granted`.
- RPC: `grant_initial_credits` в Supabase.
- Триггер: `symancy-backend/src/modules/onboarding/handler.ts` после завершения онбординга.
- Web-версия в `user_credits` — таблица уже имеет раздельные колонки `basic_credits`, `pro_credits`, `cassandra_credits` (см. `supabase/migrations/20251123000002_create_user_credits_table.sql`).

### Cost tracking — почти готов
- `analysis_history`: `vision_model_used`, `vision_tokens_used`, `model_used`, `tokens_used`, `status`.
- Индекс `idx_analysis_history_costs_reporting` уже создан.
- Провайдер: OpenRouter. Модели: Grok 4.1-fast (vision), Qwen 3.5-Plus / GPT-OSS-120B (Arina), Kimi K2-thinking (Cassandra).

### Сравнение чашек — gaps
- В `analysis_history` нет ссылки на парный анализ. Нужна колонка `paired_analysis_id UUID NULL` + расширение `analysis_type IN ('basic','pro','cassandra','dynamics','compatibility')`.
- Промптов на сравнение нет — нужны 2: dynamics и compatibility (`supabase/functions/analyze-coffee/prompts.ts`).
- В боте `symancy-backend/src/modules/photo-analysis/handler.ts:28-100` нет state machine на два фото. Используем существующую таблицу `user_states` (поля `pending_compare_type`, `pending_first_analysis_id`).
- На вебе `src/components/features/analysis/ImageUploader.tsx:1-128` принимает только одно фото.
- Tier-gating: `consumeCreditsOfType` уже различает basic/pro/cassandra. Подписочные tier-ы — в `src/types/subscription.ts`. Логика проверки активной подписки уже есть.

---

## План реализации (по дням)

### День 1 (19.05 вечер → 20.05 утро) — Цены + Welcome

**1.1 Централизация TARIFFS** (~1.5ч)
- Создать `src/constants/tariffs.ts` — единый массив с полями `{ productType, price, originalPrice?, credits, kind }`.
- Создать `supabase/functions/_shared/tariffs-config.ts` (deno-совместимый параллельный файл; импорт между `src/` и `supabase/functions/` невозможен из-за разных runtime → дублируем структуру с тестом-сверкой).
- Переключить `src/types/payment.ts`, `src/pages/Pricing.tsx`, `create-payment`, `payment-webhook` на импорт из этих модулей. Удалить дубли.

**1.2 Новые цены 50/150/250/500₽** (~1ч)
- В TARIFFS: `price` = новая, `originalPrice` = старая, `promoTag = "summer-time"`.
- Миграция `supabase/migrations/2026051901_extend_purchases_amount_check.sql`: `CHECK (amount_rub IN (50, 100, 150, 250, 300, 500, 1000))` — старые суммы остаются валидными для исторических записей.
- В `payment-webhook` — грантить кредиты по `productType`, не по сумме (избегаем багов на скидке).

**1.3 UI "Summer Sale"** (~1ч)
- Компонент `src/components/features/payment/SummerSaleBadge.tsx`.
- В `src/components/features/payment/TariffCard.tsx` (`82-84`): зачёркнутая `originalPrice` + новая `price` крупнее + бейдж.
- Локали в `src/lib/i18n.ts` для ru/en/zh (`summerSale.badge`, `summerSale.discountText`).

**1.4 Welcome credits 1 pro + 3 basic** (~2ч)
- Миграция `supabase/migrations/2026051902_grant_initial_credits_v2.sql`: расширить RPC `grant_initial_credits(p_user_id, p_basic_credits, p_pro_credits, p_cassandra_credits)` — обратно-совместимо через default-параметры.
- Аналог для backend (`backend_user_credits`) — проверить структуру таблицы; если колонок по типам нет, добавить миграцию `ALTER TABLE backend_user_credits ADD COLUMN basic_credits INT, pro_credits INT, cassandra_credits INT` + бэкфилл.
- `symancy-backend/src/modules/credits/service.ts`: расширить `grantInitialCredits` принимать объект `{ basic: 3, pro: 1 }`. Константа `FREE_TIER` обновить.
- Триггер в `symancy-backend/src/modules/onboarding/handler.ts` — передать новые значения.
- Web: аналогичный grant в Supabase Edge Function на signup-trigger или в `src/pages/Onboarding/FreeCredit.tsx`.

### День 2 (20.05) — Сравнение чашек: фундамент + Telegram MVP

**2.1 Схема БД для сравнения** (~30мин)
- Миграция: `ALTER TABLE analysis_history ADD COLUMN paired_analysis_id UUID NULL REFERENCES analysis_history(id)`.
- Расширить allowed-список `analysis_type` (если есть CHECK): добавить `'dynamics'`, `'compatibility'`.

**2.2 Новые промпты** (~1.5ч)
- Файл `supabase/functions/analyze-coffee/comparison-prompts.ts`:
  - `ARINA_DYNAMICS_PROMPT` — берёт `vision_result_first` и `vision_result_second`, анализирует сдвиги в темах (love/career/health/etc), формат JSON с секциями `whatChanged`, `trends`, `recommendations`.
  - `CASSANDRA_COMPATIBILITY_PROMPT` — анализ совместимости двух людей, JSON с секциями `overallAffinity`, `byArea` (love/business/friendship), `risks`, `mysticInsight`.
- Унификация с существующими промптами по структуре JSON (`intro`, `sections`) для переиспользования рендеринга.

**2.3 Telegram-флоу сравнения** (~3-4ч)
- 2 команды:
  - `/compare_dynamics` — проверка `subscription_tier >= 'advanced'` ИЛИ наличия `pro_credits >= 1`.
  - `/compare_compatibility` — проверка `subscription_tier === 'premium'` ИЛИ `cassandra_credits >= 1`.
- State machine через `user_states`:
  - При `/compare_*` — записать `pending_compare_type`, ждать первое фото.
  - Первое фото → запустить обычный vision-анализ, сохранить запись с `analysis_type='dynamics_first'`/`compatibility_first` (временный статус), записать `pending_first_analysis_id`.
  - Второе фото → запустить vision, передать в worker оба `vision_result` + промпт сравнения → результат записать с `analysis_type='dynamics'`/`compatibility'`, `paired_analysis_id` указывает на первый.
- Worker: расширить `symancy-backend/src/modules/photo-analysis/worker.ts` — режим сравнения (если есть `pending_first_analysis_id`, пропустить новую интерпретацию и вызвать `comparison-prompts`).
- Списание кредитов: pro-кредит за dynamics, cassandra-кредит за compatibility. Refund при ошибке.

**2.4 Cost report генератор** (~2ч, можно параллельно)
- Скрипт `scripts/generate-cost-report.ts`:
  - Параметр `--from --to` (по умолчанию last 30 days).
  - Достаёт данные через Supabase service-role client.
  - Группировка по `analysis_type`: total count, avg tokens (vision+interpretation), avg cost USD (через прайс-таблицу OpenRouter в коде), avg cost RUB (через курс).
  - Отдельно: топ-3 самых дорогих анализа, error rate.
- Output: `docs/reports/costs/2026-05.md` с таблицами + выводы.
- Пайплайн запуска: ручной `pnpm tsx scripts/generate-cost-report.ts` + опционально GitHub Action по cron (на будущее).

### День 3 (21.05) — Web-версия сравнения

**3.1 Multi-upload UI** (~3ч)
- `src/components/features/analysis/MultiImageUploader.tsx` — drag&drop для 2 фото, превью обоих, кнопка "Сменить фото 1/2".
- Reuse существующего `ImageUploader.tsx` через композицию.

**3.2 Edge Function `compare-coffee`** (~3ч)
- Новая функция `supabase/functions/compare-coffee/index.ts` — принимает 2 base64-фото + `compareType` (`dynamics` | `compatibility`).
- Внутри: 2 vision-вызова + сравнительная интерпретация по соответствующему промпту.
- Возвращает структуру результата + записывает в `analysis_history` с `paired_analysis_id`.

**3.3 Страница сравнения** (~2ч)
- `src/pages/Compare/index.tsx` (или вкладка в существующей `/analysis`):
  - Tab "Динамика" (нужен Advanced) / "Совместимость" (нужен Premium) — disabled с CTA "Купить подписку" если tier недостаточен.
  - MultiImageUploader → кнопка "Анализировать" → progress → результат.
- Рендер результата — переиспользовать `AnalysisResponse` компонент или сделать минимальный новый `ComparisonResult`.
- Локали в `i18n.ts` (ru/en/zh).

### День 4 (22.05) — Тестирование, фиксы, релиз

- `pnpm type-check && pnpm build` — оба должны пройти зелёными.
- Smoke-test через Telegram-бота: 4 сценария (basic, pro, dynamics, compatibility).
- Smoke-test через веб: покупка по новой цене, welcome credits на новом аккаунте, multi-upload compare.
- Supabase advisors check: `mcp__supabase__get_advisors` после миграций.
- Сгенерировать первый cost-report в `docs/reports/costs/2026-05.md`, скинуть Jean'у.
- `/push patch` после каждой завершённой задачи (CLAUDE.md правила).
- Финальный мёрж в `dev` → деплой через GitHub Actions (`deploy.yml`).

---

## Файлы для модификации/создания

### Создаём
- `src/constants/tariffs.ts`
- `supabase/functions/_shared/tariffs-config.ts`
- `src/components/features/payment/SummerSaleBadge.tsx`
- `supabase/functions/analyze-coffee/comparison-prompts.ts`
- `supabase/functions/compare-coffee/index.ts`
- `src/components/features/analysis/MultiImageUploader.tsx`
- `src/pages/Compare/index.tsx`
- `scripts/generate-cost-report.ts`
- `docs/reports/costs/2026-05.md`
- Миграции: `2026051901_extend_purchases_amount_check.sql`, `2026051902_grant_initial_credits_v2.sql`, `2026052001_add_paired_analysis_id.sql`.

### Меняем
- `src/types/payment.ts` (60-93) — перевод на импорт из tariffs.ts
- `src/pages/Pricing.tsx` (30-80) — то же
- `supabase/functions/create-payment/index.ts` (24-53) — то же
- `supabase/functions/payment-webhook/index.ts` (57-62) — грант по productType
- `src/components/features/payment/TariffCard.tsx` (82-84) — strikethrough
- `symancy-backend/src/modules/credits/service.ts` (48-50, 375-472) — раздельные welcome credits
- `symancy-backend/src/modules/onboarding/handler.ts` — новые параметры
- `symancy-backend/src/modules/photo-analysis/handler.ts` (28-100) — обработка compare state
- `symancy-backend/src/modules/photo-analysis/topic-handler.ts` — добавить команды compare
- `symancy-backend/src/modules/photo-analysis/worker.ts` — режим сравнения
- `src/lib/i18n.ts` — новые ключи (summer sale, compare)

---

## Verification

1. **Цены**: открыть `/pricing` → видны новые цены, зачёркнутые старые, бейдж Summer Sale, локализация ru/en/zh. Купить через YooKassa тестовую карту → webhook грантит кредиты по новому productType.
2. **Welcome credits**: создать новый аккаунт (Telegram и web по очереди) → проверить `user_credits` / `backend_user_credits`: `basic_credits=3, pro_credits=1, cassandra_credits=0`. Повторный онбординг той же сессии — без дубль-гранта.
3. **Динамика (Telegram)**: `/compare_dynamics` → загрузить фото 1 → бот просит фото 2 → загрузить → получить JSON-ответ с whatChanged. Проверить запись в `analysis_history` с `paired_analysis_id`. Проверить списание `pro_credits`.
4. **Совместимость (Telegram)**: `/compare_compatibility` для Premium-пользователя → аналогично.
5. **Web compare**: `/compare` → выбрать тип → загрузить 2 фото → нажать «Анализировать» → результат отрисован. Гейтинг: free user видит CTA "Купить подписку".
6. **Cost report**: `pnpm tsx scripts/generate-cost-report.ts` → `docs/reports/costs/2026-05.md` создан, в нём таблица по analysis_type с usd/rub.
7. **Type-check + build**: `pnpm type-check && pnpm build` — зелёные.
8. **Supabase advisors**: вызов `mcp__supabase__get_advisors` → нет новых критичных warnings от наших миграций.

---

## Риски и допущения

- **Backend telegram-кредиты**: если `backend_user_credits` хранит всё в одной колонке `credits`, миграция-расширение увеличит scope ~1-2ч. Проверяем в момент работы над T1.4.
- **OpenRouter pricing**: цены моделей могут отличаться от заложенных в скрипт COGS. Подтянуть актуальные из OpenRouter API при первом запуске отчёта.
- **Web-сравнение к 22.05**: при риске несдачи — переносим день 3 на 24-26.05, релизим 22.05 без web-фичи (только Telegram). Договорённость с заказчиком: приоритет Telegram.
- **Промпт-инжиниринг сравнения**: качество JSON-output от моделей на сравнительных промптах — высокий риск, нужно 2-3 итерации тюнинга. Закладываем буфер в день 2.
- **Все коммиты — через PR в dev**, не пушим прямо в protected branches (правило CLAUDE.md).
