/**
 * Engagement Worker
 * Background worker that processes engagement jobs from pg-boss queue
 *
 * Handles three types of engagement messages:
 * 1. inactive-reminder: Users inactive for 7+ days
 * 2. weekly-checkin: Monday morning check-in
 * 3. daily-fortune: Daily fortune for users with spiritual goal
 */
import type { Job } from "pg-boss";
import { getBot } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { registerWorker } from "../../core/queue.js";
import {
  findInactiveUsers,
  createInactiveReminderMessage,
} from "./triggers/inactive.js";
import {
  findWeeklyCheckInUsers,
  createWeeklyCheckInMessage,
} from "./triggers/weekly-checkin.js";
import {
  findDailyFortuneUsers,
  createDailyFortuneMessage,
} from "./triggers/daily-fortune.js";

const logger = getLogger().child({ module: "engagement-worker" });

/**
 * Rate limit delay between sending messages (ms)
 * Telegram limit: ~30 messages/second to different users
 * We use 100ms (10 messages/second) to be safe
 */
const RATE_LIMIT_DELAY_MS = 100;

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log sent message to engagement_log table
 */
async function logSentMessage(
  telegramUserId: number,
  messageType: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from("engagement_log").insert({
    telegram_user_id: telegramUserId,
    message_type: messageType,
  });

  if (error) {
    logger.warn(
      { error, telegramUserId, messageType },
      "Failed to log sent message"
    );
    // Don't throw - logging failure is not critical
  }
}

/**
 * Process inactive reminder job
 * Finds inactive users and sends reminder messages
 */
export async function processInactiveReminder(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "inactive-reminder" });

  jobLogger.info("Starting inactive reminder processing");

  try {
    const users = await findInactiveUsers();

    if (users.length === 0) {
      jobLogger.info("No inactive users to remind");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending inactive reminders");

    const bot = getBot();
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      try {
        const message = createInactiveReminderMessage(user.name);

        await bot.api.sendMessage(user.chatId, message, {
          parse_mode: "HTML",
        });

        // Log sent message
        await logSentMessage(user.telegramUserId, "inactive-reminder");

        successCount++;
        jobLogger.debug({ userId: user.telegramUserId }, "Sent reminder");

        // Rate limiting
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        jobLogger.warn(
          { error, userId: user.telegramUserId },
          "Failed to send reminder to user"
        );
        // Continue with other users
      }
    }

    jobLogger.info(
      { total: users.length, success: successCount, failed: failureCount },
      "Inactive reminder processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Inactive reminder processing failed");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process weekly check-in job
 * Sends Monday morning check-in to all active users
 */
export async function processWeeklyCheckIn(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "weekly-checkin" });

  jobLogger.info("Starting weekly check-in processing");

  try {
    const users = await findWeeklyCheckInUsers();

    if (users.length === 0) {
      jobLogger.info("No users for weekly check-in");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending weekly check-ins");

    const bot = getBot();
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      try {
        const message = createWeeklyCheckInMessage(user.name);

        await bot.api.sendMessage(user.chatId, message, {
          parse_mode: "HTML",
        });

        // Log sent message
        await logSentMessage(user.telegramUserId, "weekly-checkin");

        successCount++;
        jobLogger.debug({ userId: user.telegramUserId }, "Sent check-in");

        // Rate limiting
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        jobLogger.warn(
          { error, userId: user.telegramUserId },
          "Failed to send check-in to user"
        );
        // Continue with other users
      }
    }

    jobLogger.info(
      { total: users.length, success: successCount, failed: failureCount },
      "Weekly check-in processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Weekly check-in processing failed");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process daily fortune job
 * Sends daily fortune to users with spiritual goal
 */
export async function processDailyFortune(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "daily-fortune" });

  jobLogger.info("Starting daily fortune processing");

  try {
    const users = await findDailyFortuneUsers();

    if (users.length === 0) {
      jobLogger.info("No users for daily fortune");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending daily fortunes");

    const bot = getBot();
    const message = createDailyFortuneMessage(); // Same message for all users
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      try {
        await bot.api.sendMessage(user.chatId, message, {
          parse_mode: "HTML",
        });

        // Log sent message
        await logSentMessage(user.telegramUserId, "daily-fortune");

        successCount++;
        jobLogger.debug({ userId: user.telegramUserId }, "Sent fortune");

        // Rate limiting
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        failureCount++;
        jobLogger.warn(
          { error, userId: user.telegramUserId },
          "Failed to send fortune to user"
        );
        // Continue with other users
      }
    }

    jobLogger.info(
      { total: users.length, success: successCount, failed: failureCount },
      "Daily fortune processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Daily fortune processing failed");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Register all engagement workers with pg-boss
 *
 * Configures workers with appropriate settings:
 * - batchSize: 1 (process one trigger at a time)
 * - pollingIntervalSeconds: 60 (check for new jobs every minute)
 *
 * @returns Array of worker IDs
 */
export async function registerEngagementWorkers(): Promise<string[]> {
  logger.info("Registering engagement workers");

  const workerIds: string[] = [];

  // Register inactive reminder worker
  const inactiveWorkerId = await registerWorker(
    "inactive-reminder",
    processInactiveReminder,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(inactiveWorkerId);
  logger.info({ workerId: inactiveWorkerId }, "Inactive reminder worker registered");

  // Register weekly check-in worker
  const weeklyWorkerId = await registerWorker(
    "weekly-checkin",
    processWeeklyCheckIn,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(weeklyWorkerId);
  logger.info({ workerId: weeklyWorkerId }, "Weekly check-in worker registered");

  // Register daily fortune worker
  const dailyWorkerId = await registerWorker(
    "daily-fortune",
    processDailyFortune,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(dailyWorkerId);
  logger.info({ workerId: dailyWorkerId }, "Daily fortune worker registered");

  logger.info({ count: workerIds.length }, "All engagement workers registered");

  return workerIds;
}
