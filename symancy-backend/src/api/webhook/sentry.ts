/**
 * Sentry Webhook Handler
 *
 * Receives webhook events from Sentry's "Webhook Integration" (triggered by
 * Alert Rule actions: "Send a notification via an integration → Webhooks")
 * and forwards them to the admin Telegram chat.
 *
 * Authentication: shared secret in `?token=<value>` query param, compared
 * against env.SENTRY_WEBHOOK_SECRET via timingSafeEqual.
 *
 * Sentry webhook payload structure (legacy webhook integration):
 *   {
 *     id: string,              // event id
 *     project: string,         // numeric project id
 *     project_slug: string,    // e.g. "symancy-web"
 *     project_name: string,
 *     level: "fatal" | "error" | "warning" | "info" | "debug",
 *     culprit: string,
 *     message: string,
 *     url: string,             // sentry.io permalink
 *     triggering_rules: string[],
 *     event: { ... full event data ... }
 *   }
 *
 * @module api/webhook/sentry
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { timingSafeEqual } from "crypto";
import { getBotApi } from "@/core/telegram.js";
import { getEnv } from "@/config/env.js";
import { getLogger } from "@/core/logger.js";

/**
 * Subset of Sentry webhook payload we actually consume.
 * All fields are optional because Sentry's payload shape varies between
 * legacy webhooks and integration platforms.
 */
interface SentryWebhookBody {
  id?: string;
  project?: string | number;
  project_slug?: string;
  project_name?: string;
  level?: string;
  culprit?: string;
  message?: string;
  url?: string;
  triggering_rules?: string[];
  event?: {
    event_id?: string;
    environment?: string;
    release?: string;
    title?: string;
    tags?: Array<[string, string]> | Record<string, string>;
  };
}

/**
 * Severity emoji mapping
 */
const LEVEL_EMOJI: Record<string, string> = {
  fatal: "🔴",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  debug: "🐞",
};

/**
 * Telegram message length cap (~4096 chars; leave headroom for emoji/markup)
 */
const MAX_MESSAGE_LENGTH = 3500;

/**
 * Truncate text while preserving readability.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}\n…(truncated)`;
}

/**
 * Constant-time string comparison for shared-secret tokens.
 * Returns false on length mismatch without leaking timing information.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Format a Sentry payload into a plain-text Telegram message.
 */
export function formatSentryAlert(body: SentryWebhookBody): string {
  const level = (body.level || "error").toLowerCase();
  const emoji = LEVEL_EMOJI[level] || LEVEL_EMOJI.error;
  const projectLabel = body.project_slug || body.project_name || "unknown-project";
  const environment = body.event?.environment || "unknown";
  const release = body.event?.release;
  const title = body.event?.title || body.message || body.culprit || "Unknown error";
  const url = body.url;
  const rules =
    Array.isArray(body.triggering_rules) && body.triggering_rules.length > 0
      ? body.triggering_rules.join(", ")
      : undefined;

  let msg = `${emoji} SENTRY ${level.toUpperCase()}\n`;
  msg += `Project: ${projectLabel}\n`;
  msg += `Environment: ${environment}\n`;
  if (release) {
    msg += `Release: ${release}\n`;
  }
  if (rules) {
    msg += `Rule: ${rules}\n`;
  }
  msg += `\n${title}\n`;
  if (body.culprit && body.culprit !== title) {
    msg += `\nCulprit: ${body.culprit}\n`;
  }
  if (url) {
    msg += `\n${url}`;
  }

  return truncate(msg, MAX_MESSAGE_LENGTH);
}

/**
 * POST /webhook/sentry?token=<secret>
 *
 * Returns 401 if token missing/invalid, 503 if not configured, 200 on success.
 * Errors during Telegram delivery are logged but do not propagate — Sentry
 * retries are not desirable here.
 */
export async function sentryWebhookHandler(
  request: FastifyRequest<{
    Querystring: { token?: string };
    Body: SentryWebhookBody;
  }>,
  reply: FastifyReply
): Promise<{ ok: boolean }> {
  const logger = getLogger().child({ module: "sentry-webhook" });
  const env = getEnv();

  // Reject early if webhook is not configured
  if (!env.SENTRY_WEBHOOK_SECRET) {
    logger.warn("Sentry webhook hit but SENTRY_WEBHOOK_SECRET is not set");
    reply.status(503);
    return { ok: false };
  }

  // Authenticate via shared-secret token
  const token = request.query?.token;
  if (!token || !safeEqual(token, env.SENTRY_WEBHOOK_SECRET)) {
    logger.warn(
      { ip: request.ip, hasToken: Boolean(token) },
      "Sentry webhook rejected: invalid token"
    );
    reply.status(401);
    return { ok: false };
  }

  // Forward to Telegram admin (non-blocking on send errors)
  if (!env.ADMIN_CHAT_ID) {
    logger.warn("Sentry webhook received but ADMIN_CHAT_ID not set");
    reply.status(200);
    return { ok: true };
  }

  try {
    const message = formatSentryAlert(request.body || {});
    const api = getBotApi();
    await api.sendMessage(env.ADMIN_CHAT_ID, message, {
      parse_mode: undefined, // plain text avoids parse-error on stack traces
      link_preview_options: { is_disabled: true },
    });
    logger.info(
      { level: request.body?.level, project: request.body?.project_slug },
      "Forwarded Sentry alert to Telegram"
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to forward Sentry alert to Telegram"
    );
  }

  return { ok: true };
}
