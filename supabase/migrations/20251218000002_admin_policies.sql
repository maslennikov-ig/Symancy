
-- Create helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user's email is in the admin list
  RETURN (auth.jwt() ->> 'email') IN ('admin@buhbot.local', 'maslennikov-ig@gmail.com', 'm.aslennikovig@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for app_config to allow UPDATE only for admins
DROP POLICY IF EXISTS "Allow service_role to manage app_config" ON app_config;
-- Service role always has access, but we add explicit policy for users
CREATE POLICY "Admins can update config" ON app_config
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Allow admins to view all purchases (override existing own-only policy if needed, or add new one)
CREATE POLICY "Admins can view all purchases" ON purchases
FOR SELECT TO authenticated
USING (is_admin());

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated
USING (is_admin());

