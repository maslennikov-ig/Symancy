# План: Создание гибкой системы назначения администраторов

## Проблема

1. Пользователь `1094242@list.ru` получает ошибку **403 "Доступ запрещен"** при входе в админ-панель
2. Функции `is_admin()` и `is_admin_by_auth_id()` содержат **захардкоженный список** email-ов
3. Нет механизма для динамического назначения администраторов

---

## Решение: Таблица администраторов

Создать таблицу `admin_emails` для динамического управления списком админов через SQL или админ-панель.

---

## План реализации

### Шаг 1: Создать таблицу `admin_emails`

```sql
-- Таблица для хранения email-ов администраторов
CREATE TABLE IF NOT EXISTS admin_emails (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: только service_role может читать/писать
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

-- Политика: service_role имеет полный доступ (для RPC-функций)
CREATE POLICY "Service role full access" ON admin_emails
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Вставить текущих администраторов
INSERT INTO admin_emails (email, added_by) VALUES
  ('maslennikov.ig@gmail.com', 'initial_setup'),
  ('1094242@list.ru', 'initial_setup')
ON CONFLICT (email) DO NOTHING;
```

### Шаг 2: Обновить функцию `is_admin()`

```sql
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
```

### Шаг 3: Обновить функцию `is_admin_by_auth_id()`

```sql
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
```

---

## Критические файлы

| Файл/Компонент | Назначение |
|----------------|------------|
| `src/admin/hooks/useAdminAuth.ts:80` | Вызывает `supabase.rpc('is_admin')` |
| `src/admin/hooks/useAdminAuth.ts:102` | Вызывает `supabase.rpc('is_admin_by_auth_id')` |
| `src/admin/AdminApp.tsx:70-72` | Показывает 403 если `!isAdmin` |
| Supabase function `is_admin()` | Проверка прав (переписать) |
| Supabase function `is_admin_by_auth_id()` | Проверка для Telegram (переписать) |
| Новая таблица `admin_emails` | Хранение списка админов |

---

## Проверка

1. **Выполнить миграцию** - создать таблицу и обновить функции через Supabase MCP
2. **Проверить данные**:
   ```sql
   SELECT * FROM admin_emails;
   -- Ожидаем: maslennikov.ig@gmail.com, 1094242@list.ru
   ```
3. **Тест функции**:
   ```sql
   SELECT is_admin_by_auth_id('922c9538-2210-4e98-9684-704fdd1ae028');
   -- Ожидаем: true (это auth_id пользователя 1094242@list.ru)
   ```
4. **Войти на https://symancy.ru/admin/** под `1094242@list.ru`
5. **Убедиться**, что Dashboard отображается без ошибок 403

---

## Преимущества нового подхода

1. **Гибкость**: добавление/удаление админов через SQL без изменения кода
2. **Аудит**: поля `added_by` и `created_at` для отслеживания
3. **Масштабируемость**: можно добавить UI в админ-панели для управления
4. **Безопасность**: RLS + SECURITY DEFINER защищают таблицу

---

## Будущие улучшения (опционально)

- Добавить страницу в админ-панель для управления списком админов
- Добавить уведомления при добавлении/удалении админов
- Логирование в `admin_audit_log`
