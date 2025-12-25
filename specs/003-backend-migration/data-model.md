# Data Model: Backend Migration

**Date**: 2025-12-25
**Source**: spec.md, TZ_BACKEND_MIGRATION.md v2.2

---

## Entity Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     profiles     │────▶│   user_states    │     │  chat_messages   │
│   (existing)     │     │     (new)        │     │     (new)        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                                                  │
         │                                                  │
         ▼                                                  ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  user_credits    │     │scheduled_messages│     │  system_config   │
│   (existing)     │     │     (new)        │     │     (new)        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## Existing Tables (Supabase)

### profiles

Extended with new fields for backend migration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | PK, references auth.users |
| telegram_user_id | BIGINT | YES | - | Telegram user ID |
| **name** | TEXT | YES | - | User display name (onboarding) |
| **goals** | TEXT[] | YES | - | Selected goals ['career', 'relationships', ...] |
| **notification_frequency** | TEXT | YES | 'weekly' | 'daily' / 'weekly' / 'never' |
| **onboarding_completed** | BOOLEAN | YES | FALSE | Onboarding flow completed |
| **timezone** | TEXT | YES | 'Europe/Moscow' | User timezone for scheduled messages |
| **last_analysis_at** | TIMESTAMPTZ | YES | - | Last photo analysis timestamp |
| **last_interaction_at** | TIMESTAMPTZ | YES | - | Last message received |
| **daily_chat_count** | INTEGER | YES | 0 | Chat messages today |
| **daily_chat_reset_at** | DATE | YES | CURRENT_DATE | Reset date for daily counter |
| created_at | TIMESTAMPTZ | YES | NOW() | - |
| updated_at | TIMESTAMPTZ | YES | NOW() | - |

**New Fields**:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goals TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'weekly';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Moscow';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_chat_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_chat_reset_at DATE DEFAULT CURRENT_DATE;
```

### user_credits

Existing table, no changes needed.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| basic_credits | INTEGER | Credits for Arina analysis |
| cassandra_credits | INTEGER | Credits for Cassandra analysis |
| created_at | TIMESTAMPTZ | - |
| updated_at | TIMESTAMPTZ | - |

---

## New Tables

### chat_messages

Stores conversation history for LangChain memory.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | PK |
| user_id | UUID | NO | - | FK → auth.users |
| telegram_user_id | BIGINT | NO | - | For quick lookups |
| session_id | UUID | YES | - | Group messages by session |
| role | TEXT | NO | - | 'user' / 'assistant' / 'system' |
| content | TEXT | NO | - | Message content |
| message_type | TEXT | YES | - | 'photo_analysis' / 'chat' / 'cassandra' / 'onboarding' |
| metadata | JSONB | YES | '{}' | vision_result, tokens_used, cost_usd, model_used, photo_path, retention_until |
| created_at | TIMESTAMPTZ | YES | NOW() | - |

**Indexes**:
```sql
CREATE INDEX idx_chat_messages_user_recent
  ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_telegram
  ON chat_messages(telegram_user_id, created_at DESC);
CREATE INDEX idx_chat_messages_session
  ON chat_messages(session_id)
  WHERE session_id IS NOT NULL;
```

**Constraints**:
```sql
CHECK (role IN ('user', 'assistant', 'system'))
```

**RLS Policy**:
```sql
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_chat_messages ON chat_messages
  FOR ALL USING (auth.role() = 'service_role');
```

### user_states

Tracks current user state in flows (onboarding, processing).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| user_id | UUID | NO | - | PK, FK → auth.users |
| telegram_user_id | BIGINT | NO | - | UNIQUE, for quick lookups |
| current_mode | TEXT | YES | 'idle' | 'idle' / 'onboarding' / 'processing' |
| flow_step | TEXT | YES | - | Current step in flow |
| buffer_data | JSONB | YES | '{}' | Temporary data during flow |
| updated_at | TIMESTAMPTZ | YES | NOW() | - |

**Constraints**:
```sql
CHECK (current_mode IN ('idle', 'onboarding', 'processing'))
```

**RLS Policy**:
```sql
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_user_states ON user_states
  FOR ALL USING (auth.role() = 'service_role');
```

### scheduled_messages

Queue for proactive engagement messages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | PK |
| user_id | UUID | NO | - | FK → auth.users |
| telegram_user_id | BIGINT | NO | - | Target Telegram ID |
| message_type | TEXT | NO | - | 'inactive_reminder' / 'weekly_checkin' / 'daily_fortune' / 'abandoned_onboarding' |
| scheduled_for | TIMESTAMPTZ | NO | - | When to send |
| payload | JSONB | YES | '{}' | Additional data |
| status | TEXT | YES | 'pending' | 'pending' / 'sent' / 'failed' / 'cancelled' |
| sent_at | TIMESTAMPTZ | YES | - | Actual send time |
| error | TEXT | YES | - | Error message if failed |
| created_at | TIMESTAMPTZ | YES | NOW() | - |

**Indexes**:
```sql
CREATE INDEX idx_scheduled_pending
  ON scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';
```

**RLS Policy**:
```sql
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_scheduled ON scheduled_messages
  FOR ALL USING (auth.role() = 'service_role');
```

### system_config

Dynamic configuration stored in database.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| key | TEXT | NO | - | PK |
| value | TEXT | NO | - | Config value |
| description | TEXT | YES | - | Human-readable description |
| updated_at | TIMESTAMPTZ | YES | NOW() | - |

**Default Values**:
```sql
INSERT INTO system_config (key, value, description) VALUES
  ('model_vision', 'google/gemini-1.5-flash', 'Vision model for photo analysis'),
  ('model_arina', 'google/gemini-1.5-flash', 'Arina interpretation model'),
  ('model_cassandra', 'anthropic/claude-3.5-sonnet', 'Cassandra premium model'),
  ('model_chat', 'openai/gpt-4o-mini', 'Chat follow-up model'),
  ('cost_basic', '1', 'Credits for basic analysis'),
  ('cost_cassandra', '1', 'Credits for Cassandra'),
  ('chat_daily_limit', '50', 'Free chat messages per day'),
  ('inactive_reminder_days', '7', 'Days before inactive reminder');
```

---

## Relationships

```
auth.users (Supabase Auth)
    │
    ├──▶ profiles (1:1)
    │       └── Extended with onboarding fields
    │
    ├──▶ user_credits (1:1) [existing]
    │       └── basic_credits, cassandra_credits
    │
    ├──▶ user_states (1:1)
    │       └── current_mode, flow_step, buffer_data
    │
    ├──▶ chat_messages (1:N)
    │       └── Conversation history, analysis results
    │
    └──▶ scheduled_messages (1:N)
            └── Proactive engagement queue
```

---

## State Transitions

### user_states.current_mode

```
                    ┌─────────────┐
                    │    idle     │◀──────────────────┐
                    └─────────────┘                   │
                          │                           │
           ┌──────────────┼──────────────┐           │
           ▼              ▼              ▼           │
    ┌───────────┐  ┌───────────┐  ┌───────────┐     │
    │ onboarding│  │ processing│  │   chat    │     │
    └───────────┘  └───────────┘  └───────────┘     │
           │              │              │           │
           └──────────────┴──────────────┴───────────┘
                    (on completion)
```

**Transitions**:
- `idle` → `onboarding`: /start command (new user)
- `idle` → `processing`: Photo received
- `onboarding` → `idle`: Onboarding completed or abandoned
- `processing` → `idle`: Analysis completed or failed (+ TTL 5 min auto-cleanup)

### scheduled_messages.status

```
    pending ──▶ sent
        │
        └────▶ failed
        │
        └────▶ cancelled
```

---

## Validation Rules

### profiles

| Field | Validation |
|-------|------------|
| name | 1-100 characters, no special chars |
| goals | Array of valid goal IDs: 'career', 'relationships', 'health', 'finance', 'spiritual' |
| notification_frequency | Enum: 'daily', 'weekly', 'never' |
| timezone | Valid IANA timezone |
| daily_chat_count | >= 0, reset when date changes |

### chat_messages

| Field | Validation |
|-------|------------|
| role | Enum: 'user', 'assistant', 'system' |
| content | Non-empty string |
| message_type | Enum: 'photo_analysis', 'chat', 'cassandra', 'onboarding', null |
| metadata.cost_usd | >= 0 if present |
| metadata.tokens_used | >= 0 if present |

### user_states

| Field | Validation |
|-------|------------|
| current_mode | Enum: 'idle', 'onboarding', 'processing' |
| flow_step | Valid step ID for current mode |
| buffer_data | Valid JSON, max 10KB |

---

## TypeScript Types

```typescript
// src/types/database.ts

export interface Profile {
  id: string;
  telegram_user_id: number | null;
  name: string | null;
  goals: string[] | null;
  notification_frequency: 'daily' | 'weekly' | 'never';
  onboarding_completed: boolean;
  timezone: string;
  last_analysis_at: Date | null;
  last_interaction_at: Date | null;
  daily_chat_count: number;
  daily_chat_reset_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  telegram_user_id: number;
  session_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'photo_analysis' | 'chat' | 'cassandra' | 'onboarding' | null;
  metadata: ChatMessageMetadata;
  created_at: Date;
}

export interface ChatMessageMetadata {
  vision_result?: string;
  tokens_used?: number;
  cost_usd?: number;
  model_used?: string;
  photo_path?: string;
  retention_until?: Date;
}

export interface UserState {
  user_id: string;
  telegram_user_id: number;
  current_mode: 'idle' | 'onboarding' | 'processing';
  flow_step: string | null;
  buffer_data: Record<string, unknown>;
  updated_at: Date;
}

export interface ScheduledMessage {
  id: string;
  user_id: string;
  telegram_user_id: number;
  message_type: 'inactive_reminder' | 'weekly_checkin' | 'daily_fortune' | 'abandoned_onboarding';
  scheduled_for: Date;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: Date | null;
  error: string | null;
  created_at: Date;
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: Date;
}
```

---

## Migration Script

Full migration in `symancy-backend/migrations/003_backend_tables.sql`.

See TZ_BACKEND_MIGRATION.md Section 4 for complete SQL.
