/**
 * Engagement Module
 * Proactive user engagement with scheduled messages
 *
 * Exports:
 * - setupScheduler: Configure pg-boss cron jobs
 * - registerEngagementWorkers: Register workers for processing jobs
 */

export { setupScheduler } from "./scheduler.js";
export { registerEngagementWorkers } from "./worker.js";

// Re-export trigger functions for testing/manual use
export {
  findInactiveUsers,
  createInactiveReminderMessage,
} from "./triggers/inactive.js";
export {
  findWeeklyCheckInUsers,
  createWeeklyCheckInMessage,
} from "./triggers/weekly-checkin.js";
export {
  findDailyFortuneUsers,
  createDailyFortuneMessage,
} from "./triggers/daily-fortune.js";
