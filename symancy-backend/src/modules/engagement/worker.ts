/**
 * Engagement Worker
 * Background worker that processes engagement jobs from pg-boss queue
 *
 * Handles three types of engagement messages:
 * 1. inactive-reminder: Users inactive for 7+ days
 * 2. weekly-checkin: Monday morning check-in
 * 3. daily-fortune: Daily fortune for users with spiritual goal
 *
 * Updated for Omnichannel (Phase 7):
 * - Uses ProactiveMessageService for user queries (unified_users table)
 * - Checks is_telegram_linked before sending (per spec US5)
 * - Handles bot blocked errors and marks users inactive
 */
import type { Job } from "pg-boss";
import { getLogger } from "../../core/logger.js";
import { registerWorker } from "../../core/queue.js";
import { getProactiveMessageService } from "../../services/proactive/index.js";
import {
  createInactiveReminderMessage,
} from "./triggers/inactive.js";
import {
  createWeeklyCheckInMessage,
} from "./triggers/weekly-checkin.js";
import {
  createDailyFortuneMessage,
} from "./triggers/daily-fortune.js";
import { cleanupExpiredPhotos } from "./triggers/photo-cleanup.js";

const logger = getLogger().child({ module: "engagement-worker" });

/**
 * Process inactive reminder job
 * Finds inactive users (from unified_users) and sends reminder messages
 *
 * Updated for Omnichannel: Uses ProactiveMessageService
 * - Queries unified_users instead of profiles
 * - Only sends to users with is_telegram_linked=true
 * - Handles bot blocked errors
 */
export async function processInactiveReminder(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "inactive-reminder" });

  jobLogger.info("Starting inactive reminder processing");

  try {
    const proactiveService = getProactiveMessageService();
    const users = await proactiveService.findInactiveUsers();

    if (users.length === 0) {
      jobLogger.info("No inactive users to remind");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending inactive reminders");

    // Use batch send with rate limiting
    const results = await proactiveService.sendBatchEngagementMessages(
      users,
      "inactive-reminder",
      (user) => createInactiveReminderMessage(user.displayName)
    );

    jobLogger.info(
      {
        total: results.total,
        success: results.success,
        failed: results.failed,
        blocked: results.blocked,
      },
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
 *
 * Updated for Omnichannel: Uses ProactiveMessageService
 * - Queries unified_users instead of profiles
 * - Only sends to users with is_telegram_linked=true
 * - Handles bot blocked errors
 */
export async function processWeeklyCheckIn(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "weekly-checkin" });

  jobLogger.info("Starting weekly check-in processing");

  try {
    const proactiveService = getProactiveMessageService();
    const users = await proactiveService.findWeeklyCheckInUsers();

    if (users.length === 0) {
      jobLogger.info("No users for weekly check-in");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending weekly check-ins");

    // Use batch send with rate limiting
    const results = await proactiveService.sendBatchEngagementMessages(
      users,
      "weekly-checkin",
      (user) => createWeeklyCheckInMessage(user.displayName)
    );

    jobLogger.info(
      {
        total: results.total,
        success: results.success,
        failed: results.failed,
        blocked: results.blocked,
      },
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
 *
 * Updated for Omnichannel: Uses ProactiveMessageService
 * - Queries unified_users instead of profiles
 * - Only sends to users with is_telegram_linked=true
 * - Handles bot blocked errors
 */
export async function processDailyFortune(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "daily-fortune" });

  jobLogger.info("Starting daily fortune processing");

  try {
    const proactiveService = getProactiveMessageService();
    const users = await proactiveService.findDailyFortuneUsers();

    if (users.length === 0) {
      jobLogger.info("No users for daily fortune");
      return;
    }

    jobLogger.info({ count: users.length }, "Sending daily fortunes");

    // Create message once (same for all users)
    const message = createDailyFortuneMessage();

    // Use batch send with rate limiting
    const results = await proactiveService.sendBatchEngagementMessages(
      users,
      "daily-fortune",
      () => message // Same message for all
    );

    jobLogger.info(
      {
        total: results.total,
        success: results.success,
        failed: results.failed,
        blocked: results.blocked,
      },
      "Daily fortune processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Daily fortune processing failed");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process photo cleanup job
 * Deletes old photos based on retention policy
 */
export async function processPhotoCleanup(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "photo-cleanup" });

  jobLogger.info("Starting photo cleanup processing");

  try {
    const deletedCount = await cleanupExpiredPhotos();

    jobLogger.info(
      { deletedCount },
      "Photo cleanup processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Photo cleanup processing failed");
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

  // Register photo cleanup worker
  const photoCleanupWorkerId = await registerWorker(
    "photo-cleanup",
    processPhotoCleanup,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(photoCleanupWorkerId);
  logger.info({ workerId: photoCleanupWorkerId }, "Photo cleanup worker registered");

  logger.info({ count: workerIds.length }, "All engagement workers registered");

  return workerIds;
}
