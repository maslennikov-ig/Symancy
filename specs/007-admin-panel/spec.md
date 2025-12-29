# Feature Specification: Admin Panel

**Feature Branch**: `007-admin-panel`
**Created**: 2025-12-29
**Status**: Ready
**Estimated Effort**: 5 days (15 tasks)
**Prerequisites**: specs 003, 004 completed (omnichannel infrastructure)

---

## Executive Summary

Создание легковесной админ-панели для управления ботом Symancy. Позволит менять AI модели без деплоя, мониторить пользователей, отслеживать расходы на LLM и управлять кредитами.

**Бизнес-ценность:**
- Оперативная смена AI моделей без деплоя (экономия времени)
- Мониторинг расходов на LLM (контроль бюджета)
- Просмотр истории разговоров (отладка бота)
- Управление кредитами пользователей (саппорт)

---

## Technology Decision: Refine + Ant Design + Supabase

### Исследованные варианты

| Критерий | Refine | React-Admin | AdminJS |
|----------|--------|-------------|---------|
| **Supabase интеграция** | Нативная `@refinedev/supabase` | Через `ra-supabase` adapter | Требует кастомный adapter |
| **Архитектура** | Headless (hooks) | Component-based | Auto-generated |
| **State Management** | React Query | Redux/Redux-Saga | Собственная |
| **UI библиотеки** | Ant Design, MUI, Chakra | Material UI | Собственная |
| **Tailwind конфликт** | Нет (scoped CSS) | Возможен | Возможен |
| **Real-time** | liveProvider из коробки | Отдельный пакет | Нет |
| **Документация** | 15970 примеров | 4345 примеров | 86 примеров |
| **Maturity** | С 2021, быстро растёт | С 2016, стабильная | С 2019 |

### Выбор: Refine

**Причины:**
1. **Нативная Supabase интеграция** — `@refinedev/supabase` работает из коробки с auth, data, real-time
2. **Headless архитектура** — не конфликтует с существующим Tailwind CSS на `/admin` route
3. **React Query** — современный подход, не требует изучения Redux
4. **Real-time** — liveProvider для мгновенных обновлений при изменении данных
5. **Ant Design** — отличный UI Kit для админок, scoped styles

**Источники исследования:**
- [Refine vs React-Admin comparison](https://marmelab.com/blog/2023/07/04/react-admin-vs-refine.html)
- [Supabase + Refine tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-refine)
- [Refine official comparison](https://refine.dev/docs/comparison/)

---

## User Scenarios & Testing

### User Story 1 - System Configuration (Priority: P1)

Администратор меняет AI модель для анализа фото без деплоя кода.

**Why this priority**: Позволяет оперативно переключаться между моделями (Gemini ↔ GPT-4 ↔ Claude) при проблемах с провайдером или для A/B тестирования.

**Independent Test**: Изменить `model_vision` в админке → отправить фото в бот → убедиться, что используется новая модель.

**Acceptance Scenarios**:

1. **Given** админ авторизован, **When** открывает `/admin/system-config`, **Then** видит таблицу конфигурации с текущими значениями
2. **Given** админ редактирует `model_vision`, **When** сохраняет изменение, **Then** значение обновляется в базе мгновенно
3. **Given** пользователь отправляет фото после изменения модели, **When** бот обрабатывает запрос, **Then** используется новая модель из конфигурации

---

### User Story 2 - User Management (Priority: P1)

Администратор просматривает список пользователей, их баланс кредитов и историю активности.

**Why this priority**: Необходимо для поддержки пользователей и понимания использования бота.

**Acceptance Scenarios**:

1. **Given** админ открывает `/admin/users`, **When** страница загружается, **Then** видит таблицу с пользователями (telegram_id, name, credits, last_active)
2. **Given** админ кликает на пользователя, **When** открывается детали, **Then** видит полный профиль, историю кредитов, последние сообщения
3. **Given** админ ищет пользователя, **When** вводит telegram_id или имя в поиск, **Then** таблица фильтруется в реальном времени

---

### User Story 3 - Credit Management (Priority: P2)

Администратор корректирует баланс кредитов пользователя (рефанд, бонус, тестовые кредиты).

**Acceptance Scenarios**:

1. **Given** админ открывает страницу кредитов пользователя, **When** видит текущий баланс, **Then** может изменить basic/pro/cassandra кредиты
2. **Given** админ добавляет кредиты, **When** сохраняет, **Then** баланс обновляется атомарно через RPC
3. **Given** админ изменил кредиты, **When** пользователь проверяет /credits, **Then** видит обновлённый баланс

---

### User Story 4 - LLM Cost Analytics Dashboard (Priority: P2)

Администратор отслеживает расходы на LLM API по пользователям и моделям.

**Acceptance Scenarios**:

1. **Given** админ открывает `/admin/costs`, **When** страница загружается, **Then** видит дашборд: total cost, requests count, top models
2. **Given** админ выбирает date range, **When** применяет фильтр, **Then** графики перестраиваются для выбранного периода
3. **Given** админ кликает на пользователя в таблице costs, **When** открывается детали, **Then** видит breakdown по моделям и дням

---

### User Story 5 - Message History Viewer (Priority: P3)

Администратор просматривает историю разговоров для отладки.

**Acceptance Scenarios**:

1. **Given** админ открывает `/admin/messages`, **When** выбирает пользователя, **Then** видит хронологию сообщений (user/assistant)
2. **Given** админ видит сообщение с ошибкой, **When** открывает metadata, **Then** видит детали: model_used, tokens, processing_time
3. **Given** админ фильтрует по `content_type = analysis`, **When** применяет фильтр, **Then** видит только сообщения с анализами фото

---

### User Story 6 - User State Management (Priority: P3)

Администратор "разблокирует" застрявших пользователей (stuck в onboarding или processing).

**Acceptance Scenarios**:

1. **Given** админ открывает `/admin/user-states`, **When** видит пользователя с `onboarding_step != null` более 24 часов, **Then** может сбросить состояние
2. **Given** админ нажимает "Reset State", **When** подтверждает действие, **Then** `onboarding_step` и `onboarding_data` обнуляются
3. **Given** застрявший пользователь после сброса, **When** пишет в бот, **Then** бот отвечает нормально (не зависает)

---

## Requirements

### Functional Requirements

#### Authentication & Authorization

- **FR-001**: Система MUST аутентифицировать админа через Supabase Auth
- **FR-002**: Система MUST проверять email в whitelist (`is_admin()` function)
- **FR-003**: Система MUST показывать 403 для неавторизованных пользователей
- **FR-004**: Система MUST поддерживать logout с редиректом на `/admin/login`

#### System Config Resource

- **FR-005**: Система MUST отображать таблицу `system_config` (key, value, description)
- **FR-006**: Система MUST позволять редактировать `value` для существующих ключей
- **FR-007**: Система MUST валидировать JSON формат для `value` перед сохранением
- **FR-008**: Система MUST НЕ позволять создавать/удалять конфиги (только edit)

#### Users Resource

- **FR-009**: Система MUST объединять данные из `unified_users` и `unified_user_credits`
- **FR-010**: Система MUST поддерживать пагинацию (25 записей на страницу)
- **FR-011**: Система MUST поддерживать сортировку по `last_active_at`, `created_at`
- **FR-012**: Система MUST поддерживать поиск по `telegram_id`, `display_name`

#### Credits Resource

- **FR-013**: Система MUST позволять редактировать `credits_basic`, `credits_pro`, `credits_cassandra`
- **FR-014**: Система MUST использовать атомарные RPC для изменения кредитов
- **FR-015**: Система MUST логировать изменения в `backend_credit_transactions` (admin_adjustment)

#### Messages Resource

- **FR-016**: Система MUST отображать сообщения из `messages` таблицы
- **FR-017**: Система MUST фильтровать по `conversation_id`, `role`, `content_type`
- **FR-018**: Система MUST показывать metadata в expandable row

#### LLM Costs Dashboard

- **FR-019**: Система MUST агрегировать данные из `analysis_history` (tokens_used, model_used)
- **FR-020**: Система MUST показывать: total requests, total tokens, top models
- **FR-021**: Система MUST поддерживать date range filter (last 7d, 30d, custom)

#### User States Resource

- **FR-022**: Система MUST отображать `user_states` с подсветкой stuck users
- **FR-023**: Система MUST позволять reset `onboarding_step` и `onboarding_data`

---

### Non-Functional Requirements

- **NFR-001**: Время загрузки страницы MUST быть <2 секунд
- **NFR-002**: Admin Panel MUST быть изолирована от основного приложения (CSS scope)
- **NFR-003**: Все запросы MUST проходить через Supabase RLS
- **NFR-004**: Admin Panel MUST поддерживать только desktop (>1024px)

---

## Technical Architecture

### Route Structure

```
/admin
├── /login          - Supabase Auth login page
├── /dashboard      - Overview stats (redirects here after login)
├── /system-config  - System configuration CRUD
├── /users          - Users list & details
├── /credits        - Credit management (linked from users)
├── /messages       - Message history viewer
├── /costs          - LLM cost analytics dashboard
└── /user-states    - Bot state management
```

### Dependencies

```bash
# Core Refine
pnpm add @refinedev/core @refinedev/cli

# Supabase Data Provider
pnpm add @refinedev/supabase

# Ant Design UI
pnpm add @refinedev/antd antd @ant-design/icons

# Router
pnpm add @refinedev/react-router react-router-dom
```

### File Structure

```
src/
├── admin/
│   ├── App.tsx              # Refine app wrapper
│   ├── authProvider.ts      # Supabase auth + admin check
│   ├── dataProvider.ts      # Supabase data provider config
│   ├── layout/
│   │   └── AdminLayout.tsx  # Sidebar + Header
│   ├── pages/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── system-config/
│   │   ├── users/
│   │   ├── credits/
│   │   ├── messages/
│   │   ├── costs/
│   │   └── user-states/
│   └── components/
│       ├── JsonEditor.tsx    # JSONB value editor
│       └── CostChart.tsx     # Charts for costs dashboard
└── App.tsx                   # Main app (add /admin route)
```

### Database Changes

#### RLS Policies (Admin Access)

```sql
-- Admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') IN (
    'maslennikov-ig@gmail.com'
    -- Add more admin emails as needed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- system_config: Admin can read/update
CREATE POLICY "Admins can manage config" ON system_config
FOR ALL USING (is_admin());

-- unified_users: Admin can read all
CREATE POLICY "Admins can read all users" ON unified_users
FOR SELECT USING (is_admin());

-- unified_user_credits: Admin can read/update
CREATE POLICY "Admins can manage credits" ON unified_user_credits
FOR ALL USING (is_admin());

-- messages: Admin can read all
CREATE POLICY "Admins can read all messages" ON messages
FOR SELECT USING (is_admin());

-- analysis_history: Admin can read all (for costs)
CREATE POLICY "Admins can read analysis" ON analysis_history
FOR SELECT USING (is_admin());

-- user_states: Admin can read/update
CREATE POLICY "Admins can manage states" ON user_states
FOR ALL USING (is_admin());
```

#### Admin Credit Adjustment RPC

```sql
CREATE OR REPLACE FUNCTION admin_adjust_credits(
  p_unified_user_id UUID,
  p_basic_delta INTEGER DEFAULT 0,
  p_pro_delta INTEGER DEFAULT 0,
  p_cassandra_delta INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT 'admin_adjustment'
)
RETURNS unified_user_credits AS $$
DECLARE
  v_result unified_user_credits;
BEGIN
  -- Security check
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update credits atomically
  UPDATE unified_user_credits
  SET
    credits_basic = GREATEST(0, credits_basic + p_basic_delta),
    credits_pro = GREATEST(0, credits_pro + p_pro_delta),
    credits_cassandra = GREATEST(0, credits_cassandra + p_cassandra_delta),
    updated_at = now()
  WHERE unified_user_id = p_unified_user_id
  RETURNING * INTO v_result;

  -- Log transaction (optional, reuse existing table)
  -- INSERT INTO credit_audit_log...

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### LLM Costs Aggregation View

```sql
CREATE OR REPLACE VIEW admin_llm_costs AS
SELECT
  ah.unified_user_id,
  uu.display_name,
  uu.telegram_id,
  ah.model_used,
  DATE_TRUNC('day', ah.created_at) as date,
  COUNT(*) as request_count,
  SUM(ah.tokens_used) as total_tokens,
  AVG(ah.processing_time_ms) as avg_processing_ms
FROM analysis_history ah
JOIN unified_users uu ON ah.unified_user_id = uu.id
WHERE ah.status = 'completed'
GROUP BY ah.unified_user_id, uu.display_name, uu.telegram_id,
         ah.model_used, DATE_TRUNC('day', ah.created_at);

-- Grant access
GRANT SELECT ON admin_llm_costs TO authenticated;
```

---

## Implementation Phases

### Phase 1: Foundation (Day 1)
- [ ] Install Refine dependencies
- [ ] Create `/admin` route in main App.tsx
- [ ] Implement authProvider with `is_admin()` check
- [ ] Create AdminLayout with sidebar navigation
- [ ] Setup Ant Design CSS scoping

### Phase 2: Core Resources (Day 2)
- [ ] system_config: List + Edit
- [ ] users: List + Show
- [ ] credits: Edit (linked from users)

### Phase 3: Advanced Features (Day 3)
- [ ] messages: List with filters
- [ ] user_states: List + Reset action
- [ ] Database: RLS policies for admin

### Phase 4: Analytics Dashboard (Day 4)
- [ ] LLM costs view creation
- [ ] Dashboard with stats cards
- [ ] Charts for cost visualization

### Phase 5: Polish & Testing (Day 5)
- [ ] Error handling & loading states
- [ ] Mobile responsiveness (basic)
- [ ] Manual testing all flows
- [ ] Documentation

---

## Success Criteria

- **SC-001**: Админ может войти по email из whitelist
- **SC-002**: Изменение `model_vision` применяется к следующему запросу бота
- **SC-003**: Просмотр списка пользователей с пагинацией работает <2 сек
- **SC-004**: Изменение кредитов атомарно и отражается в боте мгновенно
- **SC-005**: История сообщений загружается с фильтрами
- **SC-006**: Reset stuck user возвращает пользователя в рабочее состояние
- **SC-007**: LLM costs dashboard показывает корректные агрегации

---

## Out of Scope

- Mobile-optimized admin UI (desktop only для MVP)
- Bulk operations (массовое изменение кредитов)
- Audit log viewer (только создание записей)
- Scheduled messages management UI
- Real-time notifications в админке
- Export to CSV/Excel
- Multi-tenant (один админ = один владелец бота)

---

## Dependencies

- **Supabase Auth** — для аутентификации админов
- **Existing tables** — `system_config`, `unified_users`, `unified_user_credits`, `messages`, `analysis_history`, `user_states`
- **Existing RPC** — может потребоваться создание новых для атомарных операций

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Ant Design конфликтует с Tailwind | Low | Medium | CSS scoping через `:where()` или separate entry point |
| RLS policies блокируют админа | Medium | High | Тестировать policies в Supabase Dashboard перед деплоем |
| Refine breaking changes | Low | Medium | Использовать LTS версии, pin versions |

---

## Clarifications (Resolved)

1. **Admin emails**: Для MVP только `maslennikov-ig@gmail.com`. Список легко расширить в `is_admin()` функции.
2. **Cost tracking**: В `analysis_history` только `tokens_used` и `model_used`. Стоимость будет вычисляться на клиенте по модельным ценам (OpenRouter rates).
3. **Credit audit**: Используем существующую таблицу `backend_credit_transactions` с `transaction_type='admin_adjustment'` для логирования изменений.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-29 | 1.1 | Resolved clarifications, created tasks.md (15 tasks), status → Ready |
| 2025-12-29 | 1.0 | Initial spec based on research (Refine vs React-Admin vs AdminJS) |
