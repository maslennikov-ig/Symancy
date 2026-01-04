/**
 * Timezone-Aware Insight Dispatcher
 *
 * Dispatches morning/evening insight jobs based on user timezones.
 * Called hourly by the scheduler to find users whose local time
 * matches their notification preferences.
 *
 * Architecture:
 * 1. Hourly cron job triggers processInsightDispatcher()
 * 2. Dispatcher finds users whose local time matches their preference
 * 3. Individual jobs are queued for each user (morning-insight-single / evening-insight-single)
 * 4. Workers process individual jobs with idempotency checks
 */
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { sendJob } from "../../core/queue.js";

const logger = getLogger().child({ module: "insight-dispatcher" });

// =============================================================================
// TYPES
// =============================================================================

/**
 * User eligible for timezone-based insight dispatch
 */
interface DispatchableUser {
  id: string;
  timezone: string;
  telegramId: number;
  displayName: string | null;
  languageCode: string;
}

/**
 * Notification settings from unified_users JSONB column
 */
interface NotificationSettings {
  enabled?: boolean;
  morning_enabled?: boolean;
  evening_enabled?: boolean;
  morning_time?: string; // "HH:MM" format
  evening_time?: string; // "HH:MM" format
}

/**
 * Raw user row from database
 */
interface RawUserRow {
  id: string;
  timezone: string | null;
  telegram_id: number | null;
  display_name: string | null;
  language_code: string;
  notification_settings: NotificationSettings | null;
}

// =============================================================================
// TIMEZONE UTILITIES
// =============================================================================

/**
 * Get current hour in a specific timezone (0-23)
 *
 * @param timezone - IANA timezone string (e.g., "Europe/Moscow", "America/New_York")
 * @returns Current hour in that timezone
 */
export function getCurrentHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch (error) {
    // Invalid timezone, fallback to Europe/Moscow
    logger.warn({ timezone, error }, "Invalid timezone, using Europe/Moscow");
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  }
}

/**
 * Parse time string "HH:MM" to hour number
 *
 * @param timeStr - Time string in "HH:MM" format
 * @returns Hour as integer (0-23)
 */
export function parseHour(timeStr: string): number {
  const [hoursStr] = timeStr.split(":");
  const hours = parseInt(hoursStr ?? "0", 10);
  return isNaN(hours) ? 0 : hours;
}

/**
 * Get today's date in a specific timezone as YYYY-MM-DD
 *
 * @param timezone - IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    // Fallback to UTC
    return new Date().toISOString().split("T")[0]!;
  }
}

// =============================================================================
// USER FINDING
// =============================================================================

/**
 * Find users whose local time matches their notification preference
 *
 * Logic:
 * 1. Query all Telegram-linked, non-banned users
 * 2. Filter in code: check if user's local hour matches their preferred time
 * 3. notification_settings.enabled AND morning_enabled/evening_enabled must be true
 *
 * @param insightType - 'morning' or 'evening'
 * @returns Array of users eligible for dispatch
 */
export async function findUsersForInsightType(
  insightType: "morning" | "evening"
): Promise<DispatchableUser[]> {
  const dispatchLogger = logger.child({ method: "findUsersForInsightType", insightType });

  dispatchLogger.debug("Finding users for insight dispatch");

  const supabase = getSupabase();

  // Query all eligible users
  const { data: users, error } = await supabase
    .from("unified_users")
    .select("id, timezone, telegram_id, display_name, language_code, notification_settings")
    .eq("is_telegram_linked", true)
    .eq("is_banned", false)
    .eq("onboarding_completed", true)
    .not("telegram_id", "is", null);

  if (error) {
    dispatchLogger.error({ error }, "Failed to query users");
    throw new Error(`Failed to query users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    dispatchLogger.debug("No eligible users found");
    return [];
  }

  // Filter users whose local time matches their preference
  const matchingUsers: DispatchableUser[] = [];

  for (const rawUser of users as RawUserRow[]) {
    // Skip users without telegram_id
    if (!rawUser.telegram_id) continue;

    // Get timezone (default to Europe/Moscow)
    const timezone = rawUser.timezone ?? "Europe/Moscow";

    // Get notification settings (default all enabled)
    const settings: NotificationSettings = rawUser.notification_settings ?? {
      enabled: true,
      morning_enabled: true,
      evening_enabled: true,
      morning_time: "08:00",
      evening_time: "20:00",
    };

    // Check if notifications are enabled
    if (settings.enabled === false) continue;

    // Check if specific insight type is enabled
    if (insightType === "morning" && settings.morning_enabled === false) continue;
    if (insightType === "evening" && settings.evening_enabled === false) continue;

    // Get preferred time for this insight type
    const preferredTime =
      insightType === "morning"
        ? settings.morning_time ?? "08:00"
        : settings.evening_time ?? "20:00";

    const preferredHour = parseHour(preferredTime);

    // Get current hour in user's timezone
    const currentHour = getCurrentHourInTimezone(timezone);

    // Check if current hour matches preferred hour
    if (currentHour === preferredHour) {
      matchingUsers.push({
        id: rawUser.id,
        timezone,
        telegramId: rawUser.telegram_id,
        displayName: rawUser.display_name,
        languageCode: rawUser.language_code,
      });
    }
  }

  dispatchLogger.info(
    { totalUsers: users.length, matchingUsers: matchingUsers.length },
    "Filtered users for insight dispatch"
  );

  return matchingUsers;
}

// =============================================================================
// DISPATCH FUNCTIONS
// =============================================================================

/**
 * Dispatch morning insight jobs for users whose local time is morning
 *
 * Called hourly by the scheduler. Finds users whose local time matches
 * their morning_time preference and queues individual jobs.
 */
export async function dispatchMorningInsights(): Promise<{
  dispatched: number;
  failed: number;
}> {
  const dispatchLogger = logger.child({ method: "dispatchMorningInsights" });

  dispatchLogger.info("Starting morning insight dispatch");

  try {
    const users = await findUsersForInsightType("morning");

    if (users.length === 0) {
      dispatchLogger.info("No users for morning insight dispatch");
      return { dispatched: 0, failed: 0 };
    }

    let dispatched = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const jobId = await sendJob(
          "morning-insight-single",
          {
            userId: user.id,
            timezone: user.timezone,
            telegramId: user.telegramId,
            displayName: user.displayName,
            languageCode: user.languageCode,
          },
          {
            retryLimit: 3,
            retryDelay: 60, // 1 minute between retries
          }
        );

        if (jobId) {
          dispatched++;
          dispatchLogger.debug(
            { userId: user.id, jobId, timezone: user.timezone },
            "Morning insight job dispatched"
          );
        } else {
          failed++;
          dispatchLogger.warn({ userId: user.id }, "Failed to dispatch morning insight job");
        }
      } catch (error) {
        failed++;
        dispatchLogger.error({ error, userId: user.id }, "Error dispatching morning insight job");
      }
    }

    dispatchLogger.info(
      { dispatched, failed, total: users.length },
      "Morning insight dispatch completed"
    );

    return { dispatched, failed };
  } catch (error) {
    dispatchLogger.error({ error }, "Morning insight dispatch failed");
    throw error;
  }
}

/**
 * Dispatch evening insight jobs for users whose local time is evening
 *
 * Called hourly by the scheduler. Finds users whose local time matches
 * their evening_time preference and queues individual jobs.
 */
export async function dispatchEveningInsights(): Promise<{
  dispatched: number;
  failed: number;
}> {
  const dispatchLogger = logger.child({ method: "dispatchEveningInsights" });

  dispatchLogger.info("Starting evening insight dispatch");

  try {
    const users = await findUsersForInsightType("evening");

    if (users.length === 0) {
      dispatchLogger.info("No users for evening insight dispatch");
      return { dispatched: 0, failed: 0 };
    }

    let dispatched = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const jobId = await sendJob(
          "evening-insight-single",
          {
            userId: user.id,
            timezone: user.timezone,
            telegramId: user.telegramId,
            displayName: user.displayName,
            languageCode: user.languageCode,
          },
          {
            retryLimit: 3,
            retryDelay: 60,
          }
        );

        if (jobId) {
          dispatched++;
          dispatchLogger.debug(
            { userId: user.id, jobId, timezone: user.timezone },
            "Evening insight job dispatched"
          );
        } else {
          failed++;
          dispatchLogger.warn({ userId: user.id }, "Failed to dispatch evening insight job");
        }
      } catch (error) {
        failed++;
        dispatchLogger.error({ error, userId: user.id }, "Error dispatching evening insight job");
      }
    }

    dispatchLogger.info(
      { dispatched, failed, total: users.length },
      "Evening insight dispatch completed"
    );

    return { dispatched, failed };
  } catch (error) {
    dispatchLogger.error({ error }, "Evening insight dispatch failed");
    throw error;
  }
}
