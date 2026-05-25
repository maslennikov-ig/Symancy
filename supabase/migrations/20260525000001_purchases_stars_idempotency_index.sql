-- Migration: 20260525000001_purchases_stars_idempotency_index.sql
-- Purpose (sym-aj3): Guarantee idempotency of Telegram Stars payments.
-- Telegram may deliver the same successful_payment update more than once; the
-- charge id (telegram_payment_charge_id) is the stable unique key per charge.
-- A partial UNIQUE expression index prevents double-crediting on retries.
--
-- Pre-check (2026-05-25): no duplicate telegram_payment_charge_id values exist
-- in production (0 Stars purchases yet), so the index builds without conflict.

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_tg_charge_id
    ON public.purchases ((metadata ->> 'telegram_payment_charge_id'))
    WHERE metadata ->> 'telegram_payment_charge_id' IS NOT NULL;

COMMENT ON INDEX public.idx_purchases_tg_charge_id IS
    'sym-aj3: idempotency guard for Telegram Stars — one purchase per telegram_payment_charge_id';
