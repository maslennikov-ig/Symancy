# Data Model: Omnichannel Chat Architecture

**Feature**: 004-omnichannel-chat
**Date**: 2025-12-27
**Status**: Complete

## Entity Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  unified_users (1) ─────────┬──── (1) user_credits                      │
│       │                     │                                            │
│       │ (1:N)               │                                            │
│       ▼                     │                                            │
│  conversations (N) ─────────┤                                            │
│       │                     │                                            │
│       │ (1:N)               │                                            │
│       ▼                     │                                            │
│  messages (N) ──────────────┤                                            │
│       │                     │                                            │
│       │ (1:N)               │                                            │
│       ▼                     │                                            │
│  message_deliveries (N)     │                                            │
│                             │                                            │
│  link_tokens (N) ───────────┘                                            │
│                                                                          │
│  Existing tables (to be extended):                                       │
│  - profiles (add unified_user_id FK)                                     │
│  - purchases (add unified_user_id FK)                                    │
│  - analysis_history (add unified_user_id FK)                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### 1. unified_users

**Purpose**: Central identity table unifying users across all channels. Telegram ID is the primary anchor.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| telegram_id | BIGINT | YES | - | Telegram user ID (primary anchor, UNIQUE) |
| auth_id | UUID | YES | - | Supabase auth.users.id (UNIQUE) |
| whatsapp_phone | TEXT | YES | - | WhatsApp phone E.164 format (future, UNIQUE) |
| wechat_openid | TEXT | YES | - | WeChat OpenID (future, UNIQUE) |
| display_name | TEXT | YES | - | User's display name |
| avatar_url | TEXT | YES | - | Profile photo URL |
| language_code | TEXT | NO | 'ru' | Preferred language: ru, en, zh |
| timezone | TEXT | NO | 'Europe/Moscow' | User timezone |
| is_telegram_linked | BOOLEAN | NO | false | True when telegram_id is set |
| onboarding_completed | BOOLEAN | NO | false | Onboarding flow status |
| is_banned | BOOLEAN | NO | false | Ban status |
| primary_interface | TEXT | NO | 'bot' | Preferred Telegram interface: bot, webapp |
| notification_settings | JSONB | NO | '{"enabled": true}' | Notification preferences |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | now() | Last update timestamp |
| last_active_at | TIMESTAMPTZ | NO | now() | Last activity timestamp |
| daily_messages_count | INTEGER | NO | 0 | Daily message counter |
| daily_messages_reset_at | DATE | NO | CURRENT_DATE | Reset date for daily limit |

**Constraints**:
- `at_least_one_identity`: CHECK (telegram_id IS NOT NULL OR auth_id IS NOT NULL)
- `language_code_check`: CHECK (language_code IN ('ru', 'en', 'zh'))
- UNIQUE on: telegram_id, auth_id, whatsapp_phone, wechat_openid

**Indexes**:
- `idx_unified_users_telegram`: ON telegram_id WHERE telegram_id IS NOT NULL
- `idx_unified_users_auth`: ON auth_id WHERE auth_id IS NOT NULL
- `idx_unified_users_active`: ON last_active_at DESC

---

### 2. user_credits (Extended)

**Purpose**: Shared credit balance across all channels. Links to unified_users instead of auth.users.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| unified_user_id | UUID | NO | - | FK to unified_users.id |
| credits_basic | INTEGER | NO | 0 | Basic analysis credits |
| credits_pro | INTEGER | NO | 0 | Pro analysis credits |
| credits_cassandra | INTEGER | NO | 0 | Cassandra analysis credits |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | now() | Last update timestamp |

**Constraints**:
- `credits_basic_positive`: CHECK (credits_basic >= 0)
- `credits_pro_positive`: CHECK (credits_pro >= 0)
- `credits_cassandra_positive`: CHECK (credits_cassandra >= 0)
- UNIQUE on: unified_user_id

**Note**: This replaces the existing `user_credits` table that links to `auth.users`. Migration will merge both credit systems.

---

### 3. conversations

**Purpose**: Chat sessions with a specific AI persona, containing message context.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| unified_user_id | UUID | NO | - | FK to unified_users.id |
| persona | TEXT | NO | 'arina' | AI persona: arina, cassandra |
| status | TEXT | NO | 'active' | Status: active, archived, deleted |
| context | JSONB | NO | '{}' | LLM context accumulation |
| summary | TEXT | YES | - | Conversation summary for long chats |
| message_count | INTEGER | NO | 0 | Total messages in conversation |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | now() | Last update timestamp |
| last_message_at | TIMESTAMPTZ | YES | - | Last message timestamp |

**Constraints**:
- `persona_check`: CHECK (persona IN ('arina', 'cassandra'))
- `status_check`: CHECK (status IN ('active', 'archived', 'deleted'))

**Indexes**:
- `idx_conversations_user_status`: ON (unified_user_id, status)
- `idx_conversations_active`: ON unified_user_id WHERE status = 'active'

---

### 4. messages

**Purpose**: All messages across all channels and interfaces, with source tracking.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| conversation_id | UUID | NO | - | FK to conversations.id |
| channel | TEXT | NO | - | Source channel: telegram, web, whatsapp, wechat |
| interface | TEXT | NO | - | Source interface: bot, webapp, browser, api, miniprogram |
| role | TEXT | NO | - | Message role: user, assistant, system |
| content | TEXT | NO | - | Message content |
| content_type | TEXT | NO | 'text' | Content type: text, image, analysis, audio, document |
| reply_to_message_id | UUID | YES | - | FK to messages.id (threading) |
| metadata | JSONB | NO | '{}' | Channel-specific data (telegram_message_id, etc.) |
| processing_status | TEXT | NO | 'completed' | Status: pending, processing, completed, failed |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |

**Constraints**:
- `channel_check`: CHECK (channel IN ('telegram', 'web', 'whatsapp', 'wechat'))
- `interface_check`: CHECK (interface IN ('bot', 'webapp', 'browser', 'api', 'miniprogram'))
- `role_check`: CHECK (role IN ('user', 'assistant', 'system'))
- `content_type_check`: CHECK (content_type IN ('text', 'image', 'analysis', 'audio', 'document'))
- `processing_status_check`: CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))

**Indexes**:
- `idx_messages_conversation`: ON (conversation_id, created_at DESC)
- `idx_messages_channel`: ON (channel, interface)
- `idx_messages_pending`: ON processing_status WHERE processing_status IN ('pending', 'processing')

---

### 5. message_deliveries

**Purpose**: Track delivery status per message for retry logic and analytics.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| message_id | UUID | NO | - | FK to messages.id |
| target_channel | TEXT | NO | - | Target channel |
| target_interface | TEXT | NO | - | Target interface |
| status | TEXT | NO | 'pending' | Status: pending, sent, delivered, read, failed |
| external_message_id | TEXT | YES | - | ID in external system (telegram_message_id) |
| error_message | TEXT | YES | - | Error details if failed |
| retry_count | INTEGER | NO | 0 | Number of retry attempts |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |
| sent_at | TIMESTAMPTZ | YES | - | When sent |
| delivered_at | TIMESTAMPTZ | YES | - | When delivered |

**Constraints**:
- `status_check`: CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'))
- UNIQUE on: (message_id, target_channel, target_interface)

**Indexes**:
- `idx_deliveries_pending`: ON status WHERE status = 'pending'
- `idx_deliveries_message`: ON message_id

---

### 6. link_tokens

**Purpose**: One-time tokens for cross-channel account linking (e.g., /link command).

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| unified_user_id | UUID | NO | - | FK to unified_users.id |
| token | TEXT | NO | - | Unique token string (UNIQUE) |
| source_channel | TEXT | NO | - | Channel that initiated linking |
| expires_at | TIMESTAMPTZ | NO | - | Expiration time (10 minutes) |
| used_at | TIMESTAMPTZ | YES | - | When token was used |
| created_at | TIMESTAMPTZ | NO | now() | Creation timestamp |

**Constraints**:
- UNIQUE on: token

**Indexes**:
- `idx_link_tokens_token`: ON token WHERE used_at IS NULL
- `idx_link_tokens_cleanup`: ON expires_at WHERE used_at IS NULL

---

## Enumerations (TypeScript)

```typescript
// src/types/omnichannel.ts

export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'wechat';

export type InterfaceType = 'bot' | 'webapp' | 'browser' | 'api' | 'miniprogram';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ContentType = 'text' | 'image' | 'analysis' | 'audio' | 'document';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type ConversationStatus = 'active' | 'archived' | 'deleted';

export type Persona = 'arina' | 'cassandra';

export type LanguageCode = 'ru' | 'en' | 'zh';
```

---

## State Transitions

### Conversation Status

```
                 ┌─────────┐
                 │ active  │ ← Initial state
                 └────┬────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    ┌──────────┐           ┌───────────┐
    │ archived │           │  deleted  │ ← Terminal state
    └──────────┘           └───────────┘
```

### Message Processing Status

```
    ┌─────────┐
    │ pending │ ← Initial state (user message received)
    └────┬────┘
         │
         ▼
  ┌────────────┐
  │ processing │ ← LLM generating response
  └──────┬─────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────────┐ ┌────────┐
│ completed │ │ failed │
└───────────┘ └────────┘
```

### Delivery Status

```
    ┌─────────┐
    │ pending │ ← Initial state
    └────┬────┘
         │
         ▼
     ┌──────┐
     │ sent │ ← API call made
     └───┬──┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────────┐ ┌────────┐
│ delivered │ │ failed │
└─────┬─────┘ └────────┘
      │
      ▼
   ┌──────┐
   │ read │ ← If supported by channel
   └──────┘
```

---

## Validation Rules (Zod Schemas)

```typescript
// src/types/omnichannel.schemas.ts
import { z } from 'zod';

export const ChannelSchema = z.enum(['telegram', 'web', 'whatsapp', 'wechat']);
export const InterfaceSchema = z.enum(['bot', 'webapp', 'browser', 'api', 'miniprogram']);
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const PersonaSchema = z.enum(['arina', 'cassandra']);
export const LanguageCodeSchema = z.enum(['ru', 'en', 'zh']);

export const UnifiedUserSchema = z.object({
  id: z.string().uuid(),
  telegram_id: z.number().int().positive().optional(),
  auth_id: z.string().uuid().optional(),
  display_name: z.string().max(255).optional(),
  language_code: LanguageCodeSchema.default('ru'),
  is_telegram_linked: z.boolean().default(false),
  onboarding_completed: z.boolean().default(false),
}).refine(
  data => data.telegram_id !== undefined || data.auth_id !== undefined,
  { message: 'At least one identity (telegram_id or auth_id) must be provided' }
);

export const MessageSchema = z.object({
  conversation_id: z.string().uuid(),
  channel: ChannelSchema,
  interface: InterfaceSchema,
  role: MessageRoleSchema,
  content: z.string().min(1).max(10000),
  content_type: z.enum(['text', 'image', 'analysis', 'audio', 'document']).default('text'),
});

export const TelegramAuthSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string(),
});
```

---

## Migration Path

### Phase 1: Create New Tables

1. `unified_users` - Core identity table
2. `conversations` - Chat sessions
3. `messages` - All messages
4. `message_deliveries` - Delivery tracking
5. `link_tokens` - Account linking

### Phase 2: Data Migration

1. `profiles` → `unified_users`
   - Copy telegram_id, name, language_code, etc.
   - Set is_telegram_linked = true for all

2. `chat_messages` → `messages`
   - Create one conversation per user
   - Map telegram_user_id → unified_user_id → conversation_id
   - Set channel='telegram', interface='bot' for all historical

3. `user_credits` + `backend_user_credits` → new `user_credits`
   - Merge by matching telegram_id/auth_id
   - Sum credits if overlap

### Phase 3: Add Foreign Keys

1. `profiles.unified_user_id` → `unified_users.id`
2. `purchases.unified_user_id` → `unified_users.id`
3. `analysis_history.unified_user_id` → `unified_users.id`

### Phase 4: RLS Policies

Apply Row Level Security to all new tables (see contracts/rls.sql).

---

## Database Helper Functions

### find_or_create_user_by_telegram

```sql
CREATE OR REPLACE FUNCTION find_or_create_user_by_telegram(
  p_telegram_id BIGINT,
  p_display_name TEXT DEFAULT NULL,
  p_language_code TEXT DEFAULT 'ru'
) RETURNS unified_users AS $$
-- See OMNICHANNEL_ARCHITECTURE.md for full implementation
$$;
```

### link_auth_to_telegram_user

```sql
CREATE OR REPLACE FUNCTION link_auth_to_telegram_user(
  p_telegram_id BIGINT,
  p_auth_id UUID
) RETURNS unified_users AS $$
-- Handles account merging when linking existing web account to Telegram
$$;
```

### get_or_create_conversation

```sql
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_unified_user_id UUID,
  p_persona TEXT DEFAULT 'arina'
) RETURNS conversations AS $$
-- Returns active conversation or creates new one
$$;
```

---

## Realtime Configuration

```sql
-- Enable Realtime for message sync
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE user_credits; -- For credit balance updates
```

---

## Image/Photo Handling

Messages with images store references in `metadata` JSONB:

```typescript
interface ImageMessageMetadata {
  // For Telegram images
  telegram_file_id?: string;
  telegram_file_unique_id?: string;

  // Unified storage (Supabase Storage)
  image_url?: string;
  image_storage_path?: string;  // e.g., 'messages/{conversation_id}/{message_id}.jpg'

  // Analysis reference (if coffee reading)
  analysis_id?: string;
}
```

**Flow**: Telegram photo → Download via Bot API → Upload to Supabase Storage → Store both `telegram_file_id` and `image_url`.

---

## Daily Message Limits

Helper function for rate limiting:

```sql
CREATE OR REPLACE FUNCTION check_and_increment_daily_limit(
  p_unified_user_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS BOOLEAN AS $$
DECLARE
  v_user unified_users;
BEGIN
  SELECT * INTO v_user FROM unified_users WHERE id = p_unified_user_id FOR UPDATE;

  -- Reset if new day
  IF v_user.daily_messages_reset_at < CURRENT_DATE THEN
    UPDATE unified_users
    SET daily_messages_count = 1, daily_messages_reset_at = CURRENT_DATE
    WHERE id = p_unified_user_id;
    RETURN true;
  END IF;

  -- Check limit
  IF v_user.daily_messages_count >= p_limit THEN
    RETURN false;
  END IF;

  -- Increment
  UPDATE unified_users
  SET daily_messages_count = daily_messages_count + 1
  WHERE id = p_unified_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

---

## Web-only User Limitations

Users without linked Telegram have restricted features:

| Feature | With Telegram | Web-only |
|---------|---------------|----------|
| Proactive messages | ✅ Engagement, reminders | ❌ Not possible |
| Offline delivery | ✅ Messages queue in Telegram | ❌ Only when tab open |
| Push notifications | ✅ Native Telegram | ❌ Browser only |
| Account recovery | ✅ telegram_id never changes | ⚠️ Depends on email/OAuth |
| WebApp | ✅ Rich embedded experience | ❌ Not available |
| Full credits access | ✅ Shared across channels | ⚠️ Isolated until linked |

**UI Requirement**: Show `TelegramLinkPrompt` component for users where `is_telegram_linked = false`.
