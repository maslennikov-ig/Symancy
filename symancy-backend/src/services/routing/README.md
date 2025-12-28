# Message Router Service

Determines delivery methods for messages based on source channel and interface.

## Architecture

Part of the omnichannel chat architecture, the MessageRouter ensures messages are delivered through the appropriate channel based on where they originated.

## Routing Logic

| Channel   | Interface   | Delivery Method  | Status      |
|-----------|-------------|------------------|-------------|
| telegram  | bot         | telegram_api     | ✅ Active   |
| telegram  | webapp      | realtime         | ✅ Active   |
| web       | browser     | realtime         | ✅ Active   |
| whatsapp  | api         | whatsapp_api     | 🔜 Future   |

## Usage

### Basic Routing

```typescript
import { messageRouter } from './services/routing/MessageRouter.js';

// Route a Telegram bot message
const routing = messageRouter.routeToChannel('telegram', 'bot');
console.log(routing.deliveryMethod); // 'telegram_api'

// Route a Telegram webapp message
const routing2 = messageRouter.routeToChannel('telegram', 'webapp');
console.log(routing2.deliveryMethod); // 'realtime'

// Route a web browser message
const routing3 = messageRouter.routeToChannel('web', 'browser');
console.log(routing3.deliveryMethod); // 'realtime'
```

### Check Delivery Method Availability

```typescript
import { messageRouter } from './services/routing/MessageRouter.js';

// Check if telegram_api is available
if (messageRouter.isDeliveryMethodAvailable('telegram_api')) {
  // Deliver via Telegram Bot API
}

// Check if whatsapp_api is available
if (!messageRouter.isDeliveryMethodAvailable('whatsapp_api')) {
  // Fallback to another method
}
```

### Get Supported Routes

```typescript
import { messageRouter } from './services/routing/MessageRouter.js';

const routes = messageRouter.getSupportedRoutes();
console.log(routes);
// [
//   { channel: 'telegram', interface: 'bot', deliveryMethod: 'telegram_api' },
//   { channel: 'telegram', interface: 'webapp', deliveryMethod: 'realtime' },
//   { channel: 'web', interface: 'browser', deliveryMethod: 'realtime' },
//   { channel: 'whatsapp', interface: 'api', deliveryMethod: 'whatsapp_api' }
// ]
```

### Direct Method Access

```typescript
import { MessageRouter } from './services/routing/MessageRouter.js';

const router = MessageRouter.getInstance();

// Get delivery method only
const method = router.getDeliveryMethod('telegram', 'bot');
console.log(method); // 'telegram_api'
```

## Fallback Behavior

If an unknown channel/interface combination is provided, the router falls back to `'realtime'` and logs a warning:

```typescript
const routing = messageRouter.routeToChannel('wechat', 'miniprogram');
console.log(routing.deliveryMethod); // 'realtime' (fallback)
// Logs: "Unknown channel/interface combination, falling back to realtime"
```

## Type Safety

All types are imported from `types/omnichannel.ts`:

```typescript
import type { ChannelType, InterfaceType, RoutingContext } from '../../types/omnichannel.js';
import type { DeliveryMethod } from './MessageRouter.js';
```

## Integration with Delivery Service

The MessageRouter is designed to work with the DeliveryService:

```typescript
import { messageRouter } from './services/routing/MessageRouter.js';
import { deliveryService } from './services/delivery/DeliveryService.js';

// Route message
const routing = messageRouter.routeToChannel('telegram', 'bot');

// Check if delivery method is available
if (messageRouter.isDeliveryMethodAvailable(routing.deliveryMethod)) {
  // Deliver message
  await deliveryService.deliver(message, routing);
}
```

## Logging

The MessageRouter uses structured logging via Pino:

```typescript
// Debug level: routing decisions
{
  "module": "message-router",
  "sourceChannel": "telegram",
  "sourceInterface": "bot",
  "deliveryMethod": "telegram_api",
  "msg": "Message routed to delivery channel"
}

// Warn level: unknown combinations
{
  "module": "message-router",
  "channel": "wechat",
  "interfaceType": "miniprogram",
  "fallback": "realtime",
  "msg": "Unknown channel/interface combination, falling back to realtime"
}
```

## Singleton Pattern

MessageRouter uses the singleton pattern to ensure a single instance throughout the application lifecycle:

```typescript
// Both imports reference the same instance
import { messageRouter } from './services/routing/MessageRouter.js';
import { MessageRouter } from './services/routing/MessageRouter.js';

const router1 = messageRouter;
const router2 = MessageRouter.getInstance();

console.log(router1 === router2); // true
```
