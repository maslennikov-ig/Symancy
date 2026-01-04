-- Migration: 20260104_update_notification_settings.sql
-- Purpose: Extend notification_settings JSONB with per-user time preferences for daily insights
-- and add indexes for efficient timezone-based notification queries

-- 1. Update the DEFAULT for notification_settings column to include new fields
-- Note: This only affects NEW rows, existing rows keep their current values
ALTER TABLE unified_users
ALTER COLUMN notification_settings SET DEFAULT '{
  "enabled": true,
  "morning_enabled": true,
  "evening_enabled": true,
  "morning_time": "08:00",
  "evening_time": "20:00"
}'::jsonb;

-- 2. Backfill existing users with the new structure
-- Uses jsonb || operator to MERGE (not replace) - preserves existing "enabled" value
-- Conditional UPDATE to not overwrite if fields already exist
UPDATE unified_users
SET notification_settings = notification_settings || '{
  "morning_enabled": true,
  "evening_enabled": true,
  "morning_time": "08:00",
  "evening_time": "20:00"
}'::jsonb,
    updated_at = now()
WHERE NOT (notification_settings ? 'morning_enabled');

-- 3. Add index for timezone queries (efficient for batch notification jobs)
CREATE INDEX IF NOT EXISTS idx_unified_users_timezone
ON unified_users(timezone);

-- 4. Add partial index for notification queries (users with notifications enabled)
-- This index is optimized for finding users who should receive notifications
CREATE INDEX IF NOT EXISTS idx_unified_users_notifications_enabled
ON unified_users((notification_settings->>'enabled'))
WHERE (notification_settings->>'enabled')::boolean = true;

-- Add comment documenting the notification_settings structure
COMMENT ON COLUMN unified_users.notification_settings IS
'JSONB notification preferences: {
  "enabled": boolean,           -- Master toggle for all notifications
  "morning_enabled": boolean,   -- Enable morning daily advice
  "evening_enabled": boolean,   -- Enable evening daily reflection
  "morning_time": "HH:MM",      -- Preferred morning notification time (local timezone)
  "evening_time": "HH:MM"       -- Preferred evening notification time (local timezone)
}';
