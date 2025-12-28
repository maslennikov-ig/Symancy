# Proactive Messaging Service

Handles proactive (engagement) messaging to users with linked Telegram accounts.

## Overview

Per spec (US5 - Proactive Messaging):
- Proactive messages ONLY go to users with messenger channel
- Web-only users (is_telegram_linked=false) receive nothing
- System detects bot blocked errors and marks users inactive

## Key Features

1. **Telegram-linked check**: All queries filter by `is_telegram_linked=true`
2. **Unified users table**: Queries `unified_users` (not legacy `profiles`)
3. **Bot blocked handling**: Detects blocked errors, marks user inactive
4. **Rate limiting**: 100ms delay between messages (10 msg/sec)
5. **Deduplication**: Checks `engagement_log` to prevent duplicate sends

## Usage

```typescript
import { getProactiveMessageService } from "../services/proactive/index.js";

const proactiveService = getProactiveMessageService();

// Find eligible users
const users = await proactiveService.findInactiveUsers();

// Send batch with rate limiting
const results = await proactiveService.sendBatchEngagementMessages(
  users,
  "inactive-reminder",
  (user) => createInactiveReminderMessage(user.displayName)
);

console.log(`Sent: ${results.success}, Blocked: ${results.blocked}`);
```

## Message Types

| Type | Schedule | Description |
|------|----------|-------------|
| `inactive-reminder` | Daily 10:00 MSK | Users inactive 7+ days |
| `weekly-checkin` | Monday 10:00 MSK | All active users |
| `daily-fortune` | Daily 8:00 MSK | Users with spiritual goal |

## Integration with Engagement Workers

The engagement workers (`modules/engagement/worker.ts`) use ProactiveMessageService:

1. Worker receives pg-boss job trigger
2. Calls `proactiveService.find*Users()` to get eligible users
3. Calls `proactiveService.sendBatchEngagementMessages()` to send
4. Results include blocked user count for monitoring

## Error Handling

- **Bot blocked**: User marked inactive via `notification_settings.enabled=false`
- **Rate limits**: Auto-retry with exponential backoff via DeliveryService
- **Network errors**: Retry up to 5 times with jitter
