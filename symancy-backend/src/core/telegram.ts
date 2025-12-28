/**
 * grammY Bot instance factory
 * Provides singleton bot instance with webhook support
 */
import { Bot, webhookCallback } from "grammy";
import type { Api } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { getEnv } from "../config/env.js";
import { getLogger } from "./logger.js";

// Re-export types for convenience
export type { Api, Bot } from "grammy";

let _bot: Bot | null = null;

/**
 * Get or create the grammY Bot instance
 * Configured with auto-retry and throttler plugins for rate limit handling
 */
export function getBot(): Bot {
  if (!_bot) {
    const env = getEnv();
    _bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    // Apply throttler first (proactive rate limiting)
    _bot.api.config.use(apiThrottler());

    // Then auto-retry (reactive fallback for 429/5xx errors)
    _bot.api.config.use(autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 60,
      rethrowInternalServerErrors: false,
      rethrowHttpErrors: false,
    }));

    const logger = getLogger().child({ module: "telegram" });
    logger.info("Bot instance created with auto-retry and throttler plugins");
  }
  return _bot;
}

/**
 * Get the Bot API for sending messages
 */
export function getBotApi(): Api {
  return getBot().api;
}

/**
 * Create webhook callback handler for Fastify
 * Validates webhook secret from X-Telegram-Bot-Api-Secret-Token header
 */
export function createWebhookHandler() {
  const env = getEnv();

  return webhookCallback(getBot(), "fastify", {
    secretToken: env.TELEGRAM_WEBHOOK_SECRET,
  });
}

/**
 * Set webhook URL for the bot
 * Call this during startup in production
 */
export async function setWebhook(url: string): Promise<void> {
  const env = getEnv();
  const logger = getLogger().child({ module: "telegram" });

  // Delete any existing webhook before setting new one
  // This prevents issues with stale webhooks
  await getBot().api.deleteWebhook({ drop_pending_updates: false });
  logger.info("Deleted existing webhook");

  await getBot().api.setWebhook(url, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });

  logger.info({ url }, "Webhook set successfully");
}

/**
 * Delete webhook (for cleanup or switching to polling)
 */
export async function deleteWebhook(): Promise<void> {
  const logger = getLogger().child({ module: "telegram" });
  await getBot().api.deleteWebhook();
  logger.info("Webhook deleted");
}

/**
 * Get bot info (username, id, etc.)
 */
export async function getBotInfo() {
  return getBot().api.getMe();
}
