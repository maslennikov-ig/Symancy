# Quickstart: Omnichannel Chat Architecture

**Feature**: 004-omnichannel-chat
**Date**: 2025-12-27

This guide covers the essential setup steps for the omnichannel chat feature.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Supabase CLI (optional, for local development)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## 1. Install Dependencies

### Backend

```bash
cd symancy-backend

# Add new grammY plugins
pnpm add @grammyjs/auto-retry @grammyjs/transformer-throttler

# Add JWT (if not already installed)
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

### Frontend

No new dependencies required. Uses existing:
- `@supabase/supabase-js` for Realtime
- Native script injection for Telegram Login Widget

## 2. Environment Variables

### Backend (.env)

```bash
# Existing
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# New (for custom JWT)
SUPABASE_JWT_SECRET=your_jwt_secret_from_supabase_dashboard
```

To get `SUPABASE_JWT_SECRET`:
1. Go to Supabase Dashboard → Settings → API
2. Copy the "JWT Secret" value

### Frontend (.env)

```bash
# Existing
VITE_SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# New
VITE_TELEGRAM_BOT_NAME=symancy_bot
```

## 3. Database Migrations

Apply migrations in order via Supabase MCP or Dashboard:

```sql
-- Migration 1: Create unified_users table
-- See: data-model.md for full schema

-- Migration 2: Create conversations table
-- Migration 3: Create messages table
-- Migration 4: Create message_deliveries table
-- Migration 5: Create link_tokens table
-- Migration 6: Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;

-- Migration 7: Data migration (profiles → unified_users)
-- Migration 8: RLS policies
```

## 4. Configure grammY with Retry/Throttle

Update your bot initialization:

```typescript
// symancy-backend/src/app.ts

import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Apply throttler first (proactive rate limiting)
bot.api.config.use(apiThrottler());

// Then auto-retry (reactive fallback)
bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,
  maxDelaySeconds: 60,
  rethrowInternalServerErrors: false,
  rethrowHttpErrors: false,
}));
```

## 5. Add Telegram Login Widget (Frontend)

### Component

```tsx
// src/components/features/auth/TelegramLoginButton.tsx

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
  onAuth: (user: TelegramUser) => void;
}

export function TelegramLoginButton({ onAuth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    // Callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    containerRef.current?.appendChild(script);

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [onAuth]);

  return <div ref={containerRef} />;
}
```

### Usage

```tsx
// src/pages/Login.tsx

import { TelegramLoginButton } from '@/components/features/auth/TelegramLoginButton';

export function LoginPage() {
  const handleTelegramAuth = async (telegramUser) => {
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramUser),
    });

    const { token, user } = await response.json();

    // Store token and setup Supabase with custom JWT
    localStorage.setItem('symancy_token', token);
    // ...redirect to app
  };

  return (
    <div>
      <h1>{t('auth.loginTitle')}</h1>
      <TelegramLoginButton onAuth={handleTelegramAuth} />
    </div>
  );
}
```

## 6. Add Realtime Chat Hook

```typescript
// src/hooks/useRealtimeChat.ts

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Message } from '@/types/omnichannel';

export function useRealtimeChat(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
    };

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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
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
  const sendMessage = useCallback(
    async (content: string, interfaceType: 'webapp' | 'browser') => {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: { conversationId, content, interface: interfaceType },
      });

      if (error) throw error;
      return data;
    },
    [conversationId]
  );

  return { messages, sendMessage, isConnected };
}
```

## 7. Backend Auth Verification

```typescript
// symancy-backend/src/services/auth/TelegramAuthService.ts

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

  // Check auth_date (not older than 24 hours)
  if (Date.now() - authData.auth_date * 1000 > 86400000) {
    return false;
  }

  // Create data-check-string
  const checkString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');

  // Secret key = SHA256(bot_token)
  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();

  // Calculate HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return calculatedHash === hash;
}
```

## 8. Telegram Bot Domain Setup

For Telegram Login Widget to work:

1. Open [@BotFather](https://t.me/BotFather)
2. Send `/mybots` → Select your bot
3. Bot Settings → Domain → Add `symancy.ru`

**Important**: Login Widget does NOT work on localhost. For local testing, use:
- [ngrok](https://ngrok.com/) to expose local server
- Telegram WebApp (which works on localhost)

## 9. Add i18n Translations

```typescript
// src/lib/i18n.ts - Add these keys

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
    chat: {
      sendPlaceholder: 'Напишите сообщение...',
      sending: 'Отправка...',
      connectionLost: 'Соединение потеряно. Переподключение...',
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
    chat: {
      sendPlaceholder: 'Type a message...',
      sending: 'Sending...',
      connectionLost: 'Connection lost. Reconnecting...',
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
    chat: {
      sendPlaceholder: '输入消息...',
      sending: '发送中...',
      connectionLost: '连接丢失。正在重新连接...',
    },
  },
};
```

## 10. Testing Checklist

### Local Development

- [ ] Backend starts without errors
- [ ] grammY plugins (auto-retry, throttler) are applied
- [ ] Database migrations applied successfully
- [ ] Realtime subscription works in browser console

### Telegram Integration

- [ ] Bot responds to /start command
- [ ] Bot /link command generates valid token
- [ ] Telegram Login Widget appears on web (on registered domain)
- [ ] WebApp initData verification works

### End-to-End

- [ ] User can login via Telegram Login Widget
- [ ] Messages sync in realtime between web and Telegram
- [ ] Credits are shared across channels
- [ ] Account linking works (Telegram ↔ Web)

## Troubleshooting

### "Invalid signature" on Telegram Login

- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify domain is registered with @BotFather
- Ensure `auth_date` is not older than 24 hours

### Realtime not receiving messages

- Check Supabase publication: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`
- Verify RLS policies allow user to read messages
- Check browser console for WebSocket errors

### Rate limit errors (429)

- grammY auto-retry should handle automatically
- If persistent, reduce message frequency
- Check global limit: 30 msg/sec, per-chat: 1 msg/sec

## Next Steps

After completing this quickstart:

1. Run `/speckit.tasks` to generate implementation tasks
2. Follow tasks.md for step-by-step implementation
3. Use `/push patch` after each completed task
