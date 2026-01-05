/**
 * pg-boss queue wrapper
 * Provides job queue functionality backed by PostgreSQL
 */
import { PgBoss } from "pg-boss";
import type { Job, JobWithMetadata, WorkOptions, SendOptions } from "pg-boss";
import { getEnv } from "../config/env.js";
import { getLogger } from "./logger.js";
import {
  QUEUE_ANALYZE_PHOTO,
  QUEUE_CHAT_REPLY,
  QUEUE_SEND_MESSAGE,
  QUEUE_INACTIVE_REMINDER,
  QUEUE_WEEKLY_CHECKIN,
  QUEUE_DAILY_FORTUNE,
  QUEUE_PHOTO_CLEANUP,
  QUEUE_INSIGHT_DISPATCHER,
  QUEUE_MORNING_INSIGHT,
  QUEUE_EVENING_INSIGHT,
  QUEUE_MORNING_INSIGHT_SINGLE,
  QUEUE_EVENING_INSIGHT_SINGLE,
  JOB_TIMEOUT_MS,
} from "../config/constants.js";
import {
  PhotoAnalysisJobSchema,
  ChatReplyJobSchema,
  SendMessageJobSchema,
  type PhotoAnalysisJobData,
  type ChatReplyJobData,
  type SendMessageJobData,
} from "../types/job-schemas.js";

let _boss: PgBoss | null = null;

/**
 * Get or create pg-boss instance
 * Initializes the job queue system using PostgreSQL
 */
export async function getQueue(): Promise<PgBoss> {
  if (!_boss) {
    const env = getEnv();
    const logger = getLogger().child({ module: "queue" });

    _boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
    });

    // Error handling
    _boss.on("error", (error: Error) => {
      logger.error({ error }, "pg-boss error");
    });

    // Monitor maintenance operations (if needed)

    await _boss.start();
    logger.info("pg-boss started");

    // Create queues if they don't exist (required for pg-boss 12.x)
    const queuesToCreate = [
      QUEUE_ANALYZE_PHOTO,
      QUEUE_CHAT_REPLY,
      QUEUE_SEND_MESSAGE,
      QUEUE_INACTIVE_REMINDER,
      QUEUE_WEEKLY_CHECKIN,
      QUEUE_DAILY_FORTUNE,
      QUEUE_PHOTO_CLEANUP,
      QUEUE_INSIGHT_DISPATCHER,
      QUEUE_MORNING_INSIGHT,
      QUEUE_EVENING_INSIGHT,
      QUEUE_MORNING_INSIGHT_SINGLE,
      QUEUE_EVENING_INSIGHT_SINGLE,
    ];
    for (const queueName of queuesToCreate) {
      try {
        await _boss.createQueue(queueName);
        logger.debug({ queue: queueName }, "Queue created");
      } catch (error: unknown) {
        // Queue may already exist - that's fine
        if (error instanceof Error && !error.message.includes("already exists")) {
          logger.warn({ queue: queueName, error }, "Failed to create queue");
        }
      }
    }
  }
  return _boss;
}

/**
 * Send job to analyze photo queue
 * @param data - Job data (validated against PhotoAnalysisJobSchema)
 * @returns Job ID or null if failed
 */
export async function sendAnalyzePhotoJob(data: PhotoAnalysisJobData): Promise<string | null> {
  // Validate job data before sending
  const validated = PhotoAnalysisJobSchema.parse(data);

  const boss = await getQueue();
  return boss.send(QUEUE_ANALYZE_PHOTO, validated, {
    retryLimit: 3, // Retry up to 3 times
    retryDelay: 5, // Wait 5 seconds between retries
    expireInSeconds: JOB_TIMEOUT_MS / 1000, // Job expires after timeout
  });
}

/**
 * Send job to chat reply queue
 * @param data - Job data (validated against ChatReplyJobSchema)
 * @returns Job ID or null if failed
 */
export async function sendChatReplyJob(data: ChatReplyJobData): Promise<string | null> {
  // Validate job data before sending
  const validated = ChatReplyJobSchema.parse(data);

  const boss = await getQueue();
  return boss.send(QUEUE_CHAT_REPLY, validated, {
    retryLimit: 3,
    retryDelay: 5,
    expireInSeconds: JOB_TIMEOUT_MS / 1000,
  });
}

/**
 * Send job to send message queue
 * @param data - Job data (validated against SendMessageJobSchema)
 * @returns Job ID or null if failed
 */
export async function sendMessageJob(data: SendMessageJobData): Promise<string | null> {
  // Validate job data before sending
  const validated = SendMessageJobSchema.parse(data);

  const boss = await getQueue();
  return boss.send(QUEUE_SEND_MESSAGE, validated, {
    retryLimit: 3,
    retryDelay: 10, // Longer delay for message sending (rate limits)
    expireInSeconds: JOB_TIMEOUT_MS / 1000,
  });
}

/**
 * Send a generic job to any queue
 * @param queueName - Name of the queue
 * @param data - Job data
 * @param options - Job options (priority, retry, etc.)
 */
export async function sendJob(
  queueName: string,
  data: object,
  options?: SendOptions
): Promise<string | null> {
  const boss = await getQueue();
  const jobId = await boss.send(queueName, data, {
    expireInSeconds: JOB_TIMEOUT_MS / 1000,
    ...options,
  });
  return jobId;
}

/**
 * Check if error is retryable
 * Non-retryable errors: validation errors, ZodError
 * @param error - Error to check
 * @returns True if error should trigger retry
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name;

    // Don't retry validation errors
    if (
      message.includes("validation") ||
      message.includes("invalid") ||
      name === "ZodError"
    ) {
      return false;
    }
  }

  // Retry all other errors
  return true;
}

/**
 * Register worker for a queue
 * @param queueName - Name of the queue to work on
 * @param handler - Async function to handle jobs
 * @param options - Worker options (teamSize, teamConcurrency, etc.)
 */
export async function registerWorker<T extends object = object>(
  queueName: string,
  handler: (job: Job<T>) => Promise<void>,
  options?: WorkOptions
): Promise<string> {
  const boss = await getQueue();
  const logger = getLogger().child({ module: "queue", queue: queueName });

  const workerId = await boss.work<T>(
    queueName,
    options || {},
    async (jobs) => {
      // pg-boss passes an array of jobs
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobArray) {
        logger.info({ jobId: job.id }, "Processing job");
        try {
          await handler(job);
          logger.info({ jobId: job.id }, "Job completed");
        } catch (error) {
          logger.error({ jobId: job.id, error }, "Job failed");

          // Check if error is retryable
          if (isRetryableError(error)) {
            throw error; // pg-boss will retry based on retryLimit
          } else {
            logger.warn(
              { jobId: job.id, error },
              "Non-retryable error, job will not be retried"
            );
            // Don't throw - job will be marked as completed
          }
        }
      }
    }
  );

  logger.info({ workerId }, "Worker registered");
  return workerId;
}

/**
 * Register worker for a queue with job metadata (retry info, state, etc.)
 * Use this when you need access to retryCount, retryLimit, state, etc.
 *
 * @param queueName - Name of the queue to work on
 * @param handler - Async function to handle jobs with metadata
 * @param options - Worker options (teamSize, teamConcurrency, etc.)
 */
export async function registerWorkerWithMetadata<T extends object = object>(
  queueName: string,
  handler: (job: JobWithMetadata<T>) => Promise<void>,
  options?: Omit<WorkOptions, "includeMetadata">
): Promise<string> {
  const boss = await getQueue();
  const logger = getLogger().child({ module: "queue", queue: queueName });

  const workerId = await boss.work<T>(
    queueName,
    { ...options, includeMetadata: true },
    async (jobs) => {
      // pg-boss passes an array of jobs
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobArray) {
        logger.info(
          { jobId: job.id, retryCount: job.retryCount, retryLimit: job.retryLimit },
          "Processing job with metadata"
        );
        try {
          await handler(job);
          logger.info({ jobId: job.id }, "Job completed");
        } catch (error) {
          logger.error(
            { jobId: job.id, retryCount: job.retryCount, retryLimit: job.retryLimit, error },
            "Job failed"
          );

          // Check if error is retryable
          if (isRetryableError(error)) {
            throw error; // pg-boss will retry based on retryLimit
          } else {
            logger.warn(
              { jobId: job.id, error },
              "Non-retryable error, job will not be retried"
            );
            // Don't throw - job will be marked as completed
          }
        }
      }
    }
  );

  logger.info({ workerId }, "Worker with metadata registered");
  return workerId;
}

/**
 * Stop pg-boss (for graceful shutdown)
 * Should be called when the application is shutting down
 */
export async function stopQueue(): Promise<void> {
  if (_boss) {
    await _boss.stop();
    _boss = null;
    getLogger().child({ module: "queue" }).info("pg-boss stopped");
  }
}

/**
 * Clean up stale processing locks from previous crashes
 *
 * pg-boss jobs can get stuck if a worker crashes while processing.
 * This function fails stale jobs that have been processing for too long.
 *
 * @param maxAgeMinutes - Maximum age of jobs in processing state (default: 5 minutes)
 * @returns Number of jobs cleaned up
 */
export async function cleanupStaleLocks(maxAgeMinutes: number = 5): Promise<number> {
  const logger = getLogger().child({ module: "queue" });

  // Validate parameter to prevent SQL injection
  if (!Number.isInteger(maxAgeMinutes) || maxAgeMinutes <= 0 || maxAgeMinutes > 1440) {
    throw new Error("maxAgeMinutes must be an integer between 1 and 1440 (24 hours)");
  }

  try {
    // Initialize queue (needed for pool initialization)
    await getQueue();
    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - maxAgeMinutes);

    logger.info({ maxAgeMinutes, cutoffTime }, "Cleaning up stale processing locks");

    // pg-boss doesn't expose a direct API for this, so we use SQL directly
    // Query the pgboss.job table for stale jobs
    const pool = await import("../core/database.js").then((m) => m.getPool());

    const result = await pool.query(
      `
      UPDATE pgboss.job
      SET state = 'failed',
          completedon = NOW(),
          output = jsonb_build_object(
            'error', 'Job stale - cleared by cleanup task',
            'cleanedAt', NOW()
          )
      WHERE state = 'active'
        AND startedon < $1
      RETURNING id, name, startedon
      `,
      [cutoffTime]
    );

    const cleanedCount = result.rowCount || 0;

    if (cleanedCount > 0) {
      logger.warn(
        { cleanedCount, maxAgeMinutes },
        "Cleaned up stale processing locks"
      );

      // Log details of cleaned jobs
      for (const row of result.rows) {
        logger.debug(
          {
            jobId: row.id,
            jobName: row.name,
            startedOn: row.startedon,
          },
          "Stale job cleaned up"
        );
      }
    } else {
      logger.debug("No stale processing locks found");
    }

    return cleanedCount;
  } catch (error) {
    logger.error({ error }, "Failed to cleanup stale processing locks");
    throw error;
  }
}

/**
 * Queue names export (for convenience)
 */
export const QUEUES = {
  ANALYZE_PHOTO: QUEUE_ANALYZE_PHOTO,
  CHAT_REPLY: QUEUE_CHAT_REPLY,
  SEND_MESSAGE: QUEUE_SEND_MESSAGE,
} as const;
