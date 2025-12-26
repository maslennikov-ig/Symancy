/**
 * Main application entry point
 * Initializes Fastify server, Telegram bot, and pg-boss queue
 */
import Fastify from "fastify";
import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import { getEnv, isApiMode, isWorkerMode } from "./config/env.js";
import { getLogger, setupProcessErrorHandlers } from "./core/logger.js";
import { closeDatabase, getPool } from "./core/database.js";
import { getQueue, stopQueue } from "./core/queue.js";
import { createWebhookHandler, deleteWebhook } from "./core/telegram.js";
import { closeCheckpointer } from "./core/langchain/index.js";
import { setupRouter } from "./modules/router/index.js";
import { registerPhotoWorker } from "./modules/photo-analysis/worker.js";
import { registerChatWorker } from "./modules/chat/worker.js";
import { setupScheduler, registerEngagementWorkers } from "./modules/engagement/index.js";
import { validatePromptsExist } from "./chains/validation.js";

const logger = getLogger();

/**
 * Validate and create photo storage directory
 */
async function validateStorage(): Promise<void> {
  const env = getEnv();
  const storagePath = env.PHOTO_STORAGE_PATH;

  try {
    await access(storagePath, constants.W_OK);
    logger.info({ path: storagePath }, "Storage directory validated");
  } catch {
    await mkdir(storagePath, { recursive: true });
    logger.info({ path: storagePath }, "Created storage directory");
  }
}

/**
 * Start API server with Fastify
 */
async function startApi() {
  const env = getEnv();

  // Initialize bot handlers BEFORE starting server
  setupRouter();
  logger.info("Bot router initialized");

  const fastify = Fastify({
    logger: false, // We use our own Pino logger
  });

  // Health check endpoint with database check
  fastify.get("/health", async (_request, reply) => {
    const health: {
      status: string;
      version: string;
      uptime: number;
      timestamp: string;
      checks: { database: string; queue: string };
    } = {
      status: "ok",
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: "unknown",
        queue: "unknown",
      },
    };

    // Check database connectivity
    try {
      const pool = getPool();
      const result = await pool.query("SELECT 1 as ping");
      const row = result.rows[0] as { ping: number } | undefined;
      health.checks.database = row?.ping === 1 ? "ok" : "error";
    } catch {
      health.checks.database = "error";
      health.status = "degraded";
    }

    // Check queue
    try {
      const boss = await getQueue();
      health.checks.queue = boss ? "ok" : "error";
    } catch {
      health.checks.queue = "error";
      health.status = "degraded";
    }

    if (health.status !== "ok") {
      reply.status(503);
    }

    return health;
  });

  // Telegram webhook endpoint
  fastify.post("/webhook/telegram", createWebhookHandler());

  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "API server listening");

  return fastify;
}

/**
 * Start queue workers
 */
async function startWorkers() {
  // Initialize queue
  await getQueue();

  logger.info("Worker mode: registering queue handlers...");

  // Clean up stale jobs from previous crashes (non-fatal)
  try {
    const { cleanupStaleLocks } = await import("./core/queue.js");
    const cleaned = await cleanupStaleLocks(5);
    if (cleaned > 0) {
      logger.warn({ cleaned }, "Cleaned up stale processing locks from previous crashes");
    }
  } catch (error) {
    logger.warn({ error }, "Skipping stale lock cleanup (pg-boss schema may not exist yet)");
  }

  // Register photo analysis worker
  const photoWorkerId = await registerPhotoWorker();
  logger.info({ workerId: photoWorkerId }, "Photo analysis worker registered");

  // Register chat reply worker
  const chatWorkerId = await registerChatWorker();
  logger.info({ workerId: chatWorkerId }, "Chat reply worker registered");

  // Setup engagement scheduler (pg-boss cron jobs)
  await setupScheduler();
  logger.info("Engagement scheduler configured");

  // Register engagement workers
  const engagementWorkerIds = await registerEngagementWorkers();
  logger.info({ count: engagementWorkerIds.length }, "Engagement workers registered");

  logger.info("All workers started");
}

/**
 * Graceful shutdown handler
 */
async function shutdown(fastify?: Awaited<ReturnType<typeof Fastify>>) {
  logger.info("Shutting down...");

  // Delete webhook to prevent message loss during restart
  try {
    await deleteWebhook();
    logger.info("Webhook deleted");
  } catch (error) {
    logger.warn({ error }, "Failed to delete webhook during shutdown");
  }

  if (fastify) {
    await fastify.close();
  }

  await stopQueue();
  await closeCheckpointer();
  await closeDatabase();

  logger.info("Shutdown complete");
  process.exit(0);
}

/**
 * Main application function
 */
async function main() {
  setupProcessErrorHandlers();

  const env = getEnv();
  logger.info({ mode: env.MODE }, "Starting application...");

  // Validate all prompt files exist before startup
  await validatePromptsExist();

  // Validate and create photo storage directory
  await validateStorage();

  let fastify: Awaited<ReturnType<typeof Fastify>> | undefined;

  if (isApiMode()) {
    fastify = await startApi();
  }

  if (isWorkerMode()) {
    await startWorkers();
  }
  
  // Graceful shutdown
  process.on("SIGTERM", () => shutdown(fastify));
  process.on("SIGINT", () => shutdown(fastify));
  
  logger.info("Application started successfully");
}

main().catch((error) => {
  logger.fatal({ error }, "Failed to start application");
  process.exit(1);
});
