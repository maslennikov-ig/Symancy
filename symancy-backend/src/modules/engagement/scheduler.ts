/**
 * Engagement Scheduler Setup
 * Configures pg-boss cron jobs for proactive engagement
 */
import { getQueue } from "../../core/queue.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "engagement-scheduler" });

/**
 * Schedule configuration for engagement triggers
 *
 * Updated for Timezone Support (spec 010):
 * - Added insight-dispatcher: Hourly cron that dispatches per-user jobs
 * - Legacy morning-insight/evening-insight kept for fallback (MSK users)
 */
const SCHEDULES = {
  "inactive-reminder": {
    cron: "0 10 * * *", // Daily at 10:00 MSK
    tz: "Europe/Moscow",
    description: "Check for inactive users (7+ days)",
  },
  "weekly-checkin": {
    cron: "0 10 * * 1", // Monday at 10:00 MSK
    tz: "Europe/Moscow",
    description: "Weekly check-in for all active users",
  },
  // DEPRECATED: Replaced by morning-insight
  // "daily-fortune": {
  //   cron: "0 8 * * *",
  //   tz: "Europe/Moscow",
  //   description: "Daily fortune for users with spiritual goal",
  // },

  // ==========================================================================
  // Timezone-aware insight dispatcher (new in spec 010)
  // Runs every hour and dispatches individual jobs based on user timezones
  // ==========================================================================
  "insight-dispatcher": {
    cron: "0 * * * *", // Every hour at minute 0
    tz: "UTC",
    description: "Dispatch daily insights based on user timezones",
  },

  // ==========================================================================
  // Legacy batch insight schedules (kept for fallback)
  // These will catch any users not processed by the dispatcher
  // ==========================================================================
  "morning-insight": {
    cron: "0 8 * * *", // Daily at 8:00 MSK
    tz: "Europe/Moscow",
    description: "Generate and send personalized morning advice (legacy batch)",
  },
  "evening-insight": {
    cron: "0 20 * * *", // Daily at 20:00 MSK
    tz: "Europe/Moscow",
    description: "Generate and send personalized evening insight (legacy batch)",
  },
  "photo-cleanup": {
    cron: "0 3 * * *", // Daily at 3:00 AM MSK
    tz: "Europe/Moscow",
    description: "Cleanup expired photos (7/90 day retention)",
  },
} as const;

/**
 * Setup all engagement schedulers
 * Should be called during app initialization (worker mode only)
 *
 * @throws Error if scheduler setup fails
 */
export async function setupScheduler(): Promise<void> {
  logger.info("Setting up engagement schedulers");

  const boss = await getQueue();

  try {
    for (const [jobName, config] of Object.entries(SCHEDULES)) {
      logger.debug({ jobName, cron: config.cron }, "Scheduling job");

      await boss.schedule(
        jobName,
        config.cron,
        {}, // No data needed for triggers
        { tz: config.tz }
      );

      logger.info(
        { jobName, cron: config.cron, tz: config.tz, description: config.description },
        "Job scheduled"
      );
    }

    logger.info("All engagement schedulers configured successfully");
  } catch (error) {
    logger.error({ error }, "Failed to setup engagement schedulers");
    throw new Error(
      `Failed to setup engagement schedulers: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
