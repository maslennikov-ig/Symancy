# Omnichannel Chat Architecture

> **Status**: Draft → In Review
> **Created**: 2025-12-27
> **Last Updated**: 2025-12-27

## 1. Overview

Единая система общения, позволяющая пользователю взаимодействовать через любой канал с сохранением контекста, истории и credits.

### 1.1 Core Principles

1. **Telegram as Anchor** - Telegram ID как основной идентификатор пользователя
2. **Channel + Interface** - Канал определяет identity, интерфейс определяет delivery
3. **Reply to Source** - Ответ идёт в тот же канал/интерфейс, откуда пришло сообщение
4. **Proactive via Messenger** - Проактивные сообщения только через мессенджеры (не Web)
5. **Mandatory Auth** - Авторизация обязательна на всех каналах
6. **Shared Credits** - Credits общие для всех связанных каналов

### 1.2 Channel & Interface Model

```
┌─────────────────────────────────────────────────────────────────┐
│              CHANNELS (Identity) + INTERFACES (Delivery)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CHANNEL          │ INTERFACES        │ IDENTITY KEY            │
│  ─────────────────│───────────────────│──────────────────────── │
│  telegram         │ bot, webapp       │ telegram_id (BIGINT)    │
│  whatsapp         │ api               │ phone (TEXT)            │
│  wechat           │ miniprogram       │ openid (TEXT)           │
│  web              │ browser           │ auth_id (UUID)          │
│                                                                 │
│  CHANNEL = кто пользователь (identity)                          │
│  INTERFACE = как доставить ответ (delivery method)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Supported Channels

| Channel | Interfaces | Status | Priority | Proactive |
|---------|------------|--------|----------|-----------|
| telegram | bot, webapp | MVP | P0 | Yes |
| web | browser | MVP | P1 | No |
| whatsapp | api | Future | P2 | Yes (templates) |
| wechat | miniprogram | Future | P2 | Yes |
| viber | api | Future | P3 | Yes |

---

## 2. Telegram as Primary Identity (Anchor Pattern)

### 2.1 Why Telegram as Anchor

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM AS ANCHOR                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Преимущества:                                                  │
│  ✓ telegram_id никогда не меняется                              │
│  ✓ Telegram #1 мессенджер в РФ/СНГ                              │
│  ✓ Telegram Login Widget - проверенная технология               │
│  ✓ Один источник правды для identity                            │
│  ✓ Упрощает UX - "Войти через Telegram" понятно всем            │
│                                                                 │
│                 ┌──────────────────┐                            │
│                 │     TELEGRAM     │  ← Primary Identity        │
│                 │   telegram_id    │     (Anchor)               │
│                 └────────┬─────────┘                            │
│                          │                                      │
│           ┌──────────────┼──────────────┐                       │
│           ▼              ▼              ▼                       │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│     │   Web    │  │ WhatsApp │  │  WeChat  │                    │
│     │ auth_id  │  │  phone   │  │  openid  │                    │
│     └──────────┘  └──────────┘  └──────────┘                    │
│                                                                 │
│     Все каналы ПРИВЯЗЫВАЮТСЯ к Telegram                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 User Journey Scenarios

**Scenario A: Start from Telegram (Primary Flow - 90%)**
```
1. User → Telegram Bot
   └── Creates unified_user with telegram_id
   └── is_telegram_linked = true

2. User → Opens Web, clicks "Login with Telegram"
   └── Telegram Login Widget
   └── Links auth_id to existing unified_user

3. User → Opens WebApp from Bot
   └── Same telegram_id, interface = 'webapp'
   └── Auto-recognized, no linking needed
```

**Scenario B: Start from Web (Edge Case - 10%)**
```
1. User → Web registration (email/OAuth)
   └── Creates unified_user with auth_id only
   └── is_telegram_linked = false
   └── UI shows: "Connect Telegram for full access"

2. User → Clicks "Connect Telegram"
   └── Telegram Login Widget
   └── Links telegram_id to unified_user
   └── is_telegram_linked = true
   └── Now Telegram is the anchor
```

### 2.3 Telegram WebApp = Same Channel, Different Interface

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM CHANNEL                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    telegram_id: 123456                  │    │
│  │                    (same user)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│            ┌─────────────┴─────────────┐                        │
│            ▼                           ▼                        │
│     ┌────────────┐              ┌────────────┐                  │
│     │ interface: │              │ interface: │                  │
│     │   'bot'    │              │  'webapp'  │                  │
│     ├────────────┤              ├────────────┤                  │
│     │ Delivery:  │              │ Delivery:  │                  │
│     │ sendMessage│              │ Realtime   │                  │
│     │ via API    │              │ WebSocket  │                  │
│     ├────────────┤              ├────────────┤                  │
│     │ UI: basic  │              │ UI: rich   │                  │
│     │ text/photo │              │ React app  │                  │
│     └────────────┘              └────────────┘                  │
│                                                                 │
│  User message from bot    → Response via bot API                │
│  User message from webapp → Response via Realtime               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA MODEL                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  unified_users  │ ← Core identity table                      │
│  ├─────────────────┤                                            │
│  │ id (PK)         │                                            │
│  │ telegram_id     │ ← Primary anchor (UNIQUE)                  │
│  │ auth_id         │ ← Web identity (UNIQUE)                    │
│  │ whatsapp_phone  │ ← Future (UNIQUE)                          │
│  │ wechat_openid   │ ← Future (UNIQUE)                          │
│  │ display_name    │                                            │
│  │ is_telegram_linked │                                         │
│  └────────┬────────┘                                            │
│           │                                                     │
│           │ 1:1                                                  │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │  user_credits   │ ← Shared across ALL channels               │
│  ├─────────────────┤                                            │
│  │ unified_user_id │                                            │
│  │ credits_basic   │                                            │
│  │ credits_pro     │                                            │
│  │ credits_cassandra│                                           │
│  └─────────────────┘                                            │
│           │                                                     │
│           │ 1:N                                                  │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │  conversations  │ ← Chat sessions                            │
│  ├─────────────────┤                                            │
│  │ id (PK)         │                                            │
│  │ unified_user_id │                                            │
│  │ persona         │ ← 'arina' | 'cassandra'                    │
│  │ status          │                                            │
│  │ context (JSONB) │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           │ 1:N                                                  │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │    messages     │ ← All messages, all channels               │
│  ├─────────────────┤                                            │
│  │ id (PK)         │                                            │
│  │ conversation_id │                                            │
│  │ channel         │ ← 'telegram' | 'web' | 'whatsapp'          │
│  │ interface       │ ← 'bot' | 'webapp' | 'browser'             │
│  │ role            │ ← 'user' | 'assistant' | 'system'          │
│  │ content         │                                            │
│  │ metadata (JSONB)│                                            │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Database Schema

```sql
-- ============================================================
-- UNIFIED USERS
-- Core identity table with Telegram as anchor
-- ============================================================
CREATE TABLE unified_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PRIMARY IDENTITY (Telegram as Anchor)
  telegram_id BIGINT UNIQUE,           -- Telegram user ID (primary)

  -- SECONDARY IDENTITIES (linked to Telegram)
  auth_id UUID UNIQUE,                 -- Supabase auth.users.id (Web)
  whatsapp_phone TEXT UNIQUE,          -- WhatsApp phone number (future)
  wechat_openid TEXT UNIQUE,           -- WeChat OpenID (future)

  -- PROFILE
  display_name TEXT,
  avatar_url TEXT,
  language_code TEXT DEFAULT 'ru' CHECK (language_code IN ('ru', 'en', 'zh')),
  timezone TEXT DEFAULT 'Europe/Moscow',

  -- STATE
  is_telegram_linked BOOLEAN DEFAULT false,  -- True when telegram_id is set
  onboarding_completed BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,

  -- PREFERENCES
  primary_interface TEXT DEFAULT 'bot',      -- Preferred Telegram interface
  notification_settings JSONB DEFAULT '{"enabled": true}',

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),

  -- CONSTRAINTS
  -- At least one identity must be present
  CONSTRAINT at_least_one_identity CHECK (
    telegram_id IS NOT NULL OR auth_id IS NOT NULL
  )
);

-- Indexes for fast lookup by any identity
CREATE INDEX idx_unified_users_telegram ON unified_users(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_unified_users_auth ON unified_users(auth_id) WHERE auth_id IS NOT NULL;
CREATE INDEX idx_unified_users_whatsapp ON unified_users(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

-- ============================================================
-- USER CREDITS
-- Shared across ALL channels (one record per unified_user)
-- ============================================================
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,

  credits_basic INTEGER DEFAULT 0 CHECK (credits_basic >= 0),
  credits_pro INTEGER DEFAULT 0 CHECK (credits_pro >= 0),
  credits_cassandra INTEGER DEFAULT 0 CHECK (credits_cassandra >= 0),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(unified_user_id)
);

CREATE INDEX idx_user_credits_user ON user_credits(unified_user_id);

-- ============================================================
-- CONVERSATIONS
-- Chat sessions with persona and context
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,

  -- SETTINGS
  persona TEXT DEFAULT 'arina' CHECK (persona IN ('arina', 'cassandra')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

  -- CONTEXT FOR LLM
  context JSONB DEFAULT '{}',          -- Accumulated context
  summary TEXT,                         -- Conversation summary for long chats

  -- STATS
  message_count INTEGER DEFAULT 0,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user ON conversations(unified_user_id, status);
CREATE INDEX idx_conversations_active ON conversations(unified_user_id) WHERE status = 'active';

-- ============================================================
-- MESSAGES
-- All messages across all channels and interfaces
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- SOURCE TRACKING (Channel + Interface)
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'web', 'whatsapp', 'wechat')),
  interface TEXT NOT NULL CHECK (interface IN ('bot', 'webapp', 'browser', 'api', 'miniprogram')),

  -- MESSAGE CONTENT
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'analysis', 'audio', 'document')),

  -- THREADING
  reply_to_message_id UUID REFERENCES messages(id),

  -- CHANNEL-SPECIFIC DATA
  metadata JSONB DEFAULT '{}',         -- telegram_message_id, etc.

  -- PROCESSING
  processing_status TEXT DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_channel ON messages(channel, interface);
CREATE INDEX idx_messages_pending ON messages(processing_status) WHERE processing_status IN ('pending', 'processing');

-- ============================================================
-- MESSAGE DELIVERIES
-- Tracks delivery status per message (for retries, analytics)
-- ============================================================
CREATE TABLE message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  -- TARGET
  target_channel TEXT NOT NULL,
  target_interface TEXT NOT NULL,

  -- DELIVERY STATUS
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),

  -- EXTERNAL REFERENCE
  external_message_id TEXT,            -- ID in target system (telegram_message_id, etc.)
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  UNIQUE(message_id, target_channel, target_interface)
);

CREATE INDEX idx_deliveries_pending ON message_deliveries(status) WHERE status = 'pending';

-- ============================================================
-- LINK TOKENS
-- For cross-channel account linking
-- ============================================================
CREATE TABLE link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES unified_users(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  source_channel TEXT NOT NULL,        -- Channel that initiated linking

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_link_tokens_token ON link_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_link_tokens_cleanup ON link_tokens(expires_at) WHERE used_at IS NULL;

-- ============================================================
-- REALTIME PUBLICATION
-- Enable Supabase Realtime for live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- unified_users: Users can only see/edit their own record
ALTER TABLE unified_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON unified_users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON unified_users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- Service role (backend) has full access via service_role key
-- No policy needed - service_role bypasses RLS

-- user_credits: Users can only view their own credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (
    unified_user_id IN (
      SELECT id FROM unified_users WHERE auth_id = auth.uid()
    )
  );

-- conversations: Users can only see their own conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    unified_user_id IN (
      SELECT id FROM unified_users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    unified_user_id IN (
      SELECT id FROM unified_users WHERE auth_id = auth.uid()
    )
  );

-- messages: Users can only see messages in their conversations
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN unified_users u ON c.unified_user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN unified_users u ON c.unified_user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- message_deliveries: Users can view delivery status for their messages
ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own message deliveries"
  ON message_deliveries FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN unified_users u ON c.unified_user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- link_tokens: Users can only see their own tokens
ALTER TABLE link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link tokens"
  ON link_tokens FOR SELECT
  TO authenticated
  USING (
    unified_user_id IN (
      SELECT id FROM unified_users WHERE auth_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to find or create unified user by telegram_id
CREATE OR REPLACE FUNCTION find_or_create_user_by_telegram(
  p_telegram_id BIGINT,
  p_display_name TEXT DEFAULT NULL,
  p_language_code TEXT DEFAULT 'ru'
) RETURNS unified_users AS $$
DECLARE
  v_user unified_users;
BEGIN
  -- Try to find existing user
  SELECT * INTO v_user FROM unified_users WHERE telegram_id = p_telegram_id;

  IF v_user.id IS NOT NULL THEN
    -- Update last_active_at
    UPDATE unified_users SET last_active_at = now() WHERE id = v_user.id;
    RETURN v_user;
  END IF;

  -- Create new user
  INSERT INTO unified_users (telegram_id, display_name, language_code, is_telegram_linked)
  VALUES (p_telegram_id, p_display_name, p_language_code, true)
  RETURNING * INTO v_user;

  -- Create credits record
  INSERT INTO user_credits (unified_user_id) VALUES (v_user.id);

  RETURN v_user;
END;
$$ LANGUAGE plpgsql;

-- Function to link auth_id to existing telegram user
CREATE OR REPLACE FUNCTION link_auth_to_telegram_user(
  p_telegram_id BIGINT,
  p_auth_id UUID
) RETURNS unified_users AS $$
DECLARE
  v_user unified_users;
  v_existing_auth unified_users;
BEGIN
  -- Check if auth_id already linked to another user
  SELECT * INTO v_existing_auth FROM unified_users WHERE auth_id = p_auth_id;

  IF v_existing_auth.id IS NOT NULL THEN
    -- Merge accounts (auth user into telegram user)
    -- Move any data from auth user to telegram user
    -- Then delete auth user

    -- Get telegram user
    SELECT * INTO v_user FROM unified_users WHERE telegram_id = p_telegram_id;

    IF v_user.id IS NULL THEN
      RAISE EXCEPTION 'Telegram user not found';
    END IF;

    -- Merge credits
    UPDATE user_credits
    SET
      credits_basic = credits_basic + COALESCE((SELECT credits_basic FROM user_credits WHERE unified_user_id = v_existing_auth.id), 0),
      credits_pro = credits_pro + COALESCE((SELECT credits_pro FROM user_credits WHERE unified_user_id = v_existing_auth.id), 0),
      credits_cassandra = credits_cassandra + COALESCE((SELECT credits_cassandra FROM user_credits WHERE unified_user_id = v_existing_auth.id), 0)
    WHERE unified_user_id = v_user.id;

    -- Move conversations
    UPDATE conversations SET unified_user_id = v_user.id WHERE unified_user_id = v_existing_auth.id;

    -- Delete old user (cascades credits)
    DELETE FROM unified_users WHERE id = v_existing_auth.id;

    -- Link auth_id to telegram user
    UPDATE unified_users SET auth_id = p_auth_id WHERE id = v_user.id RETURNING * INTO v_user;

    RETURN v_user;
  END IF;

  -- Simple case: just link auth_id
  UPDATE unified_users
  SET auth_id = p_auth_id, updated_at = now()
  WHERE telegram_id = p_telegram_id
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create active conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_unified_user_id UUID,
  p_persona TEXT DEFAULT 'arina'
) RETURNS conversations AS $$
DECLARE
  v_conversation conversations;
BEGIN
  -- Try to find active conversation
  SELECT * INTO v_conversation
  FROM conversations
  WHERE unified_user_id = p_unified_user_id
    AND status = 'active'
    AND persona = p_persona
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;

  IF v_conversation.id IS NOT NULL THEN
    RETURN v_conversation;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (unified_user_id, persona)
  VALUES (p_unified_user_id, p_persona)
  RETURNING * INTO v_conversation;

  RETURN v_conversation;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Message Routing

### 4.1 Routing Rules

```
┌─────────────────────────────────────────────────────────────────┐
│                     MESSAGE ROUTING RULES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RULE 1: Response → Same Channel + Interface                    │
│  ─────────────────────────────────────────────────────────────  │
│  User writes from telegram/bot    → Reply to telegram/bot       │
│  User writes from telegram/webapp → Reply to telegram/webapp    │
│  User writes from web/browser     → Reply to web/browser        │
│                                                                 │
│  RULE 2: Proactive → Messenger Only (NOT web)                   │
│  ─────────────────────────────────────────────────────────────  │
│  Engagement message  → telegram/bot (primary interface)         │
│  Reminder            → telegram/bot                             │
│  Notification        → telegram/bot                             │
│  NEVER send proactive to web/browser                            │
│                                                                 │
│  RULE 3: Parallel Messages → Independent Routing                │
│  ─────────────────────────────────────────────────────────────  │
│  User sends from bot at 10:00:00    → Response to bot           │
│  User sends from webapp at 10:00:01 → Response to webapp        │
│  (Each message processed and routed independently)              │
│                                                                 │
│  RULE 4: WebApp ⊂ Telegram (Same Identity)                      │
│  ─────────────────────────────────────────────────────────────  │
│  telegram/bot and telegram/webapp share same telegram_id        │
│  Same conversation, same credits, same history                  │
│  Only delivery method differs                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Routing Service

```typescript
// services/routing/MessageRouter.ts

import { ChannelType, InterfaceType, Message, UnifiedUser } from '@/types';

interface RoutingDecision {
  channel: ChannelType;
  interface: InterfaceType;
  deliveryMethod: 'telegram_api' | 'realtime' | 'whatsapp_api';
}

export class MessageRouter {
  /**
   * Route response to same channel/interface as source message
   */
  routeResponse(sourceMessage: Message): RoutingDecision {
    return {
      channel: sourceMessage.channel,
      interface: sourceMessage.interface,
      deliveryMethod: this.getDeliveryMethod(sourceMessage.channel, sourceMessage.interface),
    };
  }

  /**
   * Route proactive message (engagement, reminder, notification)
   * NEVER routes to web - only messengers
   */
  routeProactive(user: UnifiedUser): RoutingDecision {
    // Always use telegram if available (primary anchor)
    if (user.telegram_id) {
      return {
        channel: 'telegram',
        interface: user.primary_interface || 'bot', // User preference
        deliveryMethod: 'telegram_api',
      };
    }

    // Fallback to WhatsApp if available (future)
    if (user.whatsapp_phone) {
      return {
        channel: 'whatsapp',
        interface: 'api',
        deliveryMethod: 'whatsapp_api',
      };
    }

    // No messenger available - cannot send proactive
    throw new NoMessengerChannelError(user.id);
  }

  private getDeliveryMethod(
    channel: ChannelType,
    iface: InterfaceType
  ): 'telegram_api' | 'realtime' | 'whatsapp_api' {
    // Telegram bot uses API
    if (channel === 'telegram' && iface === 'bot') {
      return 'telegram_api';
    }

    // WebApp and Web use Realtime
    if (iface === 'webapp' || channel === 'web') {
      return 'realtime';
    }

    // WhatsApp uses API
    if (channel === 'whatsapp') {
      return 'whatsapp_api';
    }

    return 'realtime';
  }
}
```

### 4.3 Delivery Methods

```typescript
// services/delivery/DeliveryService.ts

export class DeliveryService {
  constructor(
    private telegramBot: Bot,
    private supabase: SupabaseClient,
  ) {}

  async deliver(message: Message, routing: RoutingDecision): Promise<DeliveryResult> {
    switch (routing.deliveryMethod) {
      case 'telegram_api':
        return this.deliverViaTelegram(message, routing);

      case 'realtime':
        return this.deliverViaRealtime(message);

      case 'whatsapp_api':
        return this.deliverViaWhatsApp(message, routing);

      default:
        throw new Error(`Unknown delivery method: ${routing.deliveryMethod}`);
    }
  }

  private async deliverViaTelegram(
    message: Message,
    routing: RoutingDecision
  ): Promise<DeliveryResult> {
    const user = await this.getUnifiedUser(message.conversation_id);

    const result = await this.telegramBot.api.sendMessage(
      user.telegram_id!,
      message.content,
      { parse_mode: 'HTML' }
    );

    return {
      success: true,
      externalMessageId: String(result.message_id),
      deliveredAt: new Date(),
    };
  }

  private async deliverViaRealtime(message: Message): Promise<DeliveryResult> {
    // Message is already in DB
    // Realtime subscription will push to client automatically
    // Just update delivery status

    await this.supabase
      .from('message_deliveries')
      .upsert({
        message_id: message.id,
        target_channel: message.channel,
        target_interface: message.interface,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      });

    return {
      success: true,
      deliveredAt: new Date(),
    };
  }
}
```

---

## 5. Account Linking

### 5.1 Linking Flow: Web → Telegram (Telegram Login Widget)

```
┌─────────────────────────────────────────────────────────────────┐
│              TELEGRAM LOGIN WIDGET FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User on Web clicks "Login with Telegram"                    │
│     ┌─────────────────────────────────────────┐                 │
│     │  [🔵 Login with Telegram]               │                 │
│     └─────────────────────────────────────────┘                 │
│                         │                                       │
│                         ▼                                       │
│  2. Telegram Login Widget appears (popup/redirect)              │
│     ┌─────────────────────────────────────────┐                 │
│     │  Telegram                               │                 │
│     │  ─────────────────────────────          │                 │
│     │  Symancy wants to access:               │                 │
│     │  • Your name                            │                 │
│     │  • Your profile photo                   │                 │
│     │                                         │                 │
│     │  [Accept]  [Cancel]                     │                 │
│     └─────────────────────────────────────────┘                 │
│                         │                                       │
│                         ▼                                       │
│  3. Telegram returns signed data                                │
│     {                                                           │
│       id: 123456789,                                            │
│       first_name: "Ivan",                                       │
│       username: "ivan",                                         │
│       photo_url: "...",                                         │
│       auth_date: 1703674800,                                    │
│       hash: "abc123..."  ← Cryptographic signature              │
│     }                                                           │
│                         │                                       │
│                         ▼                                       │
│  4. Backend verifies hash, links accounts                       │
│     - Verify hash with bot token                                │
│     - Find/create unified_user by telegram_id                   │
│     - Link auth_id (Supabase) to unified_user                   │
│     - Merge credits if needed                                   │
│                         │                                       │
│                         ▼                                       │
│  5. User is logged in with unified account                      │
│     - Same credits across Web and Telegram                      │
│     - Same conversation history                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Linking Flow: Telegram → Web (Link Command)

```
┌─────────────────────────────────────────────────────────────────┐
│              /link COMMAND FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User in Telegram Bot: /link                                 │
│                                                                 │
│  2. Bot generates one-time token (10 min expiry)                │
│     ┌─────────────────────────────────────────┐                 │
│     │ 🔗 Чтобы связать аккаунт:               │                 │
│     │                                         │                 │
│     │ Откройте ссылку:                        │                 │
│     │ https://symancy.ru/link?token=abc123    │                 │
│     │                                         │                 │
│     │ Ссылка действует 10 минут.              │                 │
│     └─────────────────────────────────────────┘                 │
│                         │                                       │
│                         ▼                                       │
│  3. User opens link in browser                                  │
│     - If not logged in → Redirect to login                      │
│     - If logged in → Verify token, link accounts                │
│                         │                                       │
│                         ▼                                       │
│  4. Success page                                                │
│     ┌─────────────────────────────────────────┐                 │
│     │ ✅ Аккаунты успешно связаны!            │                 │
│     │                                         │                 │
│     │ Теперь ваши credits и история           │                 │
│     │ доступны в обоих каналах.               │                 │
│     │                                         │                 │
│     │ [Вернуться в Telegram]                  │                 │
│     └─────────────────────────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Telegram Login Widget Implementation

```typescript
// Frontend: components/TelegramLoginButton.tsx

import { useEffect, useRef } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface Props {
  botName: string;
  onAuth: (user: TelegramUser) => void;
}

export function TelegramLoginButton({ botName, onAuth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Telegram Login Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'true');
    script.async = true;

    // Callback function
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    containerRef.current?.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botName, onAuth]);

  return <div ref={containerRef} />;
}

// Usage
function LoginPage() {
  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    // Send to backend for verification and linking
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramUser),
    });

    if (response.ok) {
      const { session } = await response.json();
      // Set session, redirect to app
    }
  };

  return (
    <div>
      <h1>Войти в Symancy</h1>
      <TelegramLoginButton
        botName="symancy_bot"
        onAuth={handleTelegramAuth}
      />
    </div>
  );
}
```

### 5.4 Backend Verification

```typescript
// Backend: api/auth/telegram.ts

import crypto from 'crypto';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const { hash, ...authData } = data;

  // Check auth_date (not older than 1 day)
  const authDate = new Date(authData.auth_date * 1000);
  const now = new Date();
  if (now.getTime() - authDate.getTime() > 86400000) {
    return false;
  }

  // Create data-check-string
  const checkString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');

  // Create secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return calculatedHash === hash;
}

// API endpoint
export async function handleTelegramAuth(req: Request) {
  const telegramData: TelegramAuthData = await req.json();

  // Verify signature
  if (!verifyTelegramAuth(telegramData)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Find or create unified user
  const { data: user } = await supabase.rpc('find_or_create_user_by_telegram', {
    p_telegram_id: telegramData.id,
    p_display_name: `${telegramData.first_name} ${telegramData.last_name || ''}`.trim(),
  });

  // Create Supabase session
  // Option A: Custom JWT
  // Option B: Supabase Auth with custom provider

  return Response.json({ user, session: '...' });
}
```

---

## 6. Realtime Sync (WebApp & Web)

### 6.1 Frontend Hook

```typescript
// hooks/useRealtimeChat.ts

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Message, Conversation } from '@/types';

export function useRealtimeChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      setIsLoading(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
      setIsLoading(false);
    }

    loadMessages();
  }, [conversationId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates (optimistic update)
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? updated : m)
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  // Send message
  const sendMessage = useCallback(async (content: string, interface_: 'webapp' | 'browser') => {
    const tempId = crypto.randomUUID();

    // Optimistic update
    const tempMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      channel: interface_ === 'webapp' ? 'telegram' : 'web',
      interface: interface_,
      role: 'user',
      content,
      content_type: 'text',
      processing_status: 'pending',
      metadata: {},
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);

    // Send to backend
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: { conversationId, content, interface: interface_, tempId },
    });

    if (error) {
      // Revert optimistic update
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw error;
    }

    return data;
  }, [conversationId]);

  return {
    messages,
    sendMessage,
    isConnected,
    isLoading
  };
}
```

### 6.2 Message Display with Channel Indicator

```typescript
// components/MessageBubble.tsx

import { Message } from '@/types';
import { TelegramIcon, GlobeIcon } from '@/components/icons';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      {/* Channel indicator for user messages */}
      {isUser && (
        <div className="channel-indicator">
          {message.channel === 'telegram' && (
            <span title={`via Telegram ${message.interface}`}>
              <TelegramIcon size={12} />
            </span>
          )}
          {message.channel === 'web' && (
            <span title="via Web">
              <GlobeIcon size={12} />
            </span>
          )}
        </div>
      )}

      <div className="content">
        {message.content}
      </div>

      <div className="meta">
        <span className="time">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
        {message.processing_status === 'pending' && (
          <span className="status pending">⏳</span>
        )}
      </div>
    </div>
  );
}
```

---

## 7. Error Handling & Retry Logic

### 7.1 Telegram API Error Handling

```typescript
// services/delivery/TelegramDelivery.ts

import { Bot, GrammyError, HttpError } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';

export function configureBotWithRetry(bot: Bot): void {
  // Auto-retry for 429 (flood) and 5xx errors
  bot.api.config.use(autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 60,        // Wait up to 60s for flood control
    rethrowInternalServerErrors: false,  // Retry 5xx errors
    rethrowHttpErrors: false,   // Retry network errors
  }));

  // Throttle API requests to stay within limits
  bot.api.config.use(apiThrottler());
}

// Global error handler
bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  if (e instanceof GrammyError) {
    // Telegram API error
    logger.error('Telegram API error', {
      updateId: ctx.update.update_id,
      description: e.description,
      errorCode: e.error_code,
      parameters: e.parameters,
    });

    // Handle specific errors
    if (e.error_code === 403) {
      // User blocked the bot - mark as inactive
      await markUserInactive(ctx.from?.id);
    }
  } else if (e instanceof HttpError) {
    // Network error - Telegram unreachable
    logger.error('Network error contacting Telegram', {
      updateId: ctx.update.update_id,
      error: e.message,
    });
  } else {
    // Unknown error
    logger.error('Unknown error', { error: e });
  }
});
```

### 7.2 Message Delivery Retry System

```typescript
// services/delivery/RetryService.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

export class RetryService {
  async deliverWithRetry(
    messageId: string,
    deliveryFn: () => Promise<DeliveryResult>
  ): Promise<DeliveryResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < DEFAULT_RETRY_CONFIG.maxAttempts) {
      attempt++;

      try {
        const result = await deliveryFn();

        // Update delivery status
        await this.updateDeliveryStatus(messageId, 'delivered', attempt);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Log retry attempt
        logger.warn('Delivery attempt failed', {
          messageId,
          attempt,
          error: error.message,
        });

        // Check if retryable
        if (!this.isRetryable(error)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          DEFAULT_RETRY_CONFIG.baseDelayMs *
            Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, attempt - 1),
          DEFAULT_RETRY_CONFIG.maxDelayMs
        );

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    await this.updateDeliveryStatus(messageId, 'failed', attempt, lastError?.message);

    throw lastError;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof GrammyError) {
      // Retry on rate limits and server errors
      return error.error_code === 429 || error.error_code >= 500;
    }
    if (error instanceof HttpError) {
      // Retry on network errors
      return true;
    }
    return false;
  }

  private async updateDeliveryStatus(
    messageId: string,
    status: string,
    retryCount: number,
    errorMessage?: string
  ): Promise<void> {
    await supabase
      .from('message_deliveries')
      .update({
        status,
        retry_count: retryCount,
        error_message: errorMessage,
        ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
      })
      .eq('message_id', messageId);
  }
}
```

### 7.3 Realtime Connection Recovery

```typescript
// hooks/useRealtimeWithRecovery.ts

export function useRealtimeWithRecovery(conversationId: string) {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  useEffect(() => {
    let channel: RealtimeChannel;

    const connect = () => {
      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on('postgres_changes', { /* config */ }, handleMessage)
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            reconnectAttempts.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('disconnected');
            handleReconnect();
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
          }
        });
    };

    const handleReconnect = () => {
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        return;
      }

      setConnectionStatus('reconnecting');
      reconnectAttempts.current++;

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

      setTimeout(() => {
        channel?.unsubscribe();
        connect();
      }, delay);
    };

    connect();

    return () => {
      channel?.unsubscribe();
    };
  }, [conversationId]);

  return { connectionStatus };
}
```

---

## 8. Session Management

### 8.1 Custom JWT for Telegram Users

Since Telegram users authenticate via Telegram Login Widget (not Supabase Auth), we need custom JWT tokens.

```typescript
// Backend: services/auth/JwtService.ts

import jwt from 'jsonwebtoken';

interface TelegramJwtPayload {
  sub: string;           // unified_user.id
  telegram_id: number;
  role: 'authenticated';
  iat: number;
  exp: number;
}

export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string = '7d';

  constructor() {
    this.secret = process.env.SUPABASE_JWT_SECRET!;
  }

  /**
   * Create JWT for Telegram-authenticated user
   */
  createTelegramUserToken(unifiedUser: UnifiedUser): string {
    const payload: TelegramJwtPayload = {
      sub: unifiedUser.id,
      telegram_id: unifiedUser.telegram_id!,
      role: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    return jwt.sign(payload, this.secret);
  }

  /**
   * Verify and decode JWT
   */
  verifyToken(token: string): TelegramJwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as TelegramJwtPayload;
    } catch {
      return null;
    }
  }
}
```

### 8.2 Frontend: Using Custom JWT with Supabase

```typescript
// lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// For Web users with Supabase Auth (normal flow)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// For Telegram WebApp users with custom JWT
export function createTelegramSupabaseClient(customJwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => customJwt,
    }
  );
}

// For Realtime with custom JWT
export function setupRealtimeWithCustomAuth(customJwt: string) {
  supabase.realtime.setAuth(customJwt);
}
```

### 8.3 Auth Flow: Telegram Login → Custom JWT → Supabase Session

```typescript
// pages/api/auth/telegram.ts

export async function handleTelegramLogin(telegramData: TelegramAuthData) {
  // 1. Verify Telegram signature
  if (!verifyTelegramAuth(telegramData)) {
    throw new Error('Invalid Telegram auth');
  }

  // 2. Find or create unified user
  const { data: user } = await supabaseAdmin.rpc('find_or_create_user_by_telegram', {
    p_telegram_id: telegramData.id,
    p_display_name: telegramData.first_name,
  });

  // 3. Generate custom JWT
  const jwtService = new JwtService();
  const token = jwtService.createTelegramUserToken(user);

  // 4. Return token to frontend
  return {
    user,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
}

// Frontend: Store and use token
function useAuth() {
  const [token, setToken] = useState<string | null>(null);

  const loginWithTelegram = async (telegramData: TelegramUser) => {
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify(telegramData),
    });

    const { token, user, expiresAt } = await response.json();

    // Store token securely
    localStorage.setItem('symancy_token', token);
    localStorage.setItem('symancy_token_expires', String(expiresAt));

    setToken(token);

    // Setup Supabase with custom token
    setupRealtimeWithCustomAuth(token);
  };

  return { token, loginWithTelegram };
}
```

---

## 9. Web-only User Limitations

### 9.1 What's NOT Available Without Telegram

| Feature | With Telegram | Web-only |
|---------|---------------|----------|
| Proactive messages | ✅ Engagement, reminders | ❌ Not possible |
| Offline delivery | ✅ Messages queue in Telegram | ❌ Only when tab open |
| Push notifications | ✅ Native Telegram notifications | ❌ Browser notifications only |
| Account recovery | ✅ Telegram ID never changes | ⚠️ Depends on email/OAuth |
| WebApp | ✅ Rich embedded experience | ❌ Not available |
| Full credits access | ✅ Shared across channels | ⚠️ Isolated until linked |

### 9.2 UI Prompts for Linking

```typescript
// components/TelegramLinkPrompt.tsx

export function TelegramLinkPrompt() {
  const { user } = useAuth();

  // Don't show if already linked
  if (user?.is_telegram_linked) return null;

  return (
    <div className="telegram-link-prompt">
      <div className="icon">📱</div>
      <div className="content">
        <h3>{t('linkTelegram.title')}</h3>
        <p>{t('linkTelegram.description')}</p>
        <ul>
          <li>{t('linkTelegram.benefit1')}</li> {/* Proactive messages */}
          <li>{t('linkTelegram.benefit2')}</li> {/* Offline delivery */}
          <li>{t('linkTelegram.benefit3')}</li> {/* Shared credits */}
        </ul>
      </div>
      <TelegramLoginButton
        botName="symancy_bot"
        onAuth={handleTelegramLink}
      />
    </div>
  );
}
```

### 9.3 i18n Translations for Linking UI

```typescript
// Add to src/lib/i18n.ts

const translations = {
  ru: {
    linkTelegram: {
      title: 'Подключите Telegram',
      description: 'Получите полный доступ к возможностям сервиса',
      benefit1: 'Уведомления и напоминания',
      benefit2: 'Сообщения даже когда вы офлайн',
      benefit3: 'Общие кредиты во всех каналах',
      button: 'Войти через Telegram',
    },
  },
  en: {
    linkTelegram: {
      title: 'Connect Telegram',
      description: 'Get full access to all features',
      benefit1: 'Notifications and reminders',
      benefit2: 'Messages even when offline',
      benefit3: 'Shared credits across channels',
      button: 'Login with Telegram',
    },
  },
  zh: {
    linkTelegram: {
      title: '连接 Telegram',
      description: '获得所有功能的完整访问权限',
      benefit1: '通知和提醒',
      benefit2: '离线时也能收到消息',
      benefit3: '跨渠道共享积分',
      button: '通过 Telegram 登录',
    },
  },
};
```

---

## 10. Data Migration Details

### 10.1 Migration: profiles → unified_users

```sql
-- Migration script: 001_migrate_profiles_to_unified_users.sql

-- Step 1: Create unified_users from existing profiles
INSERT INTO unified_users (
  id,
  telegram_id,
  display_name,
  language_code,
  is_telegram_linked,
  onboarding_completed,
  is_banned,
  created_at,
  last_active_at
)
SELECT
  gen_random_uuid(),
  telegram_user_id,
  name,
  COALESCE(language_code, 'ru'),
  true,  -- All existing users are Telegram-linked
  COALESCE(onboarding_completed, false),
  COALESCE(is_banned, false),
  created_at,
  COALESCE(last_active_at, created_at)
FROM profiles
ON CONFLICT (telegram_id) DO NOTHING;

-- Step 2: Create mapping table for ID conversion
CREATE TABLE migration_user_mapping (
  old_telegram_user_id BIGINT PRIMARY KEY,
  new_unified_user_id UUID NOT NULL
);

INSERT INTO migration_user_mapping (old_telegram_user_id, new_unified_user_id)
SELECT p.telegram_user_id, u.id
FROM profiles p
JOIN unified_users u ON p.telegram_user_id = u.telegram_id;
```

### 10.2 Migration: chat_messages → messages

```sql
-- Migration script: 002_migrate_chat_messages.sql

-- Step 1: Create conversations for each user
INSERT INTO conversations (id, unified_user_id, persona, status, created_at)
SELECT
  gen_random_uuid(),
  m.new_unified_user_id,
  'arina',  -- Default persona
  'active',
  MIN(cm.created_at)
FROM chat_messages cm
JOIN migration_user_mapping m ON cm.telegram_user_id = m.old_telegram_user_id
GROUP BY m.new_unified_user_id;

-- Step 2: Create conversation mapping
CREATE TABLE migration_conversation_mapping (
  unified_user_id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL
);

INSERT INTO migration_conversation_mapping
SELECT unified_user_id, id FROM conversations;

-- Step 3: Migrate messages
INSERT INTO messages (
  id,
  conversation_id,
  channel,
  interface,
  role,
  content,
  content_type,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  cm.conversation_id,
  'telegram',
  'bot',
  cm.role,
  cm.content,
  'text',
  jsonb_build_object('migrated_from', 'chat_messages'),
  cm.created_at
FROM chat_messages c
JOIN migration_user_mapping um ON c.telegram_user_id = um.old_telegram_user_id
JOIN migration_conversation_mapping cm ON um.new_unified_user_id = cm.unified_user_id
ORDER BY c.created_at;

-- Step 4: Update conversation message counts
UPDATE conversations c
SET message_count = (
  SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
);
```

### 10.3 Migration: purchases (link to unified_users)

```sql
-- Migration script: 003_migrate_purchases.sql

-- purchases table uses auth.uid (UUID)
-- Need to link via unified_users.auth_id

-- Option A: Add unified_user_id to purchases
ALTER TABLE purchases ADD COLUMN unified_user_id UUID REFERENCES unified_users(id);

-- For existing purchases, link via auth_id
UPDATE purchases p
SET unified_user_id = u.id
FROM unified_users u
WHERE p.user_id = u.auth_id;

-- Future: purchases can be made by either:
-- 1. Web users (auth_id linked)
-- 2. Telegram users (telegram_id linked, then pay on web)
```

### 10.4 Migration: analysis_history

```sql
-- Migration script: 004_migrate_analysis_history.sql

-- Current analysis_history has telegram_user_id (backend) or user_id (web)
-- Unify to unified_user_id

ALTER TABLE analysis_history ADD COLUMN unified_user_id UUID REFERENCES unified_users(id);

-- Link Telegram analyses
UPDATE analysis_history ah
SET unified_user_id = u.id
FROM unified_users u
WHERE ah.telegram_user_id = u.telegram_id
  AND ah.telegram_user_id IS NOT NULL;

-- Link Web analyses
UPDATE analysis_history ah
SET unified_user_id = u.id
FROM unified_users u
WHERE ah.user_id = u.auth_id
  AND ah.user_id IS NOT NULL
  AND ah.unified_user_id IS NULL;
```

### 10.5 Rollback Scripts

```sql
-- rollback_001_unified_users.sql
DROP TABLE IF EXISTS migration_conversation_mapping;
DROP TABLE IF EXISTS migration_user_mapping;
-- Keep unified_users for safety, mark as inactive
ALTER TABLE unified_users ADD COLUMN migration_status TEXT DEFAULT 'migrated';

-- rollback_002_messages.sql
-- Messages can be regenerated from chat_messages if needed
DELETE FROM messages WHERE metadata->>'migrated_from' = 'chat_messages';
DELETE FROM conversations WHERE id IN (
  SELECT id FROM conversations WHERE status = 'active'
);
```

---

## 11. Additional Considerations

### 11.1 Photo/Image Handling in Omnichannel

```typescript
// Images are stored in Supabase Storage, referenced by URL

interface MessageMetadata {
  // For Telegram images
  telegram_file_id?: string;
  telegram_file_unique_id?: string;

  // For all channels - unified storage URL
  image_url?: string;
  image_storage_path?: string;  // e.g., 'messages/{conversation_id}/{message_id}.jpg'

  // Analysis reference
  analysis_id?: string;
}

// When receiving image from Telegram
async function handleTelegramPhoto(ctx: Context) {
  const photo = ctx.message.photo?.pop();  // Largest size
  const fileId = photo?.file_id;

  // Download from Telegram
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  // Upload to Supabase Storage
  const storagePath = `messages/${conversationId}/${messageId}.jpg`;
  await supabase.storage.from('images').upload(storagePath, await fetch(fileUrl).then(r => r.blob()));

  // Save message with both references
  await saveMessage({
    content: '[Image]',
    content_type: 'image',
    metadata: {
      telegram_file_id: fileId,
      image_storage_path: storagePath,
      image_url: supabase.storage.from('images').getPublicUrl(storagePath).data.publicUrl,
    },
  });
}
```

### 11.2 Daily Message Limits

```sql
-- Add to unified_users or create separate table
ALTER TABLE unified_users ADD COLUMN daily_messages_count INTEGER DEFAULT 0;
ALTER TABLE unified_users ADD COLUMN daily_messages_reset_at DATE DEFAULT CURRENT_DATE;

-- Function to check and increment limit
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

### 11.3 Onboarding Flow in Omnichannel

```typescript
// Onboarding state is per-user, not per-channel
// Same onboarding progress whether on Telegram or Web

interface OnboardingState {
  step: 'greeting' | 'name' | 'intent' | 'upload' | 'completed';
  data: {
    name?: string;
    intent?: string;
    firstAnalysisId?: string;
  };
}

// Stored in unified_users.context JSONB
async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const { data: user } = await supabase
    .from('unified_users')
    .select('onboarding_completed, context')
    .eq('id', userId)
    .single();

  if (user.onboarding_completed) {
    return { step: 'completed', data: user.context?.onboarding || {} };
  }

  return user.context?.onboarding || { step: 'greeting', data: {} };
}

// Progress syncs across channels automatically
// If user starts onboarding in Telegram, can continue on Web
```

### 11.4 Telegram WebApp initData Verification

```typescript
// services/auth/TelegramWebAppAuth.ts

import crypto from 'crypto';

interface WebAppInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  auth_date: number;
  hash: string;
}

export function verifyWebAppInitData(initData: string): WebAppInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  // Sort and create data-check-string
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key: HMAC-SHA256 of bot token with "WebAppData"
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null;
  }

  // Check auth_date (not older than 1 hour for WebApp)
  const authDate = parseInt(params.get('auth_date') || '0');
  if (Date.now() / 1000 - authDate > 3600) {
    return null;
  }

  // Parse user data
  const userJson = params.get('user');
  const user = userJson ? JSON.parse(userJson) : undefined;

  return {
    query_id: params.get('query_id') || undefined,
    user,
    auth_date: authDate,
    hash: hash!,
  };
}
```

---

## 12. Migration Plan

### Phase 1: Database Schema (3-5 days)

- [ ] Create migration for new tables (unified_users, conversations, messages, etc.)
- [ ] Create helper functions (find_or_create_user_by_telegram, etc.)
- [ ] Add RLS policies
- [ ] Add Realtime publication
- [ ] Test on Supabase branch

### Phase 2: Data Migration (2-3 days)

- [ ] Run migration: `profiles` → `unified_users` (see Section 10.1)
- [ ] Run migration: `chat_messages` → `messages` (see Section 10.2)
- [ ] Run migration: `purchases` → add `unified_user_id` (see Section 10.3)
- [ ] Run migration: `analysis_history` → add `unified_user_id` (see Section 10.4)
- [ ] Migrate `user_credits` to use `unified_user_id`
- [ ] Verify data integrity
- [ ] Test rollback scripts

### Phase 3: Backend Refactor (5-7 days)

- [ ] Create `MessageRouter` service
- [ ] Create `DeliveryService` with retry logic
- [ ] Create `JwtService` for custom tokens
- [ ] Configure grammY with auto-retry and throttler
- [ ] Update Telegram handlers to use new schema
- [ ] Update pg-boss workers
- [ ] Add Telegram Login verification endpoint
- [ ] Add WebApp initData verification

### Phase 4: Frontend Updates (3-5 days)

- [ ] Add `useRealtimeChat` hook with reconnection
- [ ] Add `useAuth` hook for custom JWT
- [ ] Update chat components
- [ ] Add Telegram Login Widget
- [ ] Add `TelegramLinkPrompt` component
- [ ] Add channel indicators to messages
- [ ] Update i18n (3 languages) - add linkTelegram keys

### Phase 5: Telegram WebApp (5-7 days)

- [ ] Create WebApp project structure
- [ ] Implement auth via initData verification
- [ ] Setup Supabase client with custom JWT
- [ ] Connect to same backend
- [ ] Test bot ↔ webapp switching
- [ ] Test Realtime sync

### Phase 6: Testing & Launch (3-5 days)

- [ ] Unit tests for JwtService, routing, delivery
- [ ] Integration tests for auth flows
- [ ] Load testing (Realtime subscriptions)
- [ ] Test error handling and retry logic
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor errors and performance

---

## 13. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Anonymous Web users? | ❌ No. Auth required everywhere |
| WebApp = separate channel? | ❌ No. Same channel, different interface |
| Credits without linking? | Separate until linked, then merged |
| Primary identity? | Telegram (anchor pattern) |
| Web login method? | Telegram Login Widget |

---

## 9. Future Considerations

### 9.1 Adding WhatsApp

```typescript
// Future: When adding WhatsApp
await supabase
  .from('unified_users')
  .update({ whatsapp_phone: '+79001234567' })
  .eq('telegram_id', 123456);
```

### 9.2 Adding WeChat

```typescript
// Future: When adding WeChat
await supabase
  .from('unified_users')
  .update({ wechat_openid: 'oXXXX' })
  .eq('telegram_id', 123456);
```

The schema is designed to easily add new channels without migrations.

---

## 10. References

- [Telegram Login Widget](https://core.telegram.org/widgets/login)
- [Telegram WebApp API](https://core.telegram.org/bots/webapps)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [pg-boss Documentation](https://github.com/timgit/pg-boss)
