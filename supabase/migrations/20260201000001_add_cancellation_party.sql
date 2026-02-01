-- 20260201000001_add_cancellation_party.sql
-- Add cancellation_party column to identify who canceled the payment
--
-- ROLLBACK INSTRUCTIONS:
-- ALTER TABLE purchases DROP COLUMN IF EXISTS cancellation_party;

-- Add column for cancellation party from YooKassa cancellation_details.party
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cancellation_party TEXT;

-- Comment for documentation
COMMENT ON COLUMN purchases.cancellation_party IS 'Party that initiated payment cancellation from YooKassa cancellation_details.party. Values: yoo_money (YooKassa declined), payment_network (bank/card network declined), merchant (merchant canceled). NULL if no cancellation or unknown.';
