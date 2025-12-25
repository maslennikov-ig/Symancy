# Технический долг

> Последнее обновление: 2025-12-25

---

## 002-pre-mvp-payments: Ручные проверки

**Статус**: Ожидает выполнения
**Приоритет**: P1
**Блокирует**: Продакшен-запуск платежей

### Веб-платежи (Phase 8)

| ID | Задача | Требования |
|----|--------|------------|
| T035 | Установить Supabase secrets | Реальные credentials от клиента: `YUKASSA_SHOP_ID`, `YUKASSA_SECRET_KEY`, `YUKASSA_WEBHOOK_SECRET`, `RESEND_API_KEY` |
| T039 | E2E тестирование с YooKassa sandbox | Пройти все сценарии из [PAYMENT-TESTING-GUIDE.md](./PAYMENT-TESTING-GUIDE.md) |
| T040 | Настроить webhook URL в кабинете YooKassa | URL: `https://johspxgvkbrysxhilmbg.supabase.co/functions/v1/payment-webhook` |

### Telegram-платежи (Phase 10)

| ID | Задача | Требования |
|----|--------|------------|
| T046 | Настроить YooKassa в BotFather | `/mybots` → Payments → Connect YooKassa → получить `provider_token` |
| T050 | Установить webhook для бота | `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://johspxgvkbrysxhilmbg.supabase.co/functions/v1/telegram-bot-webhook"` |
| T052 | Тестирование Telegram-платежей | Отправить `/buy`, оплатить, проверить начисление кредитов |

### Чеклист для закрытия

- [ ] T035: Secrets установлены в Supabase
- [ ] T039: Все сценарии тестирования пройдены
- [ ] T040: Webhook настроен в кабинете YooKassa
- [ ] T046: YooKassa подключена в BotFather
- [ ] T050: Webhook бота установлен
- [ ] T052: Telegram-платежи протестированы

---

## Как закрыть этот долг

1. Получить реальные credentials от клиента (YooKassa shop_id, secret_key)
2. Установить secrets: `supabase secrets set YUKASSA_SHOP_ID=xxx ...`
3. Пройти тестирование по [PAYMENT-TESTING-GUIDE.md](./PAYMENT-TESTING-GUIDE.md)
4. Настроить webhook в кабинете YooKassa
5. (Опционально) Настроить Telegram-платежи
6. Удалить эту секцию из документа

---

## История

| Дата | Изменение |
|------|-----------|
| 2025-12-25 | Создан документ. Перенесены ручные задачи из 002-pre-mvp-payments |
