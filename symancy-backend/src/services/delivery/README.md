# DeliveryService

Message delivery service for the omnichannel chat architecture.

## Features

- **Telegram Delivery**: Send messages via Telegram Bot API
- **Realtime Delivery**: Send messages via Supabase Realtime (INSERT into messages table)
- **Retry Logic**: Exponential backoff with jitter (±20%)
- **Error Handling**: Distinguish between transient and permanent errors
- **Logging**: Structured logging with Pino

## Usage

### Telegram Delivery

```typescript
import { getDeliveryService } from './services/delivery/DeliveryService.js';

const delivery = getDeliveryService();

const result = await delivery.deliverToTelegram(
  chatId,
  "Hello from Symancy!",
  {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
);

if (result.success) {
  console.log('Delivered:', result.externalMessageId);
} else {
  console.error('Failed:', result.errorMessage);
}
```

### Realtime Delivery (Web)

```typescript
const result = await delivery.deliverToRealtime(
  conversationId,
  "AI response message",
  'web',
  'browser',
  {
    role: 'assistant',
    content_type: 'text',
    metadata: { model: 'mimo-v2' },
  }
);
```

### Unified Delivery (Route Automatically)

```typescript
const result = await delivery.deliver(
  'telegram',
  'bot',
  {
    chatId: 123456789,
    content: 'Hello!',
    telegramOptions: { parse_mode: 'HTML' },
  }
);
```

## Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxAttempts: 5,           // Maximum retry attempts
  baseDelayMs: 1000,        // Initial delay (1s)
  maxDelayMs: 60000,        // Maximum delay (60s)
  multiplier: 2,            // Exponential multiplier
  jitterPercent: 20,        // ±20% jitter
};
```

## Error Types

### Transient Errors (Will Retry)
- Network errors (ECONNRESET, ETIMEDOUT)
- Rate limits (429)
- Server errors (5xx)
- Timeouts

### Permanent Errors (Will NOT Retry)
- Bot blocked by user
- User deactivated
- Chat not found
- Forbidden (403)
- Bad Request (400)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DeliveryService                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  deliver(channel, interface, params)                        │
│      │                                                       │
│      ├─> telegram/bot ──> deliverToTelegram()              │
│      │                         │                             │
│      │                         └─> Bot API (grammY)         │
│      │                                                       │
│      └─> web/browser ──> deliverToRealtime()               │
│                               │                              │
│                               └─> Supabase INSERT           │
│                                       │                      │
│                                       └─> Realtime Broadcast │
│                                                              │
│  Retry Logic:                                               │
│  - Exponential backoff with jitter                          │
│  - Transient error detection                                │
│  - Max 5 attempts                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Integration with Omnichannel

This service is part of the omnichannel chat architecture and integrates with:

- **MessageRouter**: Routes incoming messages to appropriate handlers
- **ConversationService**: Manages conversation state
- **UserService**: Resolves unified users across channels

## Logging

All delivery attempts are logged with structured data:

```typescript
{
  module: 'delivery',
  method: 'deliverToTelegram',
  chatId: 123456789,
  contentLength: 256,
  attempt: 2,
  delayMs: 2000,
  externalMessageId: '12345',
}
```

## Type Safety

All delivery methods use types from `../../types/omnichannel.ts`:

- `DeliveryResult`: Standard delivery result with success/error info
- `ChannelType`: Valid channels (telegram, web, whatsapp, wechat)
- `InterfaceType`: Valid interfaces (bot, browser, webapp, api, miniprogram)
- `MessageRole`: Message roles (user, assistant, system)
- `ContentType`: Content types (text, image, analysis, audio, document)
