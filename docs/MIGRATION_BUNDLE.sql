-- MIGRATION BUNDLE: Symancy Phase 0 & Admin Panel
-- Date: 2025-12-18
-- Author: Gemini CLI Agent

-- 1. Create app_config table for AI Configuration
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert Default AI Models and Prompts
INSERT INTO app_config (config_key, config_value, description)
VALUES 
    ('VISION_MODEL', 'google/gemini-1.5-flash', 'Model ID for Vision Analysis (OpenRouter)'),
    ('INTERPRETATION_MODEL', 'google/gemini-1.5-flash', 'Model ID for Text Interpretation (OpenRouter)'),
    ('ARINA_PROMPT', 'You are Arina...', 'System prompt for Psychologist mode (Placeholder - update via Admin UI)'),
    ('CASSANDRA_PROMPT', 'You are Cassandra...', 'System prompt for Esoteric mode (Placeholder - update via Admin UI)')
ON CONFLICT (config_key) DO NOTHING;

-- 3. Enable RLS on app_config
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- 3.1 Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Trigger for app_config
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Admin Access Control Function
-- Validates if the current user is an admin based on email whitelist
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') IN ('admin@buhbot.local', 'maslennikov-ig@gmail.com', 'm.aslennikovig@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies for app_config
-- Public read access (or authenticated users)
CREATE POLICY "Enable public read for app_config" ON app_config 
FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can update config" ON app_config
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 6. RLS Policies for Admin Views (Purchases & Profiles)
-- Allow admins to see ALL purchases (overriding user-only policies)
CREATE POLICY "Admins can view all purchases" ON purchases
FOR SELECT TO authenticated
USING (is_admin());

-- Allow admins to see ALL user profiles
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated
USING (is_admin());
