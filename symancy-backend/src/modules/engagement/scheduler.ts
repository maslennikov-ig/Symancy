/**
 * Engagement Scheduler Setup
 * Configures pg-boss cron jobs for proactive engagement
 */
import { getQueue } from "../../core/queue.js";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "engagement-scheduler" });

/**
 * Schedule configuration for engagement triggers
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
  "daily-fortune": {
    cron: "0 8 * * *", // Daily at 8:00 MSK
    tz: "Europe/Moscow",
    description: "Daily fortune for users with spiritual goal",
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
