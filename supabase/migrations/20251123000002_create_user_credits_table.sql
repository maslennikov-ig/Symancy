-- 20251123000002_create_user_credits_table.sql

CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  basic_credits INTEGER NOT NULL DEFAULT 0 CHECK (basic_credits >= 0),
  pro_credits INTEGER NOT NULL DEFAULT 0 CHECK (pro_credits >= 0),
  cassandra_credits INTEGER NOT NULL DEFAULT 0 CHECK (cassandra_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
  ON user_credits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credits_updated_at();
