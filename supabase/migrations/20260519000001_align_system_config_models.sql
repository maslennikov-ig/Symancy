-- Align system_config with Telegram backend models (symancy-backend/src/config/constants.ts).
-- Web Edge Function (analyze-coffee) and Telegram bot now both read from these keys,
-- making system_config the single source of truth — admin panel changes propagate to both.

-- 1. Seed missing persona model keys
INSERT INTO system_config (key, value, description) VALUES
  ('arina_model',       '"qwen/qwen3.6-plus"'::jsonb,           'Arina persona — full reading (all topics)'),
  ('arina_basic_model', '"deepseek/deepseek-v4-flash"'::jsonb,  'Arina basic — single topic (Telegram-only)'),
  ('cassandra_model',   '"moonshotai/kimi-k2-thinking"'::jsonb, 'Cassandra persona (premium thinking model)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. Refresh chat and vision models
UPDATE system_config SET value='"deepseek/deepseek-v4-flash"'::jsonb, updated_at=now() WHERE key='chat_model';
UPDATE system_config SET value='"google/gemma-4-31b-it"'::jsonb,      updated_at=now() WHERE key='vision_model';

-- 3. Raise interpretation max_tokens (Arina/Cassandra "all topics" full readings)
UPDATE system_config SET value='5000'::jsonb, updated_at=now() WHERE key='arina_max_tokens';
UPDATE system_config SET value='5000'::jsonb, updated_at=now() WHERE key='cassandra_max_tokens';

-- 4. Drop orphaned interpretation_* keys (no longer used after persona split)
DELETE FROM system_config WHERE key IN ('interpretation_model','interpretation_temperature','interpretation_max_tokens');
