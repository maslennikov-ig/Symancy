# План финализации BETA-этапа Symancy

**Дата:** 25 мая 2026
**Дедлайн BETA по ТЗ:** 01 августа 2026 (≈10 недель)
**Дедлайн PRODUCTION по ТЗ:** 03 декабря 2026 (≈27 недель)

---

## 1. Контекст

Аудит соответствия ТЗ от 03.12.2025 показал:

- **ALPHA-этап (до 01.04.2026):** закрыт по факту, остались доделки (платежи в проде, smoke-тесты).
- **BETA-этап (до 01.08.2026):** в активной работе, часть фич уже сделана (сравнение чашек, дневник настроения, daily insights), часть отсутствует (геймификация, рефералы, шлюзы WA/WeChat, конфигуратор промптов).
- **PRODUCTION-этап:** инфраструктура есть (CI/CD, atomic deploy, Sentry в процессе), нагрузочных тестов и расширенной аналитики нет.

Зафиксированные с заказчиком отклонения от ТЗ (`docs/CLIENT_RESPONSE_STATUS.md` от 17.02.2026):
1. Подписки FREE/BASIC/ADVANCED/PREMIUM → кредитная модель (pay-per-use). **Требует подтверждения для финальной приёмки.**
2. Мониторинг Grafana/Prometheus → Sentry + Uptime + Telegram-алерты.
3. Telegram Stars — подключаем при появлении спроса (сейчас в процессе по запросу заказчика).

---

## 2. Открытые задачи в Beads — ревизия

| ID | Приоритет | Тип | Статус | Актуальность | Действие |
|---|---|---|---|---|---|
| **sym-sym-pc2** | P0 | epic | open | ✅ актуально | Привязать подзадачи через `bd dep add`; переименовать в "ALPHA: Запуск платежей в проде" |
| **sym-0xr** | P1 | chore | in_progress | ⏸ blocked | Ждём данные от заказчика по Stars |
| **sym-sym-d6d** | P1 | task | open | ⏸ blocked | Ждём данные от Ивана (Sentry DSN + provider token) |
| **sym-sym-4mr** | P1 | task | open | ✅ актуально | Делать после sym-sym-d6d |
| **sym-sym-9gy** | P1 | feature | open | ⚠️ scope сократить | Базовый initial-credits grant уже есть в [migration](../../supabase/migrations/20260519000002_grant_unified_initial_credits.sql). Осталось: уведомления + кнопка "купить" |
| **sym-sym-p4i** | P1 | epic | open | ✅ актуально | Переименовать в "BETA: Retention" |
| **sym-aj3** | P2 | chore | open | ✅ актуально | UNIQUE index на purchases.metadata→telegram_payment_charge_id |
| **sym-sym-0q2** | P2 | task | open | ⏸ отложено | GDPR/152-ФЗ — по решению заказчика отложено, перевести в P3 |
| **sym-sym-65l** | P2 | task | open | ✅ актуально | E2E через Playwright |
| **sym-sym-8kh** | P2 | chore | open | ⏸ blocked | Ждём бухгалтера |
| **sym-sym-9rk** | P2 | epic | open | ⏸ blocked | Ждём Astana Hub |
| **sym-sym-al7** | P2 | epic | open | ✅ актуально | Переименовать в "PRODUCTION: Compliance и QA" |
| **sym-sym-c5v** | P2 | epic | open | ✅ актуально | Переименовать в "BETA: Advanced функции" |
| **sym-sym-j5n** | P2 | task | open | ✅ актуально | Unit + integration тесты критических потоков |
| **sym-sym-mvb** | P2 | feature | open | ⚠️ scope сократить | Daily Insights уже работает ([symancy-backend/src/api/insights/today.ts](../../symancy-backend/src/api/insights/today.ts)). Осталось: суммаризация полного дня, push-нотификации |
| **sym-sym-ubw** | P2 | feature | open | ✅ актуально | Наполнение pgvector паттернами |
| **sym-sym-uw5** | P2 | feature | open | ✅ актуально | Similarity search + feedback loop |
| **sym-sym-1j1** | P3 | task | open | ✅ актуально | API Reference + Deployment Guide |
| **sym-sym-5cl** | P3 | feature | open | ✅ актуально | Расширенная админка |
| **sym-sym-n28** | P3 | epic | open | ✅ актуально | Переименовать в "PRODUCTION: Финализация" |
| **sym-z7o** | P3 | chore | open | ✅ актуально | Покрыть unlinked Telegram-юзеров в purchases |

---

## 3. Что отсутствует в Beads — обязательно создать

Эти пункты есть в **ТЗ BETA** или в **документе согласования функционала**, но в Beads их нет:

### Геймификация
- **Streak (трекер серии дней)** — P0 по документу согласования. По ТЗ BETA: критерий приёмки "В интерфейс интегрированы элементы геймификации (бейджи, streak)".
- **Бейджи / достижения** — P2 по документу согласования. По ТЗ BETA: критерий приёмки.

### Омниканальность
- **WhatsApp Business API gateway** — критерий приёмки BETA: "Готовы API-шлюзы и макеты интерфейсов для WhatsApp и WeChat". DeliveryService уже архитектурно поддерживает канал `whatsapp` ([symancy-backend/src/services/delivery/DeliveryService.ts](../../symancy-backend/src/services/delivery/DeliveryService.ts)), нужна реальная интеграция.
- **WeChat Mini Programs gateway** — критерий приёмки BETA.

### Админка (расширение)
- **Конфигуратор промптов** — критерий приёмки BETA: "Админ имеет возможность редактировать базу знаний и промпты". Таблица `prompts` уже есть ([20260119000001_create_prompts_table.sql](../../supabase/migrations/20260119000001_create_prompts_table.sql)), нет UI.
- **Промокоды** — управление в админке. Сейчас только захардкоженный летний сейл.
- **Управление статьями** — критерий приёмки BETA.

### Реферальная программа
- По документу согласования P1 ("можно добавить позже"). По ТЗ BETA: критерий приёмки включает "базовая реферальная программа".

### PRODUCTION-критерии
- **Нагрузочные тесты** (цель: 500+ анализов/час, p95 API < 3 сек).
- **Расширенная аналитика** (LTV, CAC, Retention, Churn в админ-панели).

---

## 4. Что закрыть как уже сделанное

Эти фичи **есть в коде**, но в Beads не отмечены как закрытые:

- **Сравнение чашек** ([src/pages/Compare.tsx](../../src/pages/Compare.tsx), [supabase/functions/compare-coffee/index.ts](../../supabase/functions/compare-coffee/index.ts)) — критерий BETA.
- **Дневник настроения** ([src/pages/Mood/](../../src/pages/Mood/)) — критерий BETA "Дневник настроения".
- **Daily Insights** ([symancy-backend/src/api/insights/today.ts](../../symancy-backend/src/api/insights/today.ts)) — частично закрывает "Ежедневный AI-анализ".
- **Бонусные кредиты при онбординге** ([migration 20260519000002](../../supabase/migrations/20260519000002_grant_unified_initial_credits.sql)) — частично закрывает Trial.

---

## 5. Структура эпиков (после реорганизации)

```
EPIC sym-sym-pc2   ALPHA: Запуск платежей в проде [P0]
 ├── sym-0xr      Stars: deploy edge function + smoke-тест    [P1, in_progress, blocked]
 ├── sym-sym-d6d  Прописать Sentry + TG provider token        [P1, blocked]
 ├── sym-sym-4mr  Тестирование платежей на проде              [P1]
 └── sym-aj3      Stars idempotency: UNIQUE expression index  [P2]

EPIC sym-sym-p4i   BETA: Retention и монетизация [P1]
 ├── sym-sym-9gy  Trial: уведомления + кнопка "купить"        [P1]
 ├── sym-tb3      Streak (трекер серии дней)                   [P0]
 ├── sym-fss      Бейджи / достижения                          [P2]
 └── sym-45x      Реферальная программа (базовая)              [P1]

EPIC sym-sym-c5v   BETA: Advanced функции [P2]
 ├── sym-sym-ubw  RAG: наполнение pgvector паттернами         [P2]
 ├── sym-sym-uw5  RAG: similarity search + feedback loop      [P2]
 ├── sym-sym-mvb  Ежедневная суммаризация полного дня         [P2] (scope сокращён)
 ├── sym-vim      Конфигуратор промптов в админке             [P1]
 ├── sym-829      Управление промокодами в админке            [P2]
 ├── sym-ar2      Управление статьями в админке               [P2]
 ├── sym-dhj      WhatsApp Business API gateway (адаптер)     [P2]
 └── sym-bit      WeChat Mini Programs gateway (адаптер)      [P2]

EPIC sym-sym-al7   PRODUCTION: Compliance и QA [P2]
 ├── sym-sym-65l  E2E через Playwright                        [P2]
 ├── sym-sym-j5n  Unit + integration тесты                    [P2]
 ├── sym-sym-0q2  GDPR / 152-ФЗ                                [P3, отложено]
 └── sym-z7f      Нагрузочные тесты (500/час, p95<3с)          [P2]

EPIC sym-sym-n28   PRODUCTION: Финализация [P3]
 ├── sym-sym-1j1  API Reference + Deployment Guide            [P3]
 ├── sym-sym-5cl  Расширенная админка (DAU/MAU/MRR/LTV)        [P2] (повысить приоритет)
 └── sym-z7o      Покрыть unlinked TG-юзеров в purchases       [P3]

EPIC sym-sym-9rk   DeepTech: CV Pipeline для Astana Hub [P2, blocked]
 └── Ждём ответов Astana Hub
```

---

## 6. Готовые `bd` команды

### Привязка существующих задач к эпикам

```bash
# ALPHA: Запуск платежей
bd dep add sym-0xr sym-sym-pc2 --type parent
bd dep add sym-sym-d6d sym-sym-pc2 --type parent
bd dep add sym-sym-4mr sym-sym-pc2 --type parent
bd dep add sym-aj3 sym-sym-pc2 --type parent

# BETA: Retention
bd dep add sym-sym-9gy sym-sym-p4i --type parent

# BETA: Advanced
bd dep add sym-sym-ubw sym-sym-c5v --type parent
bd dep add sym-sym-uw5 sym-sym-c5v --type parent
bd dep add sym-sym-mvb sym-sym-c5v --type parent

# PRODUCTION: Compliance
bd dep add sym-sym-65l sym-sym-al7 --type parent
bd dep add sym-sym-j5n sym-sym-al7 --type parent
bd dep add sym-sym-0q2 sym-sym-al7 --type parent

# PRODUCTION: Финализация
bd dep add sym-sym-1j1 sym-sym-n28 --type parent
bd dep add sym-sym-5cl sym-sym-n28 --type parent
bd dep add sym-z7o sym-sym-n28 --type parent

# Технический блокер для smoke-теста
bd dep add sym-0xr sym-sym-d6d --type blocks
bd dep add sym-sym-4mr sym-0xr --type blocks
```

### Корректировка приоритетов и описаний

```bash
# GDPR отложено
bd priority sym-sym-0q2 3
bd note sym-sym-0q2 "Отложено по согласованию с заказчиком (docs/CLIENT_RESPONSE_STATUS.md, 17.02.2026): с учётом планов по блокировке Telegram и недоступности из РФ, compliance отложен."

# Trial: scope сокращён
bd note sym-sym-9gy "Базовый grant_unified_initial_credits уже реализован в migration 20260519000002. Осталось: 1) уведомление при низком балансе; 2) кнопка/баннер 'купить кредиты'; 3) метрика trial→paid conversion."

# Daily Insights: scope сокращён
bd note sym-sym-mvb "Утренние/вечерние Daily Insights реализованы в symancy-backend/src/api/insights/today.ts. Осталось: 1) полная вечерняя суммаризация дня (200-300 слов); 2) push-уведомления; 3) персональные рекомендации на завтра."

# Расширенная админка важнее
bd priority sym-sym-5cl 2

# Stars + Sentry — пометить как blocked
bd label sym-0xr blocked-by-client
bd label sym-sym-d6d blocked-by-client
bd label sym-sym-8kh blocked-by-accountant
bd label sym-sym-9rk blocked-by-astana
```

### Новые задачи

```bash
# Геймификация
bd create -t feature --priority 0 --title "Streak: трекер серии дней использования" \
  --description "Реализация streak — ежедневный счётчик визитов. Сброс при пропуске дня. Визуализация в личном кабинете и Mini App. Push-уведомление при риске сброса. По документу согласования: P0. По ТЗ BETA: критерий приёмки. Файлы: symancy-backend/src/modules/gamification/, src/components/features/streak/, supabase migrations (user_streaks)."

bd create -t feature --priority 2 --title "Бейджи / достижения" \
  --description "Система achievements: 'Новичок дня' (1-е гадание), 'Знаток узоров' (10), 'Мастер самопознания' (100), 'Серия X дней', 'Исследователь' (все области фокуса). UI в профиле. По ТЗ BETA: критерий приёмки. Файлы: symancy-backend/src/modules/gamification/, src/components/features/achievements/."

bd create -t feature --priority 1 --title "Реферальная программа (базовая)" \
  --description "Пригласи друга → +1 анализ обоим. Лимит: 5 бонусов в месяц. Generate реферальные ссылки/коды. UI в профиле. По ТЗ BETA: критерий приёмки. Файлы: src/pages/Profile/, symancy-backend/src/modules/referrals/, supabase migrations (referral_codes, referral_uses)."

# Админка
bd create -t feature --priority 1 --title "Конфигуратор промптов в админке" \
  --description "UI для редактирования промптов в админ-панели. Таблица prompts уже существует (migration 20260119000001). Нужно: 1) Refine resource для CRUD; 2) live preview промпта; 3) версионирование (history). По ТЗ BETA: критерий приёмки 'Админ имеет возможность редактировать базу знаний и промпты'. Файлы: pages/admin/resources/PromptList.tsx, PromptEdit.tsx."

bd create -t feature --priority 2 --title "Управление промокодами в админке" \
  --description "CRUD для промокодов: создание, лимиты, статистика использования. Сейчас захардкожен только summer-sale в src/constants/tariffs.ts. Нужна таблица promo_codes + Refine resource + интеграция в payment flow. Файлы: supabase migrations, pages/admin/resources/PromoCodeList.tsx."

bd create -t feature --priority 2 --title "Управление статьями в админке" \
  --description "База статей: CRUD через админку (создание/редактирование/публикация). По ТЗ BETA: критерий приёмки. По документу согласования: P3, но обязательно для приёмки этапа. Файлы: supabase migrations (articles), pages/admin/resources/ArticleList.tsx, src/pages/Articles/."

# Омниканальность
bd create -t feature --priority 2 --title "WhatsApp Business API gateway (адаптер)" \
  --description "Реализация адаптера для DeliveryService. Webhook endpoint, отправка сообщений через Cloud API. По ТЗ BETA: критерий приёмки 'Готовы API-шлюзы и макеты интерфейсов для WhatsApp и WeChat'. Архитектура подготовлена в symancy-backend/src/services/delivery/. Файлы: symancy-backend/src/services/delivery/WhatsAppAdapter.ts, symancy-backend/src/routes/webhooks/whatsapp.ts."

bd create -t feature --priority 2 --title "WeChat Mini Programs gateway (адаптер)" \
  --description "Реализация адаптера для DeliveryService. WeChat Mini Program registration, OAuth2, отправка сообщений. По ТЗ BETA: критерий приёмки. Файлы: symancy-backend/src/services/delivery/WeChatAdapter.ts."

# PRODUCTION
bd create -t task --priority 2 --title "Нагрузочные тесты: 500+ анализов/час, p95 API < 3 сек" \
  --description "По ТЗ PRODUCTION критерий приёмки: 'Проведены нагрузочные тесты (обработка 500+ анализов в час, p95 времени ответа API < 3 сек)'. Использовать k6 / Artillery. Сценарии: 1) photo analysis pipeline; 2) credits операции; 3) Telegram webhook flood. Файлы: tests/load/."
```

### Закрыть как done

```bash
# Если есть таски на сравнение чашек / mood / daily insights — закрыть
# (Проверить через `bd search "сравнение"`, `bd search "mood"`, `bd search "daily insight"` и закрыть найденные)
bd close <id> --reason "Реализовано: см. docs/plans/beta-finalization-2026-05-25.md"
```

---

## 7. Дорожная карта (10 недель до сдачи BETA)

### Спринт 1: 25 мая — 7 июня (2 недели)
**Цель:** закрыть ALPHA-долг + быстрые BETA-фичи.

- [ ] sym-sym-d6d: Sentry DSN + provider token (после данных от Ивана)
- [ ] sym-0xr: Stars smoke-тест (после данных от заказчика)
- [ ] sym-sym-4mr: тест платежей на проде (полный чеклист)
- [ ] sym-aj3: UNIQUE index для Stars idempotency
- [ ] NEW: Streak (трекер серии дней) — P0
- [ ] NEW: Конфигуратор промптов в админке (UI на готовую таблицу)

### Спринт 2: 8 июня — 21 июня
**Цель:** монетизация и retention.

- [ ] sym-sym-9gy: Trial-уведомления + CTA "купить"
- [ ] NEW: Реферальная программа (базовая)
- [ ] NEW: Управление промокодами в админке
- [ ] sym-sym-mvb: Полная вечерняя суммаризация дня

### Спринт 3: 22 июня — 5 июля
**Цель:** RAG активирован, бейджи.

- [ ] sym-sym-ubw: наполнение pgvector паттернами (500+ символов)
- [ ] sym-sym-uw5: similarity search в pipeline + feedback loop
- [ ] NEW: Бейджи / достижения

### Спринт 4: 6 июля — 19 июля
**Цель:** омниканальность (адаптеры), статьи.

- [ ] NEW: WhatsApp adapter (webhook + send)
- [ ] NEW: WeChat adapter (минимальная заглушка)
- [ ] NEW: Управление статьями в админке

### Спринт 5: 20 июля — 1 августа
**Цель:** тестирование, расширенная админка, демо.

- [ ] sym-sym-j5n: unit + integration тесты
- [ ] sym-sym-65l: E2E Playwright (5 ключевых сценариев)
- [ ] sym-sym-5cl: DAU/MAU/MRR/LTV в админке
- [ ] Демо для заказчика → Акт BETA

### Резерв до PRODUCTION (август — декабрь)
- Нагрузочные тесты
- Документация
- GDPR (если решит заказчик)
- DeepTech CV (если ответит Astana Hub)
- sym-z7o: unlinked Telegram-юзеры

---

## 8. Блокирующие задачи (ждём заказчика / внешние ответы)

| Задача | Кого ждём | Что нужно | Где зафиксировано |
|---|---|---|---|
| sym-sym-d6d, sym-0xr | Заказчик | TELEGRAM_PAYMENT_PROVIDER_TOKEN, Sentry DSNs | `docs/IVAN-SETUP-TASKS.md` |
| **Финальная модель тарифов** | Заказчик | Подтверждение pay-per-use vs возврат к подпискам | Сообщение готовится отдельно |
| sym-sym-8kh | Бухгалтер | Система налогообложения и ставка НДС | `supabase/functions/create-payment/index.ts` |
| sym-sym-9rk | Astana Hub | 5 вопросов по DeepTech-критериям | `docs/plans/silly-tickling-music.md` |

---

## 9. Риски

1. **Подписки vs кредиты**: если заказчик попросит вернуть подписочную модель — это +2-3 недели работы (UI планов, recurring billing через YooKassa, миграция текущих покупок). Инфраструктура в БД готова, но UI и flow — нет.
2. **WhatsApp / WeChat**: WhatsApp Cloud API требует верификации бизнес-аккаунта (1-2 недели). WeChat — регистрация юрлица в Китае или через посредника, может потребовать 1-2 месяца.
3. **Stars в проде**: ждём от заказчика — может потребовать дополнительной верификации Bot в @BotFather.
4. **Нагрузочные тесты**: если p95 > 3 сек — потребуется оптимизация (Redis, query tuning), это до 1 недели.

---

## 10. Журнал применения

### 2026-05-25 — план применён в Beads (WSL native, bd 1.0.4)

Трекер работы: **sym-75t**.

**Поправка к разделу 6:** тип зависимости `--type parent` в bd 1.0.4 не существует — использован корректный `--type parent-child` (направление: `bd dep add <ребёнок> <эпик>`). Команды `bd note` / `bd priority` / `bd label add` совпали с CLI.

**Создано 9 задач (реальные ID):**

| План | Реальный ID | Задача | Эпик |
|---|---|---|---|
| sym-A1 | **sym-tb3** | Streak: трекер серии дней | sym-sym-p4i |
| sym-A2 | **sym-fss** | Бейджи / достижения | sym-sym-p4i |
| sym-A3 | **sym-45x** | Реферальная программа (базовая) | sym-sym-p4i |
| sym-B1 | **sym-vim** | Конфигуратор промптов в админке | sym-sym-c5v |
| sym-B2 | **sym-829** | Управление промокодами в админке | sym-sym-c5v |
| sym-B3 | **sym-ar2** | Управление статьями в админке | sym-sym-c5v |
| sym-B4 | **sym-dhj** | WhatsApp Business API gateway | sym-sym-c5v |
| sym-B5 | **sym-bit** | WeChat Mini Programs gateway | sym-sym-c5v |
| sym-C1 | **sym-z7f** | Нагрузочные тесты (500/час, p95<3с) | sym-sym-al7 |

**Связи:** 13 parent-child (привязка к эпикам) + 2 blocks (sym-0xr ← sym-sym-d6d, sym-sym-4mr ← sym-0xr). Циклов нет (`bd dep cycles`).

**Лейблы блокеров:** sym-0xr, sym-sym-d6d → `blocked-by-client`; sym-sym-8kh → `blocked-by-accountant`; sym-sym-9rk → `blocked-by-astana`.

**НЕ выполнено (нет в командах раздела 6):** переименование эпиков (`ALPHA: …`, `BETA: …`, `PRODUCTION: …`) — заголовки оставлены как «Этап N: …». При необходимости переименовать через `bd update <id> --title "…"`.
