# План: Исправление сообщений об ошибках платежей

## Проблема

Тестер сообщил о неправильных сообщениях при отклонении платежей:

| Сценарий | Карта | Ожидаемое поведение | Фактическое сообщение |
|----------|-------|---------------------|----------------------|
| Карта просрочена | `2200 0000 0000 0038` | Сообщение о просрочке | "Похоже, ваша карта не работает" ✅ |
| Подозрение на мошенничество | `2200 0000 0000 0046` | Сообщение о безопасности | "Технический сбой" ❌ |
| Общий отказ банка | `2202 2022 1231 2379` | Сообщение об отказе банка | "Технический сбой" ❌ |

---

## Анализ

### Что выяснено:

1. **Виджет YooKassa** показывает свои захардкоженные сообщения — их нельзя кастомизировать
2. **Webhook не сохраняет `cancellation_reason`** из объекта `cancellation_details`
3. **Таблица `purchases`** не имеет колонки для причины отмены
4. **Страница `PaymentResult`** показывает одинаковое сообщение для всех отмен

### Структура YooKassa cancellation_details:
```json
{
  "cancellation_details": {
    "party": "yoo_money",
    "reason": "fraud_suspected"
  }
}
```

### Возможные значения `cancellation_reason`:
- `insufficient_funds` — недостаточно средств
- `card_expired` — карта просрочена
- `fraud_suspected` — подозрение на мошенничество
- `general_decline` — общий отказ банка
- `3d_secure_failed` — не пройдена 3D Secure
- `invalid_card_number` — неверный номер карты
- `invalid_csc` — неверный CVV/CVC

---

## Решение

Сохранять `cancellation_reason` в БД и показывать детальные сообщения на странице результата.

---

## План реализации

### Шаг 1: Миграция — добавить колонку `cancellation_reason`

**Файл**: `supabase/migrations/20260131000001_add_cancellation_reason.sql`

```sql
-- Добавить колонку для причины отмены платежа
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Индекс для аналитики
CREATE INDEX IF NOT EXISTS idx_purchases_cancellation_reason
ON purchases(cancellation_reason) WHERE cancellation_reason IS NOT NULL;

-- Комментарий
COMMENT ON COLUMN purchases.cancellation_reason IS 'Причина отмены платежа из YooKassa cancellation_details.reason';
```

### Шаг 2: Обновить webhook — сохранять cancellation_reason

**Файл**: `supabase/functions/payment-webhook/index.ts`

Изменения:
1. Добавить `cancellation_details` в интерфейс `YooKassaPayment`
2. В `handlePaymentCanceled` сохранять `cancellation_reason`

```typescript
// Добавить в интерфейс YooKassaPayment:
interface YooKassaPayment {
  // ... existing fields
  cancellation_details?: {
    party: string;
    reason: string;
  };
}

// В handlePaymentCanceled:
const cancellationReason = payment.cancellation_details?.reason || null;

await supabase
  .from('purchases')
  .update({
    status: 'canceled',
    yukassa_payment_id: yukassaPaymentId,
    cancellation_reason: cancellationReason,  // NEW
  })
  .eq('id', purchase_id);
```

### Шаг 3: Добавить i18n ключи для причин отмены

**Файл**: `src/lib/i18n.ts`

```typescript
// EN
'payment.cancel.insufficient_funds': 'Insufficient funds on your card',
'payment.cancel.card_expired': 'Your card has expired',
'payment.cancel.fraud_suspected': 'Payment declined for security reasons',
'payment.cancel.general_decline': 'Payment declined by your bank',
'payment.cancel.3d_secure_failed': '3D Secure verification failed',
'payment.cancel.invalid_card_number': 'Invalid card number',
'payment.cancel.invalid_csc': 'Invalid CVV/CVC code',
'payment.cancel.unknown': 'Payment was declined',

// RU
'payment.cancel.insufficient_funds': 'Недостаточно средств на карте',
'payment.cancel.card_expired': 'Срок действия карты истёк',
'payment.cancel.fraud_suspected': 'Платёж отклонён по соображениям безопасности',
'payment.cancel.general_decline': 'Платёж отклонён вашим банком',
'payment.cancel.3d_secure_failed': 'Не пройдена проверка 3D Secure',
'payment.cancel.invalid_card_number': 'Неверный номер карты',
'payment.cancel.invalid_csc': 'Неверный CVV/CVC код',
'payment.cancel.unknown': 'Платёж был отклонён',

// ZH (Chinese)
'payment.cancel.insufficient_funds': '卡上余额不足',
'payment.cancel.card_expired': '您的卡已过期',
'payment.cancel.fraud_suspected': '因安全原因拒绝付款',
'payment.cancel.general_decline': '您的银行拒绝了付款',
'payment.cancel.3d_secure_failed': '3D Secure 验证失败',
'payment.cancel.invalid_card_number': '卡号无效',
'payment.cancel.invalid_csc': 'CVV/CVC 代码无效',
'payment.cancel.unknown': '付款被拒绝',
```

### Шаг 4: Обновить PaymentResult — показывать детальные сообщения

**Файл**: `src/pages/PaymentResult.tsx`

Изменения:
1. Получать `cancellation_reason` из URL параметра или из БД
2. Показывать детальное сообщение на основе причины

```typescript
// Добавить маппинг причин на i18n ключи
const CANCELLATION_MESSAGES: Record<string, string> = {
  insufficient_funds: 'payment.cancel.insufficient_funds',
  card_expired: 'payment.cancel.card_expired',
  fraud_suspected: 'payment.cancel.fraud_suspected',
  general_decline: 'payment.cancel.general_decline',
  '3d_secure_failed': 'payment.cancel.3d_secure_failed',
  invalid_card_number: 'payment.cancel.invalid_card_number',
  invalid_csc: 'payment.cancel.invalid_csc',
};

// В компоненте:
const cancellationReason = searchParams.get('reason');
const cancelMessage = cancellationReason
  ? t(CANCELLATION_MESSAGES[cancellationReason] || 'payment.cancel.unknown')
  : t('payment.result.canceled.subtitle');
```

### Шаг 5: Передавать reason в return_url (опционально)

**Альтернатива**: Вместо передачи через URL, можно загружать из БД по `purchase_id`.

---

## Критические файлы

| Файл | Изменение |
|------|-----------|
| `supabase/migrations/20260131000001_add_cancellation_reason.sql` | Новая миграция |
| `supabase/functions/payment-webhook/index.ts` | Сохранение cancellation_reason |
| `src/lib/i18n.ts` | i18n ключи для всех причин (3 языка) |
| `src/pages/PaymentResult.tsx` | Отображение детальных сообщений |
| `src/types/payment.ts` | Добавить cancellation_reason в Purchase |

---

## Верификация

1. **Применить миграцию** через Supabase MCP
2. **Задеплоить webhook** через `supabase functions deploy payment-webhook`
3. **Протестировать** все 6 сценариев из `docs/PAYMENT-TESTING-GUIDE.md`:
   - Успешная оплата: `2202 4743 0132 2987`
   - 3D Secure: `2200 0000 0000 0004`
   - Недостаточно средств: `2200 0000 0000 0053`
   - Карта просрочена: `2200 0000 0000 0038`
   - Мошенничество: `2200 0000 0000 0046`
   - Общий отказ: `2202 2022 1231 2379`
4. **Проверить в БД**:
   ```sql
   SELECT id, status, cancellation_reason
   FROM purchases
   WHERE status = 'canceled'
   ORDER BY created_at DESC LIMIT 10;
   ```
5. **Проверить UI** — на странице `/payment/result?status=canceled` должно отображаться детальное сообщение

---

## Ожидаемый результат

| Сценарий | cancellation_reason | Сообщение (RU) |
|----------|---------------------|----------------|
| Недостаточно средств | `insufficient_funds` | "Недостаточно средств на карте" |
| Карта просрочена | `card_expired` | "Срок действия карты истёк" |
| Мошенничество | `fraud_suspected` | "Платёж отклонён по соображениям безопасности" |
| Общий отказ | `general_decline` | "Платёж отклонён вашим банком" |
