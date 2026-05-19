-- 20260519000001_extend_purchases_amount_check.sql
-- Extend amount_rub CHECK to accept Summer Time promo prices (50/150/250/500).
-- Old prices (100, 300, 500, 1000) are kept valid so historical rows pass the
-- constraint after this migration.

DO $$
BEGIN
  -- Drop the synthetic inline constraint Postgres assigned when the table was created.
  -- Name `purchases_amount_rub_check` matches the default convention for
  -- column-level CHECK constraints on the `amount_rub` column.
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_amount_rub_check;
END $$;

ALTER TABLE purchases
  ADD CONSTRAINT purchases_amount_rub_check
  CHECK (amount_rub IN (50, 100, 150, 250, 300, 500, 1000));
