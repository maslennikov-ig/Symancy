# План: Система подписок Symancy

## Контекст

Сейчас в проекте реализована **система разовых покупок** (pay-per-use) с 4 тарифами через YooKassa. Нужно добавить **параллельную систему подписок** (recurring payments), которая будет сосуществовать с разовыми покупками. Подписочные кредиты начисляются на **общий баланс** пользователя и накапливаются.

**Спецификация** (Часть 3 stakeholder-review):
- 4 тарифа: FREE (0₽), Искатель (299₽/мес), Проводник (799₽/мес), Кудесник (3333₽/мес)
- Автопродление через YooKassa (сохранение карты)
- Скидки за долгосрочную оплату: 3 мес (-15%), 6 мес (-25%), 12 мес (-50%)

---

## Фаза 1: База данных (3 миграции)

### 1.1 Таблица `subscriptions`

**Файл**: `supabase/migrations/20260311000001_create_subscriptions_table.sql`

Поля:
- `id`, `user_id` (FK auth.users)
- `tier` — `free | basic | advanced | premium`
- `status` — `pending | active | past_due | canceled | expired`
- `billing_period_months` — `1 | 3 | 6 | 12`
- `amount_rub`, `base_amount_rub`, `discount_percent`
- `yukassa_payment_method_id` — сохранённый метод оплаты для рекуррентных платежей
- `started_at`, `current_period_start`, `current_period_end`, `next_billing_date`
- `canceled_at`, `expires_at`
- `last_credits_granted_at`, `credits_granted_count`
- `grace_period_end`, `retry_count` (для обработки неудачных продлений)

Partial unique index: только одна активная подписка на пользователя.

### 1.2 Таблица `subscription_payments`

**Файл**: `supabase/migrations/20260311000002_create_subscription_payments_table.sql`

История платежей по подписке:
- `id`, `subscription_id` (FK), `user_id` (FK)
- `amount_rub`, `yukassa_payment_id`, `status`
- `period_start`, `period_end`, `is_initial` (первый платёж с save_payment_method)
- `basic_credits_granted`, `cassandra_credits_granted`, `credits_granted_at`
- `failure_reason`, `cancellation_reason`

### 1.3 Функция `grant_subscription_credits()`

**Файл**: `supabase/migrations/20260311000003_create_subscription_functions.sql`

Начисляет кредиты на **существующий** `user_credits` по тарифу:

| Тариф | basic_credits | cassandra_credits |
|-------|---------------|-------------------|
| free | 4 | 0 |
| basic | 21 | 0 |
| advanced | 68 | 0 |
| premium | 121 | 7 |

Расширение `payment_analytics.event` для подписочных событий.

---

## Фаза 2: Типы TypeScript

### 2.1 Новый файл `src/types/subscription.ts`

- `SubscriptionTier` = `'free' | 'basic' | 'advanced' | 'premium'`
- `SubscriptionStatus`, `BillingPeriod` (1/3/6/12)
- `SubscriptionTierConfig` — конфигурация каждого тарифа (цена, кредиты/мес, фичи)
- `SUBSCRIPTION_TIERS` — массив конфигов 4 тарифов
- `BILLING_DISCOUNTS` — `{1: 0, 3: 15, 6: 25, 12: 50}`
- `Subscription` interface для записи из БД
- `calculateSubscriptionPrice()` — расчёт цены с учётом скидки

### 2.2 Расширение `src/types/payment.ts`

Добавить `'subscription'` в `ProductType` (опционально, если нужно различать в analytics).

---

## Фаза 3: Edge Functions — Основные

### 3.1 NEW `supabase/functions/create-subscription/index.ts`

Обработка первого платежа подписки:
1. Принимает `{ tier, billing_period_months }` от авторизованного пользователя
2. Рассчитывает цену со скидкой
3. Создаёт запись в `subscriptions` (status=pending)
4. Создаёт запись в `subscription_payments` (is_initial=true)
5. Вызывает YooKassa API с **`save_payment_method: true`** и `confirmation.type: "embedded"`
6. Возвращает `confirmation_token` для виджета

**Ключевое отличие от create-payment**: `save_payment_method: true` + metadata с `payment_type: 'subscription_initial'`.

### 3.2 MODIFY `supabase/functions/payment-webhook/index.ts`

Расширяем webhook роутингом по `metadata.payment_type`:

```
if payment_type == 'subscription_initial' || 'subscription_renewal':
  → handleSubscriptionPaymentSucceeded()  // активация, сохранение payment_method_id, начисление кредитов
  → handleSubscriptionPaymentFailed()     // grace period или отмена
else:
  → существующая логика разовых платежей (без изменений)
```

При успешном платеже подписки:
- Обновляет `subscription_payments.status = 'succeeded'`
- Извлекает `payment_method.id` из ответа YooKassa (для будущих автосписаний)
- Обновляет `subscriptions`: status=active, даты периода, next_billing_date
- Вызывает `grant_subscription_credits()` для начисления кредитов
- Трекает analytics event

---

## Фаза 4: Edge Functions — Жизненный цикл

### 4.1 NEW `supabase/functions/cancel-subscription/index.ts`

- Ставит `status = 'canceled'`, `canceled_at = NOW()`, `expires_at = current_period_end`
- Подписка остаётся активной до конца оплаченного периода

### 4.2 NEW `supabase/functions/process-recurring-payments/index.ts`

Cron-функция (ежедневно):
1. Находит подписки с `next_billing_date <= NOW()` и `status = 'active'`
2. Для каждой создаёт платёж через YooKassa API с `payment_method_id` (без участия пользователя)
3. Результат приходит через webhook асинхронно
4. Обрабатывает grace period: для `past_due` подписок ретраит (до 3 раз за 3 дня)
5. При исчерпании ретраев: `status = 'expired'`

**Запуск**: `pg_cron` (если доступен) или GitHub Actions cron → вызов Edge Function.

---

## Фаза 5: Сервисный слой

### 5.1 NEW `src/services/subscriptionService.ts`

```typescript
createSubscription(tier, billingPeriod) → { confirmation_token, subscription_id }
getActiveSubscription() → Subscription | null
cancelSubscription(subscriptionId) → void
getSubscriptionPaymentHistory(subscriptionId) → SubscriptionPayment[]
```

Паттерн авторизации: Telegram JWT → Supabase session (как в paymentService.ts).

### 5.2 MODIFY `src/services/creditService.ts`

Добавить `hasProAccessViaSubscription()` — проверяет, разрешает ли тариф подписки PRO-анализы (tier >= advanced).

---

## Фаза 6: Frontend компоненты

### 6.1 NEW `src/components/features/subscription/SubscriptionSelector.tsx`

Модальное окно/страница выбора подписки:
- 4 карточки тарифов с ценами, кредитами, фичами
- Переключатель периода оплаты (1/3/6/12 мес) с бейджами скидок
- Индикатор текущего плана
- Кнопка "Подписаться" → PaymentWidget

### 6.2 NEW `src/components/features/subscription/SubscriptionTierCard.tsx`

Карточка тарифа (по паттерну TariffCard.tsx).

### 6.3 NEW `src/components/features/subscription/BillingPeriodSelector.tsx`

Переключатель периода оплаты.

### 6.4 NEW `src/components/features/subscription/SubscriptionManagement.tsx`

Управление подпиской в профиле:
- Текущий план, статус, дата следующего списания
- Кредиты в месяц
- Кнопки "Сменить план" и "Отменить подписку"
- История платежей

### 6.5 MODIFY `src/components/features/payment/CreditBalance.tsx`

Показывать бейдж текущей подписки рядом с балансом кредитов.

---

## Фаза 7: Интеграция, i18n, тестирование

### 7.1 Роуты

- Добавить `/profile/subscription` в `App.tsx`
- Добавить ссылку "Управление подпиской" в профиль

### 7.2 i18n

Добавить ключи переводов в `src/lib/i18n.ts` для ВСЕХ 3 локалей (ru, en, zh):
- `subscription.tier.{free|basic|advanced|premium}.name`
- `subscription.tier.*.feature.*`
- `subscription.billing.*`
- `subscription.status.*`
- `subscription.manage.*`
- `subscription.cancel.confirm.*`
- `subscription.selector.*`

### 7.3 Верификация

- `pnpm type-check` — без ошибок
- `pnpm build` — успешный билд
- Ручное тестирование с YooKassa тестовой средой
- Проверить, что существующие разовые покупки работают без изменений

---

## Ключевые архитектурные решения

1. **Общий баланс кредитов** — подписочные кредиты идут в ту же `user_credits` таблицу, что и разовые покупки. Накапливаются, не сгорают.

2. **PRO-доступ через тариф** — ADVANCED/PREMIUM тарифы не начисляют `pro_credits`, а разблокируют PRO-анализы на уровне приложения. Расход идёт из `basic_credits`.

3. **Один webhook** — subscription и one-time платежи обрабатываются одним webhook-ом, роутинг по `metadata.payment_type`.

4. **Partial unique index** — БД гарантирует максимум 1 активную подписку на пользователя.

5. **Grace period** — 3 дня и 3 попытки при неудачном продлении, затем отмена.

6. **Сосуществование моделей** — разовые покупки (basic/pack5/pro/cassandra) остаются доступны ВСЕМ пользователям, включая подписчиков. Подписчик может докупить любой пакет кредитов сверх подписки. Оба типа кредитов идут на общий баланс.

---

## Ключевые файлы для модификации

| Компонент | Файл | Действие |
|-----------|------|----------|
| Типы | `src/types/subscription.ts` | NEW |
| Типы | `src/types/payment.ts` | MODIFY (добавить subscription ProductType) |
| Edge Function | `supabase/functions/create-subscription/index.ts` | NEW |
| Edge Function | `supabase/functions/payment-webhook/index.ts` | MODIFY (subscription routing) |
| Edge Function | `supabase/functions/cancel-subscription/index.ts` | NEW |
| Edge Function | `supabase/functions/process-recurring-payments/index.ts` | NEW |
| Сервисы | `src/services/subscriptionService.ts` | NEW |
| Сервисы | `src/services/creditService.ts` | MODIFY |
| Компоненты | `src/components/features/subscription/*.tsx` | NEW (4 файла) |
| Компоненты | `src/components/features/payment/CreditBalance.tsx` | MODIFY |
| Страницы | `src/pages/Profile/Subscription.tsx` | NEW |
| Роуты | `src/App.tsx` | MODIFY |
| i18n | `src/lib/i18n.ts` | MODIFY |
| Миграции | `supabase/migrations/20260311000001-3_*.sql` | NEW (3 файла) |
| Документация | `docs/TARIFFS.md` | MODIFY (добавить раздел подписок) |
