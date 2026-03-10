-- I-5: Add payment_type column to subscription_payments for better auditability
-- Values: 'subscription_initial' (first payment with save_payment_method)
--         'subscription_renewal' (recurring autopayment)

ALTER TABLE subscription_payments
  ADD COLUMN payment_type TEXT CHECK (payment_type IN ('subscription_initial', 'subscription_renewal'));

-- Backfill existing rows based on is_initial flag
UPDATE subscription_payments
  SET payment_type = CASE
    WHEN is_initial THEN 'subscription_initial'
    ELSE 'subscription_renewal'
  END
  WHERE payment_type IS NULL;
