/**
 * Main application entry point
 * Initializes Fastify server, Telegram bot, and pg-boss queue
 */
import Fastify from "fastify";
import { getEnv, isApiMode, isWorkerMode } from "./config/env.js";
import { getLogger, setupProcessErrorHandlers } from "./core/logger.js";
import { closeDatabase, getPool } from "./core/database.js";
import { getQueue, stopQueue, registerWorker } from "./core/queue.js";
import { createWebhookHandler, deleteWebhook } from "./core/telegram.js";
import { closeCheckpointer } from "./core/langchain/index.js";
import { setupRouter } from "./modules/router/index.js";
import {
  QUEUE_ANALYZE_PHOTO,
  QUEUE_CHAT_REPLY,
  QUEUE_SEND_MESSAGE,
} from "./config/constants.js";

const logger = getLogger();

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
  
  // Register workers (handlers will be implemented in Phase 3+)
  logger.info("Worker mode: registering queue handlers...");
  
  // Placeholder workers - will be replaced with actual handlers
  await registerWorker(QUEUE_ANALYZE_PHOTO, async (job) => {
    logger.info({ data: job.data }, "ANALYZE_PHOTO job received (handler not implemented)");
  });
  
  await registerWorker(QUEUE_CHAT_REPLY, async (job) => {
    logger.info({ data: job.data }, "CHAT_REPLY job received (handler not implemented)");
  });
  
  await registerWorker(QUEUE_SEND_MESSAGE, async (job) => {
    logger.info({ data: job.data }, "SEND_MESSAGE job received (handler not implemented)");
  });
  
  logger.info("Workers started");
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
