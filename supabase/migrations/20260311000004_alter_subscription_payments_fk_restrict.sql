-- 20260311000004_alter_subscription_payments_fk_restrict.sql
-- Change ON DELETE CASCADE to ON DELETE RESTRICT for subscription_payments.subscription_id
-- Rationale: Payment records must be preserved for financial audit compliance (54-FZ)

ALTER TABLE subscription_payments
  DROP CONSTRAINT subscription_payments_subscription_id_fkey;

ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT;
