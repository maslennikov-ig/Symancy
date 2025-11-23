# Feature Specification: Pre-MVP Payment Integration

**Feature Branch**: `002-pre-mvp-payments`
**Created**: 2025-11-23
**Status**: Draft
**Priority**: URGENT (client requested ASAP)
**Timeline**: 2-3 weeks
**Dependencies**: Feature 001 documentation (COMPLETE)

## Overview

Минимальная интеграция платежей для валидации готовности пользователей платить. Без подписок - только разовые покупки. Цель: получить первые платежи и валидировать бизнес-модель.

## User Stories

### US1: One-Time Purchase Flow (P0)

Пользователь может купить разовый анализ через ЮKassa.

**Acceptance Criteria**:
1. Пользователь видит кнопку "Купить анализ" с ценой
2. При клике открывается виджет ЮKassa
3. После успешной оплаты пользователь получает доступ к анализу
4. Пользователь получает email-чек (54-ФЗ)

### US2: Tariff Selection (P0)

Пользователь может выбрать один из 4 тарифов.

**Tariffs** (confirmed by client):
| Тариф | Цена | Что включает |
|-------|------|--------------|
| Базовый "Новичок" | 100₽ | 1 базовая расшифровка (3-4 блока), ожидание 5-10 мин |
| Пакет "Любитель" | 300₽ | 5 расшифровок, ожидание <2 мин |
| Разовый "Внутренний мудрец" | 500₽ | 1 PRO расшифровка (6+ блоков), минимальное ожидание |
| Предсказание "Кассандра" | 1000₽ | Эзотерическое предсказание |

### US3: Payment Webhook (P1)

Backend обрабатывает webhooks от ЮKassa для подтверждения платежей.

**Acceptance Criteria**:
1. Webhook endpoint принимает уведомления от ЮKassa
2. Платеж записывается в базу данных
3. Пользователю начисляется купленный продукт
4. Отправляется email-подтверждение

### US4: Purchase History (P1)

Пользователь видит историю своих покупок в личном кабинете.

## Technical Requirements

### Payment Integration (ЮKassa)

```
Provider: ЮKassa (YooMoney)
Commission: 2.4-2.8%
Methods: Cards, СБП, Apple Pay, Google Pay
Online cash register: Built-in (54-ФЗ compliant)
```

### Database Schema

```sql
-- Purchases table
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  product_type TEXT NOT NULL, -- 'basic', 'pack5', 'pro', 'cassandra'
  amount_rub INTEGER NOT NULL, -- 100, 300, 500, 1000
  yukassa_payment_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'succeeded', 'canceled'
  credits_granted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- User credits table
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  basic_credits INTEGER DEFAULT 0,
  pro_credits INTEGER DEFAULT 0,
  cassandra_credits INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

```
POST /api/payments/create - Create payment intent
POST /api/payments/webhook - ЮKassa webhook handler
GET  /api/payments/history - User purchase history
GET  /api/credits - User current credits
```

### Environment Variables

```
YUKASSA_SHOP_ID=xxx
YUKASSA_SECRET_KEY=xxx
YUKASSA_WEBHOOK_SECRET=xxx
```

## Out of Scope (для следующих фаз)

- Подписки (monthly subscriptions)
- Telegram Stars integration
- Streak system
- Admin panel
- Gamification

## Success Metrics

- **SM-001**: Первый платеж обработан в течение 2 недель после запуска
- **SM-002**: Конверсия landing → payment > 1%
- **SM-003**: 0 ошибок в обработке webhooks

## Risks

| Risk | Mitigation |
|------|------------|
| ЮKassa approval delay | Начать регистрацию немедленно |
| 54-ФЗ compliance | Использовать встроенную кассу ЮKassa |
| Webhook failures | Retry mechanism + logging |

## Timeline

| Week | Deliverable |
|------|-------------|
| 1 | ЮKassa registration + DB schema + basic UI |
| 2 | Payment flow + webhook handler + testing |
| 3 | Buffer + production deployment |

## References

- [ЮKassa API Documentation](https://yookassa.ru/developers)
- [Feature 001 Roadmap](../001-landing-n8n-improvements/deliverables/landing-page/roadmap.md)
- [Feature 001 Improvements Spec](../001-landing-n8n-improvements/deliverables/n8n-workflow/improvements-spec.md)
