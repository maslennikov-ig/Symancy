# План: Реферальная программа (базовая) — sym-45x

## Context

Эпик `sym-sym-p4i` (BETA: Retention и монетизация), дедлайн BETA 01.08.2026. Тикет `sym-45x`:
«Пригласи друга → +1 анализ обоим; лимит 5 бонусов/мес; реф-ссылки/коды; UI в профиле».

Сейчас реферальной логики **нет нигде** (проверено grep по миграциям, бэку, фронту). Нужен вирусный
loop для роста на BETA: пользователь делится реф-ссылкой, друг приходит → оба получают бонусный анализ.

**Согласованные дизайн-решения (брейншторм с владельцем):**
1. **Триггер бонуса** — при 1-м завершённом анализе реферала (activation gate, анти-фарм).
2. **Симметрия** — реферал получает +1 basic при регистрации (конец онбординга); реферер получает
   +1 basic, когда реферал активировался (первый анализ).
3. **Каналы (эта итерация)** — **только Telegram deep-link** `t.me/<bot>?start=ref_<code>`. Веб
   (`?ref=` + localStorage + Edge-атрибуция) — отдельным тикетом (создать `bd create`).
4. **Лимит** — реферер: максимум 5 наград за **скользящее окно 30 дней**.
5. Награда = **+1 basic** (`credits_basic`).
6. Анти-абьюз: запрет самореферала; реферал атрибутируется только ОДИН раз навсегда (uniq);
   реферал должен быть НОВЫМ юзером; идемпотентность через uniq-констрейнты + pending-статус.

### Ключевые факты архитектуры (верифицировано напрямую)

- **Две системы юзеров в боте:** middleware `loadProfile` (`router/middleware.ts`) создаёт legacy-строку
  `profiles` по `telegram_user_id`. `unified_users` создаётся **лениво** — в конце онбординга
  (`graphs/onboarding/nodes/complete.ts:45`, `findOrCreateByTelegramId`). На `/start` у нового юзера
  `unified_users` ещё нет. Кредиты живут в `unified_user_credits` по `unified_user_id`.
  → Реф-код **захватываем на `/start`**, **атрибутируем при создании unified_user** (конец онбординга).
- **`/start` сейчас payload НЕ парсит** (`router/index.ts:195`). grammY: `bot.command("start")` отдаёт
  deep-link payload в `ctx.match`.
- **Начисление кредитов сервером** — только через service-role-safe RPC (`admin_adjust_credits` падает
  под SERVICE_ROLE из-за `is_admin()`). Эталон: `grant_purchased_credits`
  (`supabase/migrations/20260526000002_grant_purchased_credits_rpc.sql`).
- ⚠️ **Реальный CHECK** `credit_transactions.transaction_type` =
  `['grant_initial','purchase','consume','refund','admin_adjustment']` — `'referral'` там НЕТ.
  Миграция должна **расширить CHECK** значением `'referral'`. НЕ переиспользовать `'purchase'`
  (сломает `trial_conversion_funnel`, считающую покупки по `transaction_type='purchase'`).
- Первый анализ завершается в `modules/photo-analysis/worker.ts` (~line 407, статус `completed`).
  Очередь pg-boss НЕ нужна — атрибуция/награда синхронны.

## Approach

### 1. Миграция БД (`supabase/migrations/<ts>_referral_program.sql`)

Идемпотентная (`IF NOT EXISTS`, `CREATE OR REPLACE`). Применить через supabase MCP `apply_migration` +
закоммитить файл.

**Таблицы:**
- `referral_codes`: `id uuid pk`, `unified_user_id uuid UNIQUE NOT NULL → unified_users(id)`,
  `code text UNIQUE NOT NULL`, `created_at timestamptz`. Один код на пользователя.
- `referral_uses`: `id uuid pk`, `referrer_unified_user_id uuid NOT NULL → unified_users(id)`,
  `referee_telegram_id bigint UNIQUE NOT NULL` (известен на `/start`, защищает от двойной атрибуции),
  `referee_unified_user_id uuid NULL → unified_users(id)` (заполняется при онбординге),
  `code text NOT NULL`, `status text CHECK in ('pending','referee_rewarded','rewarded')`,
  `referee_rewarded_at timestamptz NULL`, `referrer_rewarded_at timestamptz NULL`, `created_at`.
  RLS enabled; SELECT-политики по `current_unified_user_id()` (как у `unified_user_credits`).

**ALTER:** расширить CHECK `credit_transactions.transaction_type` → добавить `'referral'`
(drop + add constraint).

**RPC (все `SECURITY DEFINER`, `SET search_path='public'`, `REVOKE ALL` + `GRANT EXECUTE ... TO service_role`):**
- `get_or_create_referral_code(p_unified_user_id uuid) → text` — генерит уникальный короткий код
  (напр. 8 символов base32, retry при коллизии), идемпотентно возвращает существующий.
- `capture_referral(p_code text, p_referee_telegram_id bigint) → jsonb {ok, reason}` — валидирует код,
  резолвит реферера, проверяет НЕ самореферал (`referrer.telegram_id != p_referee_telegram_id`),
  проверяет что реферал новый (нет `unified_users` по этому telegram_id), вставляет `referral_uses`
  (`status='pending'`). Идемпотентно (uniq на `referee_telegram_id` → ON CONFLICT DO NOTHING).
- `attribute_referee_signup(p_referee_telegram_id bigint, p_referee_unified_user_id uuid) → jsonb` —
  обновляет pending-строку (`referee_unified_user_id`, `status='referee_rewarded'`,
  `referee_rewarded_at=now()`), начисляет **рефералу** +1 basic (UPDATE `unified_user_credits` +
  INSERT `credit_transactions` `type='referral'`, `reason='referral_signup'`). Идемпотентно
  (только если `referee_rewarded_at IS NULL`).
- `reward_referrer_on_activation(p_referee_telegram_id bigint) → jsonb` — ищет строку реферала со
  `status='referee_rewarded'` и `referrer_rewarded_at IS NULL`; проверяет лимит реферера
  (`count(*) referral_uses where referrer=X and referrer_rewarded_at > now()-interval '30 days' < 5`);
  начисляет **рефереру** +1 basic, ставит `status='rewarded'`, `referrer_rewarded_at=now()`,
  лог `type='referral'`, `reason='referral_activation'`. Идемпотентно. Если лимит превышен —
  `{ok:false, reason:'monthly_limit'}` (строка остаётся `referee_rewarded`, не теряем).
- `get_referral_stats(p_unified_user_id uuid) → jsonb {code, invited, activated, credits_earned, pending}`
  — для UI. Может быть `authenticated`-safe (guard `current_unified_user_id()`), вызывается с фронта.

### 2. Backend Node (`symancy-backend/src/modules/referrals/`)

- `service.ts` — тонкие обёртки над RPC: `getOrCreateCode(unifiedUserId)`, `captureReferral(code, refereeTgId)`,
  `attributeRefereeSignup(refereeTgId, refereeUnifiedUserId)`, `rewardReferrerOnActivation(refereeTgId)`,
  `getStats(unifiedUserId)`. Паттерн как `modules/credits/service.ts` (getSupabase + rpc + лог ошибок).
- `parse.ts` — `parseRefPayload(match: string): string | null` (вычленяет `<code>` из `ref_<code>`).

**Интеграции (точечные правки):**
- `modules/router/index.ts:195` (`/start`): прочитать `ctx.match`; если `ref_<code>` →
  `referralsService.captureReferral(code, ctx.from.id)` (fire-and-log, не блокирует онбординг).
- `graphs/onboarding/nodes/complete.ts` (после `findOrCreateByTelegramId`, ~line 60, после welcome credits):
  `referralsService.attributeRefereeSignup(telegramUserId, unifiedUserId)`.
- `modules/photo-analysis/worker.ts` (~line 407, после `status:'completed'`):
  `referralsService.rewardReferrerOnActivation(telegramUserId)` (идемпотентно, ошибки только логируем,
  не ломаем анализ). Опционально: отправить рефереру нудж «друг активировался, +1 анализ» (как
  паттерн engagement-триггеров — но для базовой версии достаточно тихого начисления + UI-статистики).

### 3. Backend API (`symancy-backend/src/api/referral/index.ts`)

По образцу `api/settings/index.ts` / `api/insights/index.ts` (Fastify-плагин, JWT, резолв
`unified_user_id` из токена). Зарегистрировать в `app.ts` рядом с прочими `api/*`.
- `GET /api/referral` → `{ code, link, stats }` (link = `https://t.me/<BOT_USERNAME>?start=ref_<code>`).
  `BOT_USERNAME`: взять из конфига; если нет — добавить env (см. `core/telegram.ts` `getMe()` как fallback,
  но предпочесть env-константу в `config/`).

### 4. Frontend (`src/pages/Profile/`)

По образцу `Credits.tsx` / `Subscription.tsx` (подстраница + строка-вход в `Profile.tsx`):
- `src/pages/Profile/Referral.tsx` — карточка: реф-код, кнопка «Поделиться/Скопировать ссылку»
  (`navigator.clipboard` + Telegram `shareURL` если в Mini App), статистика (приглашено / активировано /
  заработано кредитов). Данные — `GET /api/referral` (паттерн вызова бэка как в существующих Profile-страницах).
- Маршрут `/profile/referral` в роутере (где `Credits`/`Subscription`).
- Строка-вход в `Profile.tsx` (компонент `SettingsRow`-паттерн).
- Стили: CSS-переменные, обе темы (light/dark) — как в соседних секциях.

### 5. i18n (`src/lib/i18n.ts`)

Добавить ключи `referral.*` (title, code, copy, copied, share, invite.description, stats.invited,
stats.activated, stats.earned, stats.pending, howItWorks, bonus.description) во **все 3 локали** (ru/en/zh).

### 6. UI-референсы (перед версткой Referral.tsx)

Lazyweb (`lazyweb:lazyweb-quick-references`) по «referral / invite friend / rewards» — собрать паттерны
карточки реф-программы перед версткой.

## TDD / тесты

- **Unit** (`symancy-backend/tests/unit/`, vitest, мок supabase): `parseRefPayload`; `service.ts`-обёртки
  (success/ошибка RPC); логика интеграции в `/start` (self-ref, нет кода). RED → GREEN.
- **Integration** (`symancy-backend/tests/integration/`): прогон сценария атрибуции через моки RPC
  (capture → signup → activation → лимит 30д → идемпотентность повторного вызова).
- RPC-логику (SQL) проверить вручную через supabase MCP `execute_sql` на dev-данных (сценарии:
  самореферал отклонён; повтор capture не дублирует; лимит 5/30д; повторный reward не начисляет дважды).

## Контракты, которые НЕЛЬЗЯ нарушить

- `transaction_type='referral'` (не `'purchase'`) — иначе ломается `trial_conversion_funnel`.
- Начисление только через service-role RPC (не `admin_adjust_credits`).
- Не коммитить `pnpm-lock.yaml` если перегенерился (`git checkout -- pnpm-lock.yaml`).
- Beads: я единственный писатель (Dolt); не `git stash push -- .beads`.

## Verification (перед закрытием sym-45x)

1. **Локально:** `pnpm type-check` (root + symancy-backend), `pnpm build` (оба),
   `pnpm test:unit` И `pnpm test:integration` в `symancy-backend` (в прошлый раз деплой падал на integration).
2. **RPC вручную** через supabase MCP: 4 сценария анти-абьюза/лимита/идемпотентности (см. выше).
3. **Ревью:** `code-reviewer` по диффу.
4. **Деплой по гейту:**
   - Миграция — supabase MCP `apply_migration` + файл закоммичен в `supabase/migrations/`.
   - Backend+Frontend — PR в `main` (НЕ прямой push) → `deploy-backend.yml` + фронт тем же мёржем.
   - Edge — НЕ нужен в этой итерации (Telegram-only).
5. **Прод-проверка:** реальный прогон через бота — реф-ссылка из Profile → новый тест-аккаунт по
   `?start=ref_<code>` → онбординг (реферал +1 basic) → первый анализ (реферер +1 basic, лимит соблюдён).
   Profile показывает корректную статистику в ru/en/zh, обе темы.
6. **Закрыть `sym-45x` ТОЛЬКО после прод-верификации.** Создать отдельный `bd` тикет на веб-канал
   атрибуции (`?ref=` + Edge).
