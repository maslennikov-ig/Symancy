# Research: Omnichannel Chat Architecture

**Feature**: 004-omnichannel-chat
**Date**: 2025-12-27
**Status**: Complete

## Table of Contents

1. [Library Research](#library-research)
2. [Telegram Auth Verification](#telegram-auth-verification)
3. [Supabase Realtime](#supabase-realtime)
4. [grammY Plugins](#grammy-plugins)
5. [Custom JWT for Telegram Users](#custom-jwt-for-telegram-users)
6. [Architecture Patterns](#architecture-patterns)

---

## Library Research

### Summary of Decisions

| Component | Decision | Library | Rationale |
|-----------|----------|---------|-----------|
| Telegram Login Widget (Backend) | **Custom implementation** | Native `crypto` | Zero dependencies, simple algorithm, <50 lines |
| Telegram WebApp Auth (Backend) | **Custom implementation** | Native `crypto` | Same as above, different hash algorithm |
| Telegram Login Widget (Frontend) | **Custom component** | Native script injection | No good React 19 compatible library |
| Real-time Subscriptions | **Use existing** | `@supabase/supabase-js` | Already in project, excellent support |
| grammY Auto-Retry | **Add plugin** | `@grammyjs/auto-retry` | Official, well-maintained, critical for reliability |
| grammY Throttler | **Add plugin** | `@grammyjs/transformer-throttler` | Official, prevents rate limit errors |
| JWT Token Generation | **Custom implementation** | `jsonwebtoken` | Already common pattern, well-understood |

---

## Telegram Auth Verification

### Research Question

How to verify Telegram Login Widget and WebApp initData cryptographically?

### Library Candidates Evaluated

#### 1. @telegram-auth/server
- **npm**: https://www.npmjs.com/package/@telegram-auth/server
- **Weekly downloads**: ~2,420 (classified as "popular")
- **Last update**: 1 year ago
- **Dependencies**: Zero
- **TypeScript**: Yes
- **Verdict**: ❌ **REJECTED** - Stale (1 year), but algorithm is simple enough to implement

#### 2. node-telegram-login
- **GitHub**: https://github.com/mghiozzi/node-telegram-login
- **Weekly downloads**: <100
- **Verdict**: ❌ **REJECTED** - Low usage, Express-specific middleware

#### 3. Custom Implementation
- **Dependencies**: Zero (uses Node.js `crypto`)
- **Maintenance**: Our responsibility
- **Verdict**: ✅ **SELECTED**

### Decision: Custom Implementation

**Rationale**:
1. Telegram auth verification is a simple HMAC-SHA256 algorithm
2. Official documentation provides clear specification
3. No external dependencies = no supply chain risk
4. Implementation is <50 lines of code
5. Easy to understand and maintain

### Implementation Reference

```typescript
// Telegram Login Widget Verification
// https://core.telegram.org/widgets/login#checking-authorization

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

export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data;

  // Check auth_date (not older than 24 hours)
  const authDate = new Date(authData.auth_date * 1000);
  if (Date.now() - authDate.getTime() > 86400000) {
    return false;
  }

  // Create data-check-string (sorted key=value\n format)
  const checkString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');

  // Secret key = SHA256(bot_token)
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  // Calculate HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return calculatedHash === hash;
}
```

```typescript
// Telegram WebApp initData Verification
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export function verifyWebAppInitData(initData: string, botToken: string): WebAppInitData | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  // Data-check-string: sorted, newline-separated
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Secret key = HMAC-SHA256("WebAppData", bot_token)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate HMAC-SHA256
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

  const userJson = params.get('user');
  return {
    user: userJson ? JSON.parse(userJson) : undefined,
    auth_date: authDate,
    hash: hash!,
  };
}
```

### Frontend Component Decision

**Question**: Use library or custom for Telegram Login Widget button?

**Candidates**:
1. `react-telegram-login` - Last update 3+ years ago, React 19 compatibility unknown
2. Custom script injection - Simple, full control

**Decision**: ✅ **Custom implementation**

**Rationale**:
- Telegram Login Widget is just a script tag injection
- React 19 compatibility concerns with old libraries
- Full control over styling and behavior
- ~30 lines of code

---

## Supabase Realtime

### Research Question

How to implement real-time message sync between web clients and database?

### Decision: Use Existing @supabase/supabase-js

**Already in project**: v2.80.0

**Capabilities confirmed via Context7 documentation**:

1. **Postgres Changes (CDC)** - Listen for INSERT/UPDATE/DELETE events
```javascript
channel.on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.xxx' },
  (payload) => handleNewMessage(payload.new)
)
```

2. **Channel Subscribe with Status Handling**
```javascript
channel.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') { /* Connected */ }
  if (status === 'CHANNEL_ERROR') { /* Handle error */ }
  if (status === 'TIMED_OUT') { /* Reconnect */ }
  if (status === 'CLOSED') { /* Cleanup */ }
})
```

3. **Presence Tracking** (for online users)
```javascript
channel.on('presence', { event: 'sync' }, () => {
  console.log('Online users:', channel.presenceState())
})
```

### Configuration Requirements

1. **Enable Realtime on tables**:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;
```

2. **RLS Policies** - Already planned in data model

3. **Custom JWT Support** - Supabase Realtime accepts custom JWTs via `setAuth()`:
```typescript
supabase.realtime.setAuth(customJwt);
```

---

## grammY Plugins

### Research Question

How to handle Telegram API rate limits and automatic retries?

### Plugins to Add

#### 1. @grammyjs/auto-retry

**Purpose**: Automatically retry failed API calls (429 flood, 5xx errors)

**Installation**:
```bash
pnpm add @grammyjs/auto-retry
```

**Usage** (from Context7):
```typescript
import { autoRetry } from "@grammyjs/auto-retry";

bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,      // Retry up to 3 times
  maxDelaySeconds: 60,      // Wait up to 60s for flood control
  rethrowInternalServerErrors: false, // Retry 5xx
  rethrowHttpErrors: false,  // Retry network errors
}));
```

**Why needed**:
- Telegram has strict rate limits (30 msg/sec global, 1 msg/sec per chat)
- 429 errors are common during broadcasts
- Auto-retry with exponential backoff is best practice

#### 2. @grammyjs/transformer-throttler

**Purpose**: Proactively throttle API requests to stay within limits

**Installation**:
```bash
pnpm add @grammyjs/transformer-throttler
```

**Usage** (from Context7):
```typescript
import { apiThrottler } from "@grammyjs/transformer-throttler";

const throttler = apiThrottler();
bot.api.config.use(throttler);
```

**Why needed**:
- Prevents hitting rate limits in the first place
- Better than reactive retries
- Recommended by grammY documentation

### Combined Setup

```typescript
import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Apply throttler first (proactive)
bot.api.config.use(apiThrottler());

// Then auto-retry (reactive fallback)
bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,
  maxDelaySeconds: 60,
}));
```

---

## Custom JWT for Telegram Users

### Research Question

How to authenticate Telegram users in Supabase without Supabase Auth?

### Problem Statement

- Telegram users authenticate via bot or Login Widget
- They don't have Supabase Auth accounts (no email/password)
- RLS policies need `auth.uid()` which requires a JWT
- Need custom JWT that Supabase will accept

### Decision: Use `jsonwebtoken` library

**Already common in Node.js ecosystem**, well-understood pattern.

### Implementation Approach

```typescript
import jwt from 'jsonwebtoken';

interface TelegramJwtPayload {
  sub: string;           // unified_user.id (UUID)
  telegram_id: number;   // For logging/debugging
  role: 'authenticated'; // Supabase standard
  iat: number;
  exp: number;
}

export function createTelegramUserToken(userId: string, telegramId: number): string {
  const payload: TelegramJwtPayload = {
    sub: userId,
    telegram_id: telegramId,
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  return jwt.sign(payload, process.env.SUPABASE_JWT_SECRET!);
}
```

### Supabase Integration

1. **Frontend**: Pass JWT to Supabase client
```typescript
const supabase = createClient(url, anonKey, {
  accessToken: async () => telegramUserToken,
});
```

2. **Realtime**: Set auth for subscriptions
```typescript
supabase.realtime.setAuth(telegramUserToken);
```

3. **RLS Policies**: Use `auth.uid()` which extracts `sub` from JWT
```sql
CREATE POLICY "Users can view own data"
ON unified_users FOR SELECT
USING (id = auth.uid()); -- auth.uid() returns sub from JWT
```

---

## Architecture Patterns

### Message Routing Pattern

**Pattern**: Source-Based Routing

```
User Message → Extract (channel, interface) → Store in messages table
                                            → Route response to same (channel, interface)
```

**Implementation**:
```typescript
interface RoutingContext {
  channel: 'telegram' | 'web' | 'whatsapp' | 'wechat';
  interface: 'bot' | 'webapp' | 'browser' | 'api' | 'miniprogram';
}

function routeResponse(sourceMessage: Message): RoutingContext {
  return {
    channel: sourceMessage.channel,
    interface: sourceMessage.interface,
  };
}
```

### Delivery Method Selection

| Channel | Interface | Delivery Method |
|---------|-----------|-----------------|
| telegram | bot | grammY `bot.api.sendMessage()` |
| telegram | webapp | Supabase Realtime |
| web | browser | Supabase Realtime |
| whatsapp | api | WhatsApp Cloud API (future) |

### Retry Strategy

**Pattern**: Exponential Backoff with Jitter

```typescript
const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
};

function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.multiplier, attempt - 1),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (±20%)
  return delay * (0.8 + Math.random() * 0.4);
}
```

---

## Dependencies Summary

### New Dependencies to Add (Backend)

```bash
# grammY plugins
pnpm add @grammyjs/auto-retry @grammyjs/transformer-throttler

# JWT (likely already available, verify)
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

### No New Frontend Dependencies

- Telegram Login Widget: Custom implementation (script injection)
- Realtime: Already have `@supabase/supabase-js`
- Auth: Custom hooks using existing React patterns

---

## References

- [Telegram Login Widget](https://core.telegram.org/widgets/login)
- [Telegram WebApp Validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [grammY Auto-Retry Plugin](https://grammy.dev/plugins/auto-retry)
- [grammY Throttler Plugin](https://grammy.dev/plugins/transformer-throttler)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [@telegram-auth/server npm](https://www.npmjs.com/package/@telegram-auth/server)
- [Context7 grammY Documentation](/grammyjs/website)
- [Context7 Supabase JS Documentation](/supabase/supabase-js)
