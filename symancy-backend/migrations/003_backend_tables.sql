-- Migration: 003_backend_tables.sql
-- Purpose: Create tables for Node.js Telegram bot backend
-- Applied via Supabase MCP on 2025-12-25
--
-- Tables created:
--   1. profiles - Telegram user profiles
--   2. analysis_history - Coffee reading analysis history
--   3. chat_messages - Chat conversation history
--   4. user_states - User onboarding and session state
--   5. scheduled_messages - Scheduled proactive messages
--   6. system_config - Dynamic configuration key-value store

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================
-- Stores Telegram user profiles, linked by telegram_user_id (Telegram's user ID)

CREATE TABLE IF NOT EXISTS profiles (
    telegram_user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT DEFAULT 'ru',
    is_premium BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Telegram user profiles for the coffee reading bot';
COMMENT ON COLUMN profiles.telegram_user_id IS 'Telegram user ID (primary key)';
COMMENT ON COLUMN profiles.username IS 'Telegram username (without @)';
COMMENT ON COLUMN profiles.language_code IS 'User preferred language (ru, en, zh)';
COMMENT ON COLUMN profiles.is_premium IS 'Whether user has Telegram Premium';
COMMENT ON COLUMN profiles.is_blocked IS 'Whether user has blocked the bot';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to profiles"
    ON profiles FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read profiles for public stats"
    ON profiles FOR SELECT TO anon
    USING (false);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- =============================================================================
-- 2. ANALYSIS HISTORY TABLE
-- =============================================================================
-- Stores all coffee reading analyses performed by users

CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL REFERENCES profiles(telegram_user_id) ON DELETE CASCADE,

    -- Analysis content
    image_url TEXT,
    analysis_type TEXT NOT NULL DEFAULT 'basic' CHECK (analysis_type IN ('basic', 'pro', 'cassandra')),
    persona TEXT NOT NULL DEFAULT 'arina' CHECK (persona IN ('arina', 'cassandra')),

    -- Results
    interpretation TEXT,
    tokens_used INTEGER DEFAULT 0,
    model_used TEXT,

    -- Metadata
    processing_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE analysis_history IS 'Coffee reading analysis history';
COMMENT ON COLUMN analysis_history.telegram_user_id IS 'FK to profiles.telegram_user_id';
COMMENT ON COLUMN analysis_history.analysis_type IS 'Type of analysis: basic, pro, or cassandra';
COMMENT ON COLUMN analysis_history.persona IS 'AI persona used: arina or cassandra';
COMMENT ON COLUMN analysis_history.interpretation IS 'The generated interpretation text';
COMMENT ON COLUMN analysis_history.tokens_used IS 'LLM tokens consumed';
COMMENT ON COLUMN analysis_history.processing_time_ms IS 'Time taken to process in milliseconds';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_created
    ON analysis_history(telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_status
    ON analysis_history(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_analysis_history_type
    ON analysis_history(analysis_type, created_at DESC);

-- RLS
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to analysis_history"
    ON analysis_history FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "No anon access to analysis_history"
    ON analysis_history FOR SELECT TO anon
    USING (false);

-- =============================================================================
-- 3. CHAT MESSAGES TABLE
-- =============================================================================
-- Stores conversation history for chat context

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL REFERENCES profiles(telegram_user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE chat_messages IS 'Chat conversation history for context in AI responses';
COMMENT ON COLUMN chat_messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN chat_messages.content IS 'Message content text';

-- Index for loading recent chat history
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages(telegram_user_id, created_at DESC);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to chat_messages"
    ON chat_messages FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "No anon access to chat_messages"
    ON chat_messages FOR SELECT TO anon
    USING (false);

-- =============================================================================
-- 4. USER STATES TABLE
-- =============================================================================
-- Stores user state for onboarding and settings

CREATE TABLE IF NOT EXISTS user_states (
    telegram_user_id BIGINT PRIMARY KEY REFERENCES profiles(telegram_user_id) ON DELETE CASCADE,
    onboarding_step TEXT,
    onboarding_data JSONB DEFAULT '{}'::jsonb,
    last_analysis_id UUID REFERENCES analysis_history(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_states IS 'User state for onboarding flow and session tracking';
COMMENT ON COLUMN user_states.onboarding_step IS 'Current onboarding step name (null if completed)';
COMMENT ON COLUMN user_states.onboarding_data IS 'Temporary data collected during onboarding';
COMMENT ON COLUMN user_states.last_analysis_id IS 'Reference to the most recent analysis';

-- Index for FK performance
CREATE INDEX IF NOT EXISTS idx_user_states_last_analysis_id
    ON user_states(last_analysis_id) WHERE last_analysis_id IS NOT NULL;

-- RLS
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to user_states"
    ON user_states FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "No anon access to user_states"
    ON user_states FOR SELECT TO anon
    USING (false);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_user_states_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_user_states_updated_at
    BEFORE UPDATE ON user_states
    FOR EACH ROW
    EXECUTE FUNCTION update_user_states_updated_at();

-- =============================================================================
-- 5. SCHEDULED MESSAGES TABLE
-- =============================================================================
-- Stores scheduled proactive messages

CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id BIGINT NOT NULL REFERENCES profiles(telegram_user_id) ON DELETE CASCADE,
    message_type TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduled_messages IS 'Scheduled proactive messages for user engagement';
COMMENT ON COLUMN scheduled_messages.message_type IS 'Type: proactive_engagement, reminder, etc.';
COMMENT ON COLUMN scheduled_messages.scheduled_at IS 'When the message should be sent';
COMMENT ON COLUMN scheduled_messages.sent_at IS 'When the message was actually sent';
COMMENT ON COLUMN scheduled_messages.status IS 'Status: pending, sent, failed, cancelled';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
    ON scheduled_messages(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user
    ON scheduled_messages(telegram_user_id, created_at DESC);

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to scheduled_messages"
    ON scheduled_messages FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "No anon access to scheduled_messages"
    ON scheduled_messages FOR SELECT TO anon
    USING (false);

-- =============================================================================
-- 6. SYSTEM CONFIG TABLE
-- =============================================================================
-- Dynamic configuration with key-value pairs

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_config IS 'Dynamic system configuration key-value store';
COMMENT ON COLUMN system_config.key IS 'Configuration key (unique identifier)';
COMMENT ON COLUMN system_config.value IS 'Configuration value as JSONB';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of the config';

-- RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to system_config"
    ON system_config FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read public system_config"
    ON system_config FOR SELECT TO anon
    USING (key NOT LIKE 'secret_%' AND key NOT LIKE 'private_%');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_system_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_system_config_updated_at();

-- =============================================================================
-- DEFAULT CONFIG VALUES
-- =============================================================================

INSERT INTO system_config (key, value, description) VALUES
    ('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode to disable bot responses'),
    ('daily_chat_limit', '50'::jsonb, 'Maximum chat messages per user per day'),
    ('proactive_messages_enabled', 'true'::jsonb, 'Enable proactive engagement messages'),
    ('default_language', '"ru"'::jsonb, 'Default language for new users')
ON CONFLICT (key) DO NOTHING;
