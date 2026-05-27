/**
 * Referral Routes Registration
 *
 * Exposes the authenticated user's referral code, share link and stats.
 * Mirrors the auth pattern used by api/insights and api/settings: JWT is read
 * from the Authorization header and `payload.sub` is the caller's
 * unified_users.id (same convention as api/insights/today.ts where `sub` is
 * used directly as `unified_user_id`).
 *
 * Endpoint (nginx adds the /api prefix):
 * - GET /api/referral -> { code, link, stats }
 *
 * @module api/referral
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../../services/auth/JwtService.js";
import { getLogger } from "../../core/logger.js";
import { getEnv } from "../../config/env.js";
import { getOrCreateCode, getStats } from "../../modules/referrals/service.js";

const logger = getLogger().child({ module: "referral" });

/**
 * Response shape for GET /api/referral.
 */
interface ReferralResponse {
  code: string | null;
  link: string | null;
  stats: {
    code: string | null;
    invited: number;
    activated: number;
    credits_earned: number;
    pending: number;
  } | null;
}

/**
 * Extract and verify JWT from the Authorization header.
 *
 * @param request - Fastify request
 * @returns The unified_users.id (token `sub`) or null when unauthenticated
 */
function extractUnifiedUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload?.sub) {
    return null;
  }

  return payload.sub;
}

/**
 * Build the referral deep link for a given code.
 *
 * Uses BOT_USERNAME from validated env (NOT hardcoded) so the link points at
 * the deployment's configured bot.
 */
function buildReferralLink(code: string): string {
  const username = getEnv().BOT_USERNAME;
  return `https://t.me/${username}?start=ref_${code}`;
}

/**
 * Handle GET /api/referral.
 *
 * 1. Resolve unifiedUserId from JWT (401 if missing/invalid).
 * 2. Ensure a referral code exists (get_or_create_referral_code).
 * 3. Fetch aggregated stats (get_referral_stats).
 * 4. Return { code, link, stats }.
 */
export async function getReferralHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ReferralResponse | void> {
  const unifiedUserId = extractUnifiedUserId(request);

  if (!unifiedUserId) {
    return reply.status(401).send({
      error: "UNAUTHORIZED",
      message: "Missing or invalid authorization header",
    });
  }

  logger.debug({ unifiedUserId }, "Fetching referral info");

  const [code, stats] = await Promise.all([
    getOrCreateCode(unifiedUserId),
    getStats(unifiedUserId),
  ]);

  const link = code ? buildReferralLink(code) : null;

  logger.debug({ unifiedUserId, hasCode: code !== null }, "Referral info resolved");

  return reply.send({
    code,
    link,
    stats,
  } satisfies ReferralResponse);
}

/**
 * Register the referral route.
 *
 * @param fastify - Fastify instance
 *
 * @example
 * ```typescript
 * import { registerReferralRoutes } from './api/referral/index.js';
 *
 * // In app.ts:
 * registerReferralRoutes(fastify);
 * logger.info("Referral routes registered");
 * ```
 */
export function registerReferralRoutes(fastify: FastifyInstance): void {
  fastify.get("/referral", getReferralHandler);
}
