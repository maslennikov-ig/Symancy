-- 20260131000001_add_cancellation_reason.sql
-- Add cancellation_reason column to purchases table for detailed payment error messages
--
-- ROLLBACK INSTRUCTIONS:
-- DROP INDEX IF EXISTS idx_purchases_cancellation_reason;
-- ALTER TABLE purchases DROP COLUMN IF EXISTS cancellation_reason;

-- Add column for cancellation reason from YooKassa
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_purchases_cancellation_reason
ON purchases(cancellation_reason) WHERE cancellation_reason IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN purchases.cancellation_reason IS 'Reason for payment cancellation from YooKassa cancellation_details.reason. Possible values: insufficient_funds, card_expired, fraud_suspected, general_decline, 3d_secure_failed, invalid_card_number, invalid_csc, invalid_expiry_month, invalid_expiry_year, processing_error, canceled_by_merchant, permission_revoked. NULL if no specific reason provided. See YooKassa API docs for updates.';
