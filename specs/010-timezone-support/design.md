# 010: Timezone Support for Daily Insights

## Status: READY FOR IMPLEMENTATION

**Date created**: 2026-01-04
**Author**: Claude Code
**Related spec**: 009-personalized-daily-insights

---

## 1. Overview

### 1.1 Problem

Current daily insights (morning advice at 8:00, evening insight at 20:00) are sent at fixed Moscow time (Europe/Moscow) for ALL users regardless of their actual timezone. This creates poor UX:

1. **Wrong timing**: A user in Los Angeles receives "morning advice" at 11:00 PM their local time
2. **Missed engagement**: Users in different timezones may be asleep when notifications arrive
3. **No customization**: Users cannot choose their preferred notification times
4. **Wasted resources**: Processing all users at once creates load spikes

### 1.2 Solution

Implement per-user timezone support with customizable notification times:

1. **Timezone detection**: Auto-detect from Telegram or allow manual selection
2. **Custom times**: Users can set preferred morning/evening notification times
3. **Batch processing**: Process users in timezone groups (hourly batches)
4. **UI settings**: Add timezone and time pickers to Profile page

### 1.3 Database Support (Already Exists)

The `unified_users` table already has required fields:
- `timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'`
- `notification_settings JSONB NOT NULL DEFAULT '{"enabled": true}'`

---

## 2. Architecture

### 2.1 Current State

```
┌─────────────────────────────────────────────────────────────┐
│                     SCHEDULER (Current)                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ scheduler.ts                                         │    │
│  │                                                      │    │
│  │ "morning-insight": {                                 │    │
│  │   cron: "0 8 * * *",   // 8:00 MSK for ALL users    │    │
│  │   tz: "Europe/Moscow"                                │    │
│  │ }                                                    │    │
│  │                                                      │    │
│  │ "evening-insight": {                                 │    │
│  │   cron: "0 20 * * *",  // 20:00 MSK for ALL users   │    │
│  │   tz: "Europe/Moscow"                                │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ worker.ts                                            │    │
│  │ processMorningInsight()  → ALL users at once         │    │
│  │ processEveningInsight()  → ALL users at once         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

PROBLEMS:
- User in New York (UTC-5): Morning insight at 3:00 AM local
- User in Tokyo (UTC+9): Morning insight at 4:00 PM local
- User in Sydney (UTC+11): Morning insight at 6:00 PM local
```

### 2.2 Target State

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULER (New)                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ scheduler.ts - Hourly dispatcher                     │    │
│  │                                                      │    │
│  │ "insight-dispatcher": {                              │    │
│  │   cron: "0 * * * *",   // Every hour, all timezones │    │
│  │   tz: "UTC"            // Process in UTC             │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ dispatcher.ts                                        │    │
│  │                                                      │    │
│  │ 1. Get current UTC hour                              │    │
│  │ 2. Find users where local_hour = target_hour         │    │
│  │ 3. Queue individual jobs for matching users          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ worker.ts                                            │    │
│  │ processMorningInsight({ userId })  → Single user     │    │
│  │ processEveningInsight({ userId })  → Single user     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    USER SETTINGS                             │
│                                                              │
│  unified_users.notification_settings (JSONB):                │
│  {                                                          │
│    "enabled": true,                                         │
│    "morning_enabled": true,                                 │
│    "evening_enabled": true,                                 │
│    "morning_time": "08:00",    // HH:MM in user's timezone │
│    "evening_time": "20:00"     // HH:MM in user's timezone │
│  }                                                          │
│                                                              │
│  unified_users.timezone:                                     │
│  "Europe/Moscow" | "America/New_York" | "Asia/Tokyo" | ...  │
└─────────────────────────────────────────────────────────────┘

RESULT:
- User in New York: Morning at 8:00 AM EST
- User in Tokyo: Morning at 8:00 AM JST
- User in Sydney: Morning at 8:00 AM AEDT
```

---

## 3. Detailed Design

### 3.1 Notification Settings Schema

Extend `notification_settings` JSONB in `unified_users`:

```typescript
interface NotificationSettings {
  /** Master toggle for all notifications */
  enabled: boolean;

  /** Morning insight settings */
  morning_enabled: boolean;
  morning_time: string; // "HH:MM" in user's timezone, default "08:00"

  /** Evening insight settings */
  evening_enabled: boolean;
  evening_time: string; // "HH:MM" in user's timezone, default "20:00"
}
```

**Default value** (migration needed to update existing users):
```json
{
  "enabled": true,
  "morning_enabled": true,
  "evening_enabled": true,
  "morning_time": "08:00",
  "evening_time": "20:00"
}
```

### 3.2 Migration: Update notification_settings schema

File: `supabase/migrations/20260104_update_notification_settings.sql`

```sql
-- Migration: Extend notification_settings with time preferences
-- Safe: adds new fields with defaults, doesn't break existing data

-- Update default for new users
ALTER TABLE unified_users
ALTER COLUMN notification_settings
SET DEFAULT '{
  "enabled": true,
  "morning_enabled": true,
  "evening_enabled": true,
  "morning_time": "08:00",
  "evening_time": "20:00"
}'::jsonb;

-- Backfill existing users with new fields (keeps existing "enabled" value)
UPDATE unified_users
SET notification_settings = notification_settings || '{
  "morning_enabled": true,
  "evening_enabled": true,
  "morning_time": "08:00",
  "evening_time": "20:00"
}'::jsonb
WHERE NOT (notification_settings ? 'morning_enabled');

-- Add index for efficient timezone queries
CREATE INDEX IF NOT EXISTS idx_unified_users_timezone
ON unified_users(timezone);

-- Add index for notification queries
CREATE INDEX IF NOT EXISTS idx_unified_users_notifications_enabled
ON unified_users((notification_settings->>'enabled'))
WHERE (notification_settings->>'enabled')::boolean = true;
```

### 3.3 Insight Dispatcher Service

New file: `symancy-backend/src/modules/engagement/dispatcher.ts`

```typescript
/**
 * Insight Dispatcher
 *
 * Runs every hour and queues insight jobs for users whose local time
 * matches their preferred notification time.
 */
import { getQueue } from "../../core/queue.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "insight-dispatcher" });

/**
 * Common IANA timezone identifiers supported by the app
 * These map to UTC offsets for efficient querying
 */
const SUPPORTED_TIMEZONES = [
  'Pacific/Honolulu',      // UTC-10
  'America/Anchorage',     // UTC-9
  'America/Los_Angeles',   // UTC-8
  'America/Denver',        // UTC-7
  'America/Chicago',       // UTC-6
  'America/New_York',      // UTC-5
  'America/Sao_Paulo',     // UTC-3
  'Europe/London',         // UTC+0
  'Europe/Paris',          // UTC+1
  'Europe/Moscow',         // UTC+3
  'Asia/Dubai',            // UTC+4
  'Asia/Kolkata',          // UTC+5:30
  'Asia/Bangkok',          // UTC+7
  'Asia/Shanghai',         // UTC+8
  'Asia/Tokyo',            // UTC+9
  'Australia/Sydney',      // UTC+11
  'Pacific/Auckland',      // UTC+12
] as const;

type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number];

interface NotificationSettings {
  enabled: boolean;
  morning_enabled: boolean;
  evening_enabled: boolean;
  morning_time: string;
  evening_time: string;
}

interface UserForDispatch {
  id: string;
  timezone: string;
  notification_settings: NotificationSettings;
}

/**
 * Get the current hour in a specific timezone
 */
function getCurrentHourInTimezone(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

/**
 * Parse time string "HH:MM" to hour number
 */
function parseHour(timeStr: string): number {
  const [hours] = timeStr.split(':').map(Number);
  return hours;
}

/**
 * Find users whose local time matches their notification preference
 */
async function findUsersForInsightType(
  insightType: 'morning' | 'evening'
): Promise<UserForDispatch[]> {
  const supabase = getSupabase();

  // Get all users with notifications enabled
  const { data: users, error } = await supabase
    .from('unified_users')
    .select('id, timezone, notification_settings')
    .eq('is_telegram_linked', true)
    .eq('is_banned', false);

  if (error) {
    logger.error({ error }, 'Failed to query users for dispatch');
    return [];
  }

  if (!users || users.length === 0) {
    return [];
  }

  // Filter users whose local time matches their preference
  const matchingUsers: UserForDispatch[] = [];

  for (const user of users) {
    const settings = user.notification_settings as NotificationSettings;

    // Skip if notifications disabled
    if (!settings?.enabled) continue;

    // Check insight-specific toggle
    if (insightType === 'morning' && !settings.morning_enabled) continue;
    if (insightType === 'evening' && !settings.evening_enabled) continue;

    // Get preferred time
    const preferredTime = insightType === 'morning'
      ? (settings.morning_time || '08:00')
      : (settings.evening_time || '20:00');

    const preferredHour = parseHour(preferredTime);
    const currentHour = getCurrentHourInTimezone(user.timezone || 'Europe/Moscow');

    // Match if current hour equals preferred hour
    if (currentHour === preferredHour) {
      matchingUsers.push({
        id: user.id,
        timezone: user.timezone,
        notification_settings: settings,
      });
    }
  }

  return matchingUsers;
}

/**
 * Dispatch morning insight jobs
 * Called every hour by scheduler
 */
export async function dispatchMorningInsights(): Promise<void> {
  const boss = await getQueue();
  const users = await findUsersForInsightType('morning');

  if (users.length === 0) {
    logger.debug('No users for morning insight this hour');
    return;
  }

  logger.info({ count: users.length }, 'Dispatching morning insight jobs');

  // Queue individual jobs for each user
  for (const user of users) {
    await boss.send('morning-insight-single', {
      userId: user.id,
      timezone: user.timezone,
    });
  }

  logger.info({ count: users.length }, 'Morning insight jobs dispatched');
}

/**
 * Dispatch evening insight jobs
 * Called every hour by scheduler
 */
export async function dispatchEveningInsights(): Promise<void> {
  const boss = await getQueue();
  const users = await findUsersForInsightType('evening');

  if (users.length === 0) {
    logger.debug('No users for evening insight this hour');
    return;
  }

  logger.info({ count: users.length }, 'Dispatching evening insight jobs');

  // Queue individual jobs for each user
  for (const user of users) {
    await boss.send('evening-insight-single', {
      userId: user.id,
      timezone: user.timezone,
    });
  }

  logger.info({ count: users.length }, 'Evening insight jobs dispatched');
}
```

### 3.4 Updated Scheduler

File: `symancy-backend/src/modules/engagement/scheduler.ts`

```typescript
const SCHEDULES = {
  // ... existing schedules (inactive-reminder, weekly-checkin, photo-cleanup) ...

  // NEW: Hourly dispatchers (replace fixed-time schedules)
  "morning-insight-dispatcher": {
    cron: "0 * * * *", // Every hour at minute 0
    tz: "UTC",
    description: "Dispatch morning insights to users based on their timezone",
  },
  "evening-insight-dispatcher": {
    cron: "0 * * * *", // Every hour at minute 0
    tz: "UTC",
    description: "Dispatch evening insights to users based on their timezone",
  },

  // DEPRECATED: Remove these
  // "morning-insight": { cron: "0 8 * * *", tz: "Europe/Moscow" },
  // "evening-insight": { cron: "0 20 * * *", tz: "Europe/Moscow" },
} as const;
```

### 3.5 Updated Worker

File: `symancy-backend/src/modules/engagement/worker.ts`

Add new handlers for single-user jobs:

```typescript
/**
 * Process morning insight for a single user (dispatched by timezone)
 */
export async function processMorningInsightSingle(
  job: Job<{ userId: string; timezone: string }>
): Promise<void> {
  const { userId, timezone } = job.data;
  const jobLogger = logger.child({
    jobId: job.id,
    type: "morning-insight-single",
    userId,
    timezone,
  });

  jobLogger.info("Processing single user morning insight");

  try {
    const supabase = getSupabase();
    const proactiveService = getProactiveMessageService();

    // Fetch user details
    const { data: user, error } = await supabase
      .from('unified_users')
      .select('id, telegram_id, display_name, language_code, is_telegram_linked')
      .eq('id', userId)
      .single();

    if (error || !user || !user.is_telegram_linked || !user.telegram_id) {
      jobLogger.warn({ error }, 'User not found or not eligible');
      return;
    }

    // Check if already sent today (idempotency)
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('daily_insights')
      .select('id')
      .eq('unified_user_id', userId)
      .eq('date', today)
      .not('morning_advice', 'is', null)
      .maybeSingle();

    if (existing) {
      jobLogger.debug('Morning insight already sent today');
      return;
    }

    // Generate and send (reuse existing logic)
    let insight;
    let usedFallback = false;

    try {
      insight = await generateWithRetry(() =>
        generateMorningAdvice({
          userId: user.id,
          telegramId: user.telegram_id,
          displayName: user.display_name,
          languageCode: user.language_code,
        })
      );
    } catch (error) {
      jobLogger.warn({ error }, "AI generation failed, using static fallback");
      insight = getStaticMorningInsight(user.language_code);
      usedFallback = true;
    }

    // Save to database
    await supabase
      .from('daily_insights')
      .upsert({
        unified_user_id: userId,
        date: today,
        morning_advice: insight.text,
        morning_advice_short: insight.shortText,
        morning_sent_at: new Date().toISOString(),
        morning_tokens_used: insight.tokensUsed,
        context_data: insight.contextData,
      }, { onConflict: 'unified_user_id,date' });

    // Send to Telegram
    const header = getInsightHeader('morning', user.language_code);
    const message = `${header}\n\n${insight.text}`;

    await proactiveService.sendEngagementMessage(
      {
        id: user.id,
        telegramId: user.telegram_id,
        displayName: user.display_name,
        languageCode: user.language_code,
        lastActiveAt: new Date(),
      },
      'morning-insight',
      message
    );

    jobLogger.info({ usedFallback }, 'Morning insight sent successfully');

  } catch (error) {
    jobLogger.error({ error }, 'Failed to process morning insight');
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process evening insight for a single user (dispatched by timezone)
 */
export async function processEveningInsightSingle(
  job: Job<{ userId: string; timezone: string }>
): Promise<void> {
  // Similar implementation to morning, but:
  // 1. Check for morning_advice existence
  // 2. Generate evening insight linked to morning
  // 3. Send to user
  // ... (see full implementation below)
}
```

### 3.6 Frontend: Timezone Selector Component

New file: `src/components/features/settings/TimezoneSelector.tsx`

```typescript
/**
 * Timezone selector dropdown for user settings
 * Shows common timezones with current local time preview
 */
import React, { useState } from 'react';
import { translations } from '../../../lib/i18n';

interface TimezoneSelectorProps {
  currentTimezone: string;
  onSelect: (timezone: string) => void;
  t: (key: keyof typeof translations.en) => string;
}

const COMMON_TIMEZONES = [
  { code: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)', offset: -10 },
  { code: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)', offset: -8 },
  { code: 'America/Denver', label: 'Denver (UTC-7)', offset: -7 },
  { code: 'America/Chicago', label: 'Chicago (UTC-6)', offset: -6 },
  { code: 'America/New_York', label: 'New York (UTC-5)', offset: -5 },
  { code: 'America/Sao_Paulo', label: 'Sao Paulo (UTC-3)', offset: -3 },
  { code: 'Europe/London', label: 'London (UTC+0)', offset: 0 },
  { code: 'Europe/Paris', label: 'Paris (UTC+1)', offset: 1 },
  { code: 'Europe/Moscow', label: 'Moscow (UTC+3)', offset: 3 },
  { code: 'Asia/Dubai', label: 'Dubai (UTC+4)', offset: 4 },
  { code: 'Asia/Kolkata', label: 'Mumbai (UTC+5:30)', offset: 5.5 },
  { code: 'Asia/Bangkok', label: 'Bangkok (UTC+7)', offset: 7 },
  { code: 'Asia/Shanghai', label: 'Shanghai (UTC+8)', offset: 8 },
  { code: 'Asia/Tokyo', label: 'Tokyo (UTC+9)', offset: 9 },
  { code: 'Australia/Sydney', label: 'Sydney (UTC+11)', offset: 11 },
  { code: 'Pacific/Auckland', label: 'Auckland (UTC+12)', offset: 12 },
];

export function TimezoneSelector({
  currentTimezone,
  onSelect,
  t,
}: TimezoneSelectorProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const currentTz = COMMON_TIMEZONES.find(tz => tz.code === currentTimezone);
  const displayLabel = currentTz?.label || currentTimezone;

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0',
          borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
          cursor: 'pointer',
        }}
      >
        <span>{t('profile.timezone')}</span>
        <span style={{ color: 'var(--tg-theme-hint-color)' }}>
          {displayLabel}
        </span>
      </div>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
            border: '1px solid var(--tg-theme-hint-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            maxHeight: '300px',
            overflowY: 'auto',
            minWidth: '200px',
          }}
        >
          {COMMON_TIMEZONES.map(tz => (
            <div
              key={tz.code}
              role="option"
              aria-selected={tz.code === currentTimezone}
              onClick={() => {
                onSelect(tz.code);
                setIsOpen(false);
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: tz.code === currentTimezone
                  ? 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))'
                  : 'transparent',
              }}
            >
              {tz.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.7 Frontend: Time Picker Component

New file: `src/components/features/settings/InsightTimePicker.tsx`

```typescript
/**
 * Time picker for daily insight notification preferences
 * Shows hour selection in 24h format
 */
import React, { useState } from 'react';

interface InsightTimePickerProps {
  label: string;
  enabled: boolean;
  time: string; // "HH:MM"
  onEnabledChange: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0') + ':00'
);

export function InsightTimePicker({
  label,
  enabled,
  time,
  onEnabledChange,
  onTimeChange,
}: InsightTimePickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          style={{ width: '18px', height: '18px' }}
        />
        <span>{label}</span>
      </div>

      {enabled && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--tg-theme-hint-color)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            {time}
          </button>

          {isOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                backgroundColor: 'var(--tg-theme-bg-color)',
                border: '1px solid var(--tg-theme-hint-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                maxHeight: '200px',
                overflowY: 'auto',
                width: '100px',
              }}
            >
              {HOURS.map(hour => (
                <div
                  key={hour}
                  onClick={() => {
                    onTimeChange(hour);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: hour === time
                      ? 'var(--tg-theme-secondary-bg-color)'
                      : 'transparent',
                  }}
                >
                  {hour}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 3.8 Updated Profile Page

File: `src/pages/Profile.tsx`

Add new settings section after current notifications toggle:

```typescript
// Add new imports
import { TimezoneSelector } from '../components/features/settings/TimezoneSelector';
import { InsightTimePicker } from '../components/features/settings/InsightTimePicker';

// In Profile component, add handlers:
const handleTimezoneChange = useCallback(async (timezone: string) => {
  hapticFeedback.selection();
  // Update via API (unified_users.timezone is server-side)
  await updateUserTimezone(timezone);
}, [hapticFeedback]);

const handleInsightSettingsChange = useCallback(async (settings: Partial<NotificationSettings>) => {
  hapticFeedback.selection();
  await updateNotificationSettings(settings);
}, [hapticFeedback]);

// In Settings Card, add after notifications toggle:
<Card className="mx-4 mt-3">
  <CardContent className="p-4">
    <h2 className="mb-2 text-[15px] font-semibold">
      {t('profile.dailyInsights')}
    </h2>

    <TimezoneSelector
      currentTimezone={userTimezone || 'Europe/Moscow'}
      onSelect={handleTimezoneChange}
      t={t}
    />

    <InsightTimePicker
      label={t('profile.morningAdvice')}
      enabled={notificationSettings.morning_enabled}
      time={notificationSettings.morning_time || '08:00'}
      onEnabledChange={(enabled) =>
        handleInsightSettingsChange({ morning_enabled: enabled })
      }
      onTimeChange={(time) =>
        handleInsightSettingsChange({ morning_time: time })
      }
    />

    <InsightTimePicker
      label={t('profile.eveningInsight')}
      enabled={notificationSettings.evening_enabled}
      time={notificationSettings.evening_time || '20:00'}
      onEnabledChange={(enabled) =>
        handleInsightSettingsChange({ evening_enabled: enabled })
      }
      onTimeChange={(time) =>
        handleInsightSettingsChange({ evening_time: time })
      }
    />
  </CardContent>
</Card>
```

### 3.9 API Endpoints for User Settings

New file: `symancy-backend/src/api/settings/notification-settings.ts`

```typescript
/**
 * User notification settings API
 * Updates timezone and notification preferences
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSupabase } from '../../core/database.js';

interface UpdateTimezoneBody {
  timezone: string;
}

interface UpdateNotificationSettingsBody {
  enabled?: boolean;
  morning_enabled?: boolean;
  evening_enabled?: boolean;
  morning_time?: string;
  evening_time?: string;
}

/**
 * PATCH /api/settings/timezone
 */
export async function updateTimezone(
  request: FastifyRequest<{ Body: UpdateTimezoneBody }>,
  reply: FastifyReply
) {
  const userId = request.user?.unifiedUserId;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { timezone } = request.body;

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return reply.status(400).send({ error: 'Invalid timezone' });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('unified_users')
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return reply.send({ success: true, timezone });
}

/**
 * PATCH /api/settings/notifications
 */
export async function updateNotificationSettings(
  request: FastifyRequest<{ Body: UpdateNotificationSettingsBody }>,
  reply: FastifyReply
) {
  const userId = request.user?.unifiedUserId;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const updates = request.body;

  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):00$/;
  if (updates.morning_time && !timeRegex.test(updates.morning_time)) {
    return reply.status(400).send({ error: 'Invalid morning_time format' });
  }
  if (updates.evening_time && !timeRegex.test(updates.evening_time)) {
    return reply.status(400).send({ error: 'Invalid evening_time format' });
  }

  const supabase = getSupabase();

  // Get current settings
  const { data: user, error: fetchError } = await supabase
    .from('unified_users')
    .select('notification_settings')
    .eq('id', userId)
    .single();

  if (fetchError) {
    return reply.status(500).send({ error: fetchError.message });
  }

  // Merge with existing settings
  const newSettings = {
    ...user.notification_settings,
    ...updates,
  };

  const { error } = await supabase
    .from('unified_users')
    .update({
      notification_settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return reply.send({ success: true, notification_settings: newSettings });
}

/**
 * GET /api/settings/notifications
 */
export async function getNotificationSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user?.unifiedUserId;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('unified_users')
    .select('timezone, notification_settings')
    .eq('id', userId)
    .single();

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return reply.send({
    timezone: data.timezone,
    notification_settings: data.notification_settings,
  });
}
```

---

## 4. I18N Keys

Add to `src/lib/i18n.ts`:

```typescript
// Profile settings section
'profile.timezone': {
  ru: 'Часовой пояс',
  en: 'Timezone',
  zh: '时区',
},
'profile.dailyInsights': {
  ru: 'Ежедневные инсайты',
  en: 'Daily Insights',
  zh: '每日洞察',
},
'profile.morningAdvice': {
  ru: 'Утренний совет',
  en: 'Morning Advice',
  zh: '早间建议',
},
'profile.eveningInsight': {
  ru: 'Вечерний инсайт',
  en: 'Evening Insight',
  zh: '晚间感悟',
},
'profile.insightTime': {
  ru: 'Время отправки',
  en: 'Delivery time',
  zh: '发送时间',
},
```

---

## 5. Migration Plan

### Phase 1: Database (Day 1)
1. Apply migration to extend `notification_settings` schema
2. Add indexes for timezone queries
3. Backfill existing users with default values

### Phase 2: Backend Dispatcher (Day 1-2)
1. Create `dispatcher.ts` with timezone-aware logic
2. Update scheduler to use hourly dispatchers
3. Create single-user worker handlers
4. Add idempotency checks (don't send twice)
5. Test with multiple timezones

### Phase 3: API (Day 2)
1. Create notification settings API endpoints
2. Add timezone validation
3. Test API responses

### Phase 4: Frontend (Day 2-3)
1. Create TimezoneSelector component
2. Create InsightTimePicker component
3. Update Profile page with new settings
4. Add i18n translations
5. Test UI in all 3 languages

### Phase 5: Cleanup (Day 3)
1. Remove old fixed-time schedules
2. Update documentation
3. Monitor for issues

---

## 6. Testing Checklist

### Backend Tests
- [ ] Dispatcher correctly finds users by timezone
- [ ] Single-user worker processes correctly
- [ ] Idempotency: no duplicate sends
- [ ] Fallback to static on AI failure
- [ ] Timezone validation works
- [ ] API endpoints return correct data

### Frontend Tests
- [ ] TimezoneSelector shows all options
- [ ] InsightTimePicker allows hour selection
- [ ] Settings persist after page reload
- [ ] UI works in all 3 languages
- [ ] UI works in both themes

### Integration Tests
- [ ] End-to-end: change timezone → receive insight at new time
- [ ] End-to-end: disable morning → no morning insight
- [ ] End-to-end: change time → receive at new time

---

## 7. Monitoring

### Metrics to Track
- Insights sent per timezone per hour
- Dispatcher execution time
- Single-user job success rate
- User settings update rate

### Alerts
- Dispatcher taking > 5 minutes
- Success rate < 95%
- No insights sent in 24h

---

## 8. Files to Create/Modify

### New Files
1. `symancy-backend/src/modules/engagement/dispatcher.ts`
2. `symancy-backend/src/api/settings/notification-settings.ts`
3. `src/components/features/settings/TimezoneSelector.tsx`
4. `src/components/features/settings/InsightTimePicker.tsx`
5. `supabase/migrations/20260104_update_notification_settings.sql`

### Modified Files
1. `symancy-backend/src/modules/engagement/scheduler.ts` - hourly dispatchers
2. `symancy-backend/src/modules/engagement/worker.ts` - single-user handlers
3. `src/pages/Profile.tsx` - add timezone and time settings
4. `src/lib/i18n.ts` - add translations
5. `src/hooks/useCloudStorage.ts` - extend UserPreferences type (if syncing to CloudStorage)

### Files to Remove (after migration)
1. Old `morning-insight` and `evening-insight` fixed-time schedules from scheduler

---

## 9. Open Questions (Resolved)

1. **Auto-detect timezone from Telegram?**
   - Decision: Yes, use browser `Intl.DateTimeFormat().resolvedOptions().timeZone` for initial value

2. **What if user changes timezone mid-day?**
   - Decision: Next insight uses new timezone; idempotency prevents duplicate sends

3. **Support for 30-minute offsets (India, etc.)?**
   - Decision: Yes, supported via IANA timezone identifiers

---

## 10. Execution Checklist

- [ ] Create migration for notification_settings schema
- [ ] Implement dispatcher.ts
- [ ] Update scheduler.ts with hourly dispatchers
- [ ] Add single-user handlers to worker.ts
- [ ] Create API endpoints for settings
- [ ] Create TimezoneSelector component
- [ ] Create InsightTimePicker component
- [ ] Update Profile.tsx with new settings
- [ ] Add i18n translations (ru, en, zh)
- [ ] Write unit tests for dispatcher
- [ ] Write integration tests
- [ ] Deploy and monitor
- [ ] Remove old fixed-time schedules
- [ ] Update documentation

---

**nextAgent**: fullstack-nextjs-specialist or node-backend-specialist
