/**
 * Webhook Routes Registration
 *
 * Centralized registration point for inbound webhook endpoints from
 * external services (currently: Sentry).
 *
 * Note: The grammY Telegram webhook is intentionally NOT registered here —
 * it lives on POST /webhook/telegram and is wired directly in app.ts via
 * createWebhookHandler() because it needs the raw fastify instance.
 *
 * @module api/webhook
 */
import type { FastifyInstance } from "fastify";
import { sentryWebhookHandler } from "./sentry.js";

/**
 * JSON schema for the Sentry webhook request.
 * We accept anything (Sentry's shape varies); body parsing is lenient.
 * The query token is required at the route level.
 */
const sentryWebhookSchema = {
  querystring: {
    type: "object" as const,
    required: ["token"],
    properties: {
      token: { type: "string", minLength: 1, maxLength: 256 },
    },
  },
  // Body schema kept open — Sentry may add fields without breaking us.
  body: {
    type: "object" as const,
    additionalProperties: true,
  },
};

/**
 * Register webhook routes.
 *
 * Endpoints:
 * - POST /webhook/sentry?token=<secret> — receive Sentry alert webhooks
 *   and forward them to the admin Telegram chat.
 *
 * @param fastify - Fastify instance
 */
export function registerWebhookRoutes(fastify: FastifyInstance): void {
  fastify.post(
    "/webhook/sentry",
    { schema: sentryWebhookSchema },
    sentryWebhookHandler
  );
}
