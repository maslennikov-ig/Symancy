-- ============================================
-- Миграция: Гибкая система назначения администраторов
-- Задача: Заменить захардкоженный список email-ов на таблицу
-- ============================================

-- 1. Создать таблицу для хранения email-ов администраторов
CREATE TABLE IF NOT EXISTS admin_emails (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Комментарий к таблице
COMMENT ON TABLE admin_emails IS 'Таблица для динамического управления списком администраторов';

-- 2. Включить RLS
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

-- 3. Политика: SECURITY DEFINER функции имеют полный доступ
-- Обычные пользователи не могут напрямую читать/писать таблицу
CREATE POLICY "Service role full access" ON admin_emails
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Вставить текущих администраторов
INSERT INTO admin_emails (email, added_by) VALUES
  ('maslennikov-ig@gmail.com', 'initial_setup'),
  ('maslennikov.ig@gmail.com', 'initial_setup'),
  ('m.aslennikovig@gmail.com', 'initial_setup'),
  ('admin@buhbot.local', 'initial_setup'),
  ('1094242@list.ru', 'initial_setup')
ON CONFLICT (email) DO NOTHING;

-- 5. Обновить функцию is_admin() для работы с таблицей
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Проверяем, есть ли email текущего пользователя в таблице admin_emails
  RETURN EXISTS (
    SELECT 1 FROM admin_emails
    WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарий к функции
COMMENT ON FUNCTION is_admin() IS 'Проверяет, является ли текущий пользователь администратором по email из таблицы admin_emails';

-- 6. Создать/обновить функцию is_admin_by_auth_id()
CREATE OR REPLACE FUNCTION is_admin_by_auth_id(p_auth_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Получаем email пользователя по auth_id
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_auth_id;

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Проверяем, есть ли email в таблице admin_emails
  RETURN EXISTS (
    SELECT 1 FROM admin_emails
    WHERE email = v_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарий к функции
COMMENT ON FUNCTION is_admin_by_auth_id(UUID) IS 'Проверяет, является ли пользователь администратором по auth_id (для Telegram-пользователей с привязанными аккаунтами)';
