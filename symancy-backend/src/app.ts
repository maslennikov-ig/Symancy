/**
 * Main application entry point
 * Initializes Fastify server, Telegram bot, and pg-boss queue
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import { getEnv, isApiMode, isWorkerMode } from "./config/env.js";
import { getLogger, setupProcessErrorHandlers } from "./core/logger.js";
import { closeDatabase, getPool } from "./core/database.js";
import { getQueue, stopQueue } from "./core/queue.js";
import { createWebhookHandler, setWebhook, getWebhookInfo } from "./core/telegram.js";
import { closeCheckpointer } from "./core/langchain/index.js";
import { setupRouter } from "./modules/router/index.js";
import { registerPhotoWorker } from "./modules/photo-analysis/worker.js";
import { registerChatWorker } from "./modules/chat/worker.js";
import { setupScheduler, registerEngagementWorkers } from "./modules/engagement/index.js";
import { validatePromptsExist } from "./chains/validation.js";
import { registerAuthRoutes } from "./api/auth/index.js";

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

  // SECURITY: Configure CORS for frontend origins
  await fastify.register(cors, {
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',      // Vite dev server
        'http://localhost:4173',      // Vite preview
        'https://symancy.ru',         // Production
        'https://www.symancy.ru',     // Production with www
        env.FRONTEND_URL              // Configurable via env
      ].filter(Boolean);

      // Allow requests with no origin (e.g., mobile apps, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS request from unauthorized origin');
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  logger.info("CORS configured");

  // SECURITY: Configure rate limiting to prevent abuse
  await fastify.register(rateLimit, {
    global: true,
    max: 100,                          // 100 requests per minute globally
    timeWindow: '1 minute',
    cache: 10000,                      // Cache size for rate limiting
    allowList: ['127.0.0.1'],          // Whitelist localhost for testing
    errorResponseBuilder: (request, context) => {
      logger.warn({
        ip: request.ip,
        url: request.url,
        max: context.max,
        after: context.after,
        banned: context.ban,
      }, 'Rate limit exceeded');
      return {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: context.after,
      };
    },
  });
  logger.info("Rate limiting configured");

  // Health check endpoint with database, queue, and webhook checks
  fastify.get("/health", async (_request, reply) => {
    const health: {
      status: string;
      version: string;
      uptime: number;
      timestamp: string;
      checks: { database: string; queue: string; webhook: string };
      webhookUrl?: string;
      pendingUpdates?: number;
    } = {
      status: "ok",
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: "unknown",
        queue: "unknown",
        webhook: "unknown",
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

    // Check Telegram webhook
    try {
      const webhookInfo = await getWebhookInfo();
      const expectedUrl = `${env.WEBHOOK_BASE_URL}/webhook/telegram`;
      health.webhookUrl = webhookInfo.url || undefined;
      health.pendingUpdates = webhookInfo.pending_update_count;

      if (webhookInfo.url === expectedUrl) {
        health.checks.webhook = "ok";
      } else if (webhookInfo.url) {
        health.checks.webhook = "misconfigured";
        health.status = "degraded";
      } else {
        health.checks.webhook = "not_set";
        health.status = "degraded";
      }
    } catch {
      health.checks.webhook = "error";
      health.status = "degraded";
    }

    if (health.status !== "ok") {
      reply.status(503);
    }

    return health;
  });

  // Telegram webhook endpoint
  fastify.post("/webhook/telegram", createWebhookHandler());

  // Version endpoint to verify deployed code
  fastify.get("/version", async () => {
    return {
      version: process.env.npm_package_version || "0.1.0",
      buildTime: process.env.BUILD_TIME || "unknown",
      gitCommit: process.env.GIT_COMMIT || "unknown",
      uptime: process.uptime(),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    };
  });

  // Register auth routes
  registerAuthRoutes(fastify);
  logger.info("Auth routes registered");

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

  // NOTE: We intentionally DO NOT delete webhook on shutdown
  // Telegram will queue messages (pending_update_count) and deliver them
  // when the bot comes back online. This prevents message loss during restarts.

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

    // Set up Telegram webhook after server is ready
    const webhookUrl = `${env.WEBHOOK_BASE_URL}/webhook/telegram`;
    try {
      await setWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Telegram webhook configured");
    } catch (error) {
      logger.error({ error, webhookUrl }, "Failed to set Telegram webhook");
    }
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
