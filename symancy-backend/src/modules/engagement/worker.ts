/**
 * Engagement Worker
 * Background worker that processes engagement jobs from pg-boss queue
 *
 * Handles engagement messages:
 * 1. inactive-reminder: Users inactive for 7+ days
 * 2. weekly-checkin: Monday morning check-in
 * 3. morning-insight: Personalized daily morning advice (legacy batch)
 * 4. evening-insight: Personalized evening reflection (legacy batch)
 * 5. photo-cleanup: Clean up expired photos
 * 6. insight-dispatcher: Hourly timezone-aware dispatch (new)
 * 7. morning-insight-single: Single user morning insight (new)
 * 8. evening-insight-single: Single user evening insight (new)
 *
 * Updated for Omnichannel (Phase 7):
 * - Uses ProactiveMessageService for user queries (unified_users table)
 * - Checks is_telegram_linked before sending (per spec US5)
 * - Handles bot blocked errors and marks users inactive
 *
 * Updated for Daily Insights (spec 009):
 * - morning-insight: AI-generated personalized advice
 * - evening-insight: Reflection based on morning advice
 *
 * Updated for Timezone Support (spec 010):
 * - insight-dispatcher: Hourly cron that dispatches individual jobs
 * - morning-insight-single / evening-insight-single: Process per-user with idempotency
 */
import type { Job } from "pg-boss";
import { getLogger } from "../../core/logger.js";
import { getSupabase } from "../../core/database.js";
import { registerWorker } from "../../core/queue.js";
import { getProactiveMessageService } from "../../services/proactive/index.js";
import {
  createInactiveReminderMessage,
} from "./triggers/inactive.js";
import {
  createWeeklyCheckInMessage,
} from "./triggers/weekly-checkin.js";
import { cleanupExpiredPhotos } from "./triggers/photo-cleanup.js";
import {
  generateMorningAdvice,
  generateEveningInsight,
  generateWithRetry,
} from "../../chains/daily-insight.chain.js";
import {
  getStaticMorningInsight,
  getStaticEveningInsight,
} from "./triggers/static-insights.js";
import {
  dispatchMorningInsights,
  dispatchEveningInsights,
  getTodayInTimezone,
} from "./dispatcher.js";

const logger = getLogger().child({ module: "engagement-worker" });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Job data for single-user insight processing
 */
interface SingleInsightJobData {
  userId: string;
  timezone: string;
  telegramId: number;
  displayName: string | null;
  languageCode: string;
}

/**
 * Joined user data from daily_insights query
 */
interface JoinedUnifiedUser {
  id: string;
  telegram_id: number | null;
  display_name: string | null;
  language_code: string;
  is_telegram_linked: boolean;
}


/**
 * Message header translations for insights
 */
const INSIGHT_HEADERS: Record<string, { morning: string; evening: string }> = {
  ru: { morning: "☀️ Совет на день", evening: "🌙 Вечерний инсайт" },
  en: { morning: "☀️ Morning Advice", evening: "🌙 Evening Insight" },
  zh: { morning: "☀️ 早间建议", evening: "🌙 晚间感悟" },
};

/**
 * Get localized insight header
 */
function getInsightHeader(type: "morning" | "evening", languageCode: string): string {
  const defaultHeaders = { morning: "☀️ Morning Advice", evening: "🌙 Evening Insight" };
  const headers = INSIGHT_HEADERS[languageCode] ?? defaultHeaders;
  return headers[type];
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Process morning insight job
 * Generates and sends personalized AI-powered morning advice
 *
 * Updated for Daily Insights (spec 009):
 * - Uses DailyInsightChain for AI-generated content
 * - Saves insights to daily_insights table
 * - Sends to Telegram via ProactiveMessageService
 */
export async function processMorningInsight(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "morning-insight" });
  jobLogger.info("Starting morning insight processing");

  try {
    const proactiveService = getProactiveMessageService();
    const supabase = getSupabase();
    // Use same user query as daily fortune (all Telegram-linked users)
    const users = await proactiveService.findDailyFortuneUsers();

    if (users.length === 0) {
      jobLogger.info("No users for morning insight");
      return;
    }

    jobLogger.info({ count: users.length }, "Generating morning insights");

    let successCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        // Generate personalized advice with retry and fallback
        let insight;
        let usedFallback = false;

        try {
          insight = await generateWithRetry(() =>
            generateMorningAdvice({
              userId: user.id,
              telegramId: user.telegramId,
              displayName: user.displayName,
              languageCode: user.languageCode,
            })
          );
        } catch (error) {
          jobLogger.warn(
            { error, userId: user.id },
            "AI generation failed after retries, using static fallback"
          );
          insight = getStaticMorningInsight(user.languageCode);
          usedFallback = true;
        }

        // Debug logging for context data
        jobLogger.debug({
          userId: user.id,
          insightType: 'morning',
          messageCount: insight.contextData.message_ids.length,
          memoryCount: insight.contextData.memory_ids.length,
          hasLastAnalysis: !!insight.contextData.last_analysis_id,
          tokensUsed: insight.tokensUsed,
          textLength: insight.text.length,
          usedFallback,
        }, "Generated morning insight");

        const today = new Date().toISOString().split("T")[0];

        // Save to database (upsert)
        await supabase
          .from("daily_insights")
          .upsert({
            unified_user_id: user.id,
            date: today,
            morning_advice: insight.text,
            morning_advice_short: insight.shortText,
            morning_sent_at: new Date().toISOString(),
            morning_tokens_used: insight.tokensUsed,
            context_data: insight.contextData,
          }, { onConflict: "unified_user_id,date" });

        // Send to Telegram with localized header
        const header = getInsightHeader("morning", user.languageCode);
        const message = `${header}\n\n${insight.text}`;
        await proactiveService.sendEngagementMessage(user, "morning-insight", message);

        successCount++;

        // Rate limiting
        await sleep(200);
      } catch (error) {
        failedCount++;
        jobLogger.error({ error, userId: user.id }, "Failed to process user");
      }
    }

    jobLogger.info(
      { total: users.length, success: successCount, failed: failedCount },
      "Morning insight processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Morning insight processing failed");
    throw error;
  }
}

/**
 * Process evening insight job
 * Generates and sends personalized AI-powered evening reflection
 *
 * Updated for Daily Insights (spec 009):
 * - Finds users who received morning advice today
 * - Uses DailyInsightChain to generate evening reflection
 * - Links to morning advice for coherent daily cycle
 */
export async function processEveningInsight(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "evening-insight" });
  jobLogger.info("Starting evening insight processing");

  try {
    const supabase = getSupabase();
    const proactiveService = getProactiveMessageService();
    const today = new Date().toISOString().split("T")[0];

    // Find users who received morning insight today but not evening yet
    const { data: todaysInsights, error } = await supabase
      .from("daily_insights")
      .select(`
        id,
        unified_user_id,
        morning_advice,
        unified_users!inner(
          id,
          telegram_id,
          display_name,
          language_code,
          is_telegram_linked
        )
      `)
      .eq("date", today)
      .not("morning_advice", "is", null)
      .is("evening_insight", null);

    if (error) {
      throw new Error(`Failed to query daily insights: ${error.message}`);
    }

    if (!todaysInsights || todaysInsights.length === 0) {
      jobLogger.info("No users for evening insight");
      return;
    }

    jobLogger.info({ count: todaysInsights.length }, "Generating evening insights");

    let successCount = 0;
    let failedCount = 0;

    for (const row of todaysInsights) {
      // Supabase join returns unified_users as first element of array with !inner
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawRow = row as any;
      const user = rawRow.unified_users as JoinedUnifiedUser;

      if (!user || !user.is_telegram_linked || !user.telegram_id) {
        continue;
      }

      const insight = {
        id: rawRow.id as string,
        unified_user_id: rawRow.unified_user_id as string,
        morning_advice: rawRow.morning_advice as string | null,
        unified_users: user,
      };

      // Safety check: morning_advice should exist (query filters it)
      if (!insight.morning_advice) {
        jobLogger.warn({ insightId: insight.id }, "Morning advice is null, skipping");
        continue;
      }

      try {
        // Generate evening insight with retry and fallback
        let eveningInsight;
        let usedFallback = false;

        try {
          // user.telegram_id is guaranteed non-null after the check above
          eveningInsight = await generateWithRetry(() =>
            generateEveningInsight(
              {
                userId: user.id,
                telegramId: user.telegram_id!,
                displayName: user.display_name,
                languageCode: user.language_code,
              },
              insight.morning_advice!
            )
          );
        } catch (error) {
          jobLogger.warn(
            { error, insightId: insight.id },
            "Evening AI generation failed after retries, using static fallback"
          );
          eveningInsight = getStaticEveningInsight(user.language_code);
          usedFallback = true;
        }

        // Debug logging for context data
        jobLogger.debug({
          userId: user.id,
          insightId: insight.id,
          insightType: 'evening',
          messageCount: eveningInsight.contextData.message_ids.length,
          tokensUsed: eveningInsight.tokensUsed,
          textLength: eveningInsight.text.length,
          usedFallback,
        }, "Generated evening insight");

        // Update database
        await supabase
          .from("daily_insights")
          .update({
            evening_insight: eveningInsight.text,
            evening_insight_short: eveningInsight.shortText,
            evening_sent_at: new Date().toISOString(),
            evening_tokens_used: eveningInsight.tokensUsed,
          })
          .eq("id", insight.id);

        // Send to Telegram with localized header
        const header = getInsightHeader("evening", user.language_code);
        const message = `${header}\n\n${eveningInsight.text}`;
        await proactiveService.sendEngagementMessage(
          {
            id: user.id,
            telegramId: user.telegram_id!,
            displayName: user.display_name,
            languageCode: user.language_code,
            lastActiveAt: new Date(),
          },
          "evening-insight",
          message
        );

        successCount++;
        await sleep(200);
      } catch (error) {
        failedCount++;
        jobLogger.error({ error, insightId: insight.id }, "Failed to process user");
      }
    }

    jobLogger.info(
      { total: todaysInsights.length, success: successCount, failed: failedCount },
      "Evening insight processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Evening insight processing failed");
    throw error;
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

// =============================================================================
// TIMEZONE-AWARE HANDLERS (New in spec 010)
// =============================================================================

/**
 * Process insight dispatcher job (runs hourly)
 *
 * Dispatches morning and evening insights based on user timezones.
 * Each user gets their insight when their local time matches their preference.
 */
export async function processInsightDispatcher(job: Job): Promise<void> {
  const jobLogger = logger.child({ jobId: job.id, type: "insight-dispatcher" });

  jobLogger.info("Starting insight dispatcher processing");

  try {
    // Dispatch both morning and evening insights
    // Each function finds users whose local time matches their preference
    const [morningResult, eveningResult] = await Promise.all([
      dispatchMorningInsights(),
      dispatchEveningInsights(),
    ]);

    jobLogger.info(
      {
        morning: { dispatched: morningResult.dispatched, failed: morningResult.failed },
        evening: { dispatched: eveningResult.dispatched, failed: eveningResult.failed },
      },
      "Insight dispatcher processing completed"
    );
  } catch (error) {
    jobLogger.error({ error }, "Insight dispatcher processing failed");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process single user morning insight job
 *
 * Handles a single user's morning insight with:
 * - Idempotency check (no duplicate today in user's timezone)
 * - AI generation with fallback
 * - Database save and Telegram send
 */
export async function processMorningInsightSingle(
  job: Job<SingleInsightJobData>
): Promise<void> {
  const { userId, timezone, telegramId, displayName, languageCode } = job.data;
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

    // Get today's date in user's timezone for idempotency
    const todayInUserTz = getTodayInTimezone(timezone);

    // Idempotency check: already sent today?
    const { data: existing } = await supabase
      .from("daily_insights")
      .select("id, morning_sent_at")
      .eq("unified_user_id", userId)
      .eq("date", todayInUserTz)
      .not("morning_sent_at", "is", null)
      .maybeSingle();

    if (existing) {
      jobLogger.info(
        { existingId: existing.id, date: todayInUserTz },
        "Morning insight already sent today, skipping"
      );
      return;
    }

    // Generate personalized advice with retry and fallback
    let insight;
    let usedFallback = false;

    try {
      insight = await generateWithRetry(() =>
        generateMorningAdvice({
          userId,
          telegramId,
          displayName,
          languageCode,
        })
      );
    } catch (error) {
      jobLogger.warn(
        { error },
        "AI generation failed after retries, using static fallback"
      );
      insight = getStaticMorningInsight(languageCode);
      usedFallback = true;
    }

    jobLogger.debug({
      insightType: "morning",
      messageCount: insight.contextData.message_ids.length,
      memoryCount: insight.contextData.memory_ids.length,
      hasLastAnalysis: !!insight.contextData.last_analysis_id,
      tokensUsed: insight.tokensUsed,
      textLength: insight.text.length,
      usedFallback,
    }, "Generated morning insight");

    // Save to database (upsert with user's local date)
    await supabase
      .from("daily_insights")
      .upsert({
        unified_user_id: userId,
        date: todayInUserTz,
        morning_advice: insight.text,
        morning_advice_short: insight.shortText,
        morning_sent_at: new Date().toISOString(),
        morning_tokens_used: insight.tokensUsed,
        context_data: insight.contextData,
      }, { onConflict: "unified_user_id,date" });

    // Send to Telegram with localized header
    const header = getInsightHeader("morning", languageCode);
    const message = `${header}\n\n${insight.text}`;

    await proactiveService.sendEngagementMessage(
      {
        id: userId,
        telegramId,
        displayName,
        languageCode,
        lastActiveAt: new Date(),
      },
      "morning-insight",
      message
    );

    jobLogger.info("Morning insight sent successfully");
  } catch (error) {
    jobLogger.error({ error }, "Failed to process morning insight");
    throw error; // Trigger pg-boss retry
  }
}

/**
 * Process single user evening insight job
 *
 * Handles a single user's evening insight with:
 * - Idempotency check (no duplicate today in user's timezone)
 * - Requires morning advice to exist for coherent daily cycle
 * - AI generation with fallback
 * - Database save and Telegram send
 */
export async function processEveningInsightSingle(
  job: Job<SingleInsightJobData>
): Promise<void> {
  const { userId, timezone, telegramId, displayName, languageCode } = job.data;
  const jobLogger = logger.child({
    jobId: job.id,
    type: "evening-insight-single",
    userId,
    timezone,
  });

  jobLogger.info("Processing single user evening insight");

  try {
    const supabase = getSupabase();
    const proactiveService = getProactiveMessageService();

    // Get today's date in user's timezone
    const todayInUserTz = getTodayInTimezone(timezone);

    // Check for today's insight record
    const { data: todaysInsight, error } = await supabase
      .from("daily_insights")
      .select("id, morning_advice, evening_sent_at")
      .eq("unified_user_id", userId)
      .eq("date", todayInUserTz)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query daily insights: ${error.message}`);
    }

    // Idempotency check: already sent today?
    if (todaysInsight?.evening_sent_at) {
      jobLogger.info(
        { insightId: todaysInsight.id, date: todayInUserTz },
        "Evening insight already sent today, skipping"
      );
      return;
    }

    // Check if morning advice exists
    if (!todaysInsight?.morning_advice) {
      jobLogger.warn(
        { date: todayInUserTz },
        "No morning advice found for today, skipping evening insight"
      );
      return;
    }

    // Generate evening insight with retry and fallback
    let eveningInsight;
    let usedFallback = false;

    try {
      eveningInsight = await generateWithRetry(() =>
        generateEveningInsight(
          {
            userId,
            telegramId,
            displayName,
            languageCode,
          },
          todaysInsight.morning_advice
        )
      );
    } catch (error) {
      jobLogger.warn(
        { error },
        "Evening AI generation failed after retries, using static fallback"
      );
      eveningInsight = getStaticEveningInsight(languageCode);
      usedFallback = true;
    }

    jobLogger.debug({
      insightType: "evening",
      insightId: todaysInsight.id,
      messageCount: eveningInsight.contextData.message_ids.length,
      tokensUsed: eveningInsight.tokensUsed,
      textLength: eveningInsight.text.length,
      usedFallback,
    }, "Generated evening insight");

    // Update database
    await supabase
      .from("daily_insights")
      .update({
        evening_insight: eveningInsight.text,
        evening_insight_short: eveningInsight.shortText,
        evening_sent_at: new Date().toISOString(),
        evening_tokens_used: eveningInsight.tokensUsed,
      })
      .eq("id", todaysInsight.id);

    // Send to Telegram with localized header
    const header = getInsightHeader("evening", languageCode);
    const message = `${header}\n\n${eveningInsight.text}`;

    await proactiveService.sendEngagementMessage(
      {
        id: userId,
        telegramId,
        displayName,
        languageCode,
        lastActiveAt: new Date(),
      },
      "evening-insight",
      message
    );

    jobLogger.info("Evening insight sent successfully");
  } catch (error) {
    jobLogger.error({ error }, "Failed to process evening insight");
    throw error; // Trigger pg-boss retry
  }
}

// =============================================================================
// WORKER REGISTRATION
// =============================================================================

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

  // Register morning insight worker
  const morningWorkerId = await registerWorker(
    "morning-insight",
    processMorningInsight,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(morningWorkerId);
  logger.info({ workerId: morningWorkerId }, "Morning insight worker registered");

  // Register evening insight worker
  const eveningWorkerId = await registerWorker(
    "evening-insight",
    processEveningInsight,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(eveningWorkerId);
  logger.info({ workerId: eveningWorkerId }, "Evening insight worker registered");

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

  // ==========================================================================
  // Timezone-aware insight workers (new in spec 010)
  // ==========================================================================

  // Register insight dispatcher worker (runs hourly)
  const dispatcherWorkerId = await registerWorker(
    "insight-dispatcher",
    processInsightDispatcher,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(dispatcherWorkerId);
  logger.info({ workerId: dispatcherWorkerId }, "Insight dispatcher worker registered");

  // Register morning insight single-user worker
  const morningSingleWorkerId = await registerWorker<SingleInsightJobData>(
    "morning-insight-single",
    processMorningInsightSingle,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(morningSingleWorkerId);
  logger.info({ workerId: morningSingleWorkerId }, "Morning insight single worker registered");

  // Register evening insight single-user worker
  const eveningSingleWorkerId = await registerWorker<SingleInsightJobData>(
    "evening-insight-single",
    processEveningInsightSingle,
    {
      batchSize: 1,
      pollingIntervalSeconds: 60,
    }
  );
  workerIds.push(eveningSingleWorkerId);
  logger.info({ workerId: eveningSingleWorkerId }, "Evening insight single worker registered");

  logger.info({ count: workerIds.length }, "All engagement workers registered");

  return workerIds;
}
