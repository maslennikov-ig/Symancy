
-- Create app_config table for AI model configuration
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add default AI models
INSERT INTO app_config (config_key, config_value, description) VALUES
('VISION_MODEL', 'google/gemini-1.5-flash', 'Default Vision Model ID for OpenRouter'),
('INTERPRETATION_MODEL', 'google/gemini-1.5-flash', 'Default Interpretation Model ID for OpenRouter'),
('ARINA_PROMPT', 'Use the prompt text from prompts.ts or a URL to a prompt file', 'System prompt for Arina (Psychologist mode)'),
('CASSANDRA_PROMPT', 'Use the prompt text from prompts.ts or a URL to a prompt file', 'System prompt for Cassandra (Esoteric mode)'),
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS policies
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Policies for app_config (allow read for everyone, write for service_role)
CREATE POLICY "Enable public read for app_config" ON app_config FOR SELECT USING (true);
CREATE POLICY "Allow service_role to manage app_config" ON app_config FOR ALL USING (current_setting('role') = 'service_role');

