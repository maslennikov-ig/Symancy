/**
 * Account Linking Endpoint
 *
 * Handles POST /api/auth/link for linking Telegram account to web account.
 * Validates link token, merges accounts, and returns merged user.
 *
 * @module api/auth/link
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyToken } from '../../services/auth/JwtService.js';
import { validateAndConsumeLinkToken } from '../../services/auth/LinkTokenService.js';
import { getUserById } from '../../services/user/UnifiedUserService.js';
import { getSupabase } from '../../core/database.js';
import { getLogger } from '../../core/logger.js';
import type { UnifiedUser } from '../../types/omnichannel.js';
import { extractBearerToken } from '../../utils/auth.js';

const logger = getLogger().child({ module: 'link' });

/**
 * Link request body schema
 */
const LinkRequestSchema = z.object({
  /** Link token from /api/auth/link-token - must be exactly 64 hex characters */
  token: z
    .string()
    .length(64, 'Token must be exactly 64 characters')
    .regex(/^[a-f0-9]{64}$/, 'Token must be a valid hexadecimal string'),
});

/**
 * Link request body type
 */
type LinkRequestBody = z.infer<typeof LinkRequestSchema>;

/**
 * Handle POST /api/auth/link request
 *
 * Workflow:
 * 1. Extract JWT from Authorization header (web user logged in)
 * 2. Verify web user token using JwtService
 * 3. Validate request body (token present)
 * 4. Validate and consume link token
 * 5. Check if web user already has Telegram linked
 * 6. Check if Telegram user already linked to different web account
 * 7. Link Telegram ID to web user's unified account
 * 8. Return merged user data
 *
 * @param request - Fastify request with Authorization header and LinkRequestBody
 * @param reply - Fastify reply
 * @returns Success response with merged user or error
 *
 * @example
 * ```typescript
 * // POST /api/auth/link
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * // Body:
 * {
 *   "token": "abc123...def456..."
 * }
 *
 * // Response 200:
 * {
 *   "success": true,
 *   "user": {
 *     "id": "uuid...",
 *     "telegram_id": 123456789,
 *     "auth_id": "uuid...",
 *     "is_telegram_linked": true,
 *     ...
 *   }
 * }
 *
 * // Response 400 (invalid request):
 * {
 *   "error": "INVALID_REQUEST",
 *   "message": "Invalid request body",
 *   "details": { ... }
 * }
 *
 * // Response 400 (token expired):
 * {
 *   "error": "TOKEN_EXPIRED",
 *   "message": "Link token has expired"
 * }
 *
 * // Response 400 (token not found):
 * {
 *   "error": "TOKEN_NOT_FOUND",
 *   "message": "Link token not found or already used"
 * }
 *
 * // Response 401 (unauthorized):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Missing or invalid authorization header"
 * }
 *
 * // Response 409 (already linked):
 * {
 *   "error": "ACCOUNT_ALREADY_LINKED",
 *   "message": "This account is already linked to Telegram"
 * }
 * ```
 */
export async function linkHandler(
  request: FastifyRequest<{ Body: LinkRequestBody }>,
  reply: FastifyReply
) {
  const supabase = getSupabase();

  // Extract Authorization header (web user must be logged in)
  const authHeader = request.headers.authorization;
  const bearerToken = extractBearerToken(authHeader);

  if (!bearerToken) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  // Verify web user JWT token
  const webUserPayload = verifyToken(bearerToken);

  if (!webUserPayload) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  // Validate request body
  const parseResult = LinkRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    logger.warn({ errors: parseResult.error.flatten() }, 'Invalid link request');
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
  }

  const { token: linkToken } = parseResult.data;

  // Validate and consume link token
  const linkTokenValidation = await validateAndConsumeLinkToken(linkToken);

  if (!linkTokenValidation.valid) {
    logger.warn(
      { reason: linkTokenValidation.reason, webUserId: webUserPayload.sub },
      'Link token validation failed'
    );

    const errorCode = linkTokenValidation.reason || 'TOKEN_NOT_FOUND';
    const errorMessages = {
      TOKEN_NOT_FOUND: 'Link token not found or already used',
      TOKEN_EXPIRED: 'Link token has expired',
      TOKEN_ALREADY_USED: 'Link token has already been used',
      DATABASE_ERROR: 'Database error occurred',
    };

    return reply.status(400).send({
      error: errorCode,
      message: errorMessages[errorCode] || 'Link token validation failed',
    });
  }

  // Extract Telegram user from link token
  const telegramUser = linkTokenValidation.unifiedUser!;

  // Get web user from database
  const webUser = await getUserById(webUserPayload.sub);

  if (!webUser) {
    logger.warn({ userId: webUserPayload.sub }, 'Web user not found for valid token');
    return reply.status(404).send({
      error: 'USER_NOT_FOUND',
      message: 'Web user not found',
    });
  }

  // Check if web user already has Telegram linked
  if (webUser.telegram_id !== null) {
    logger.warn(
      {
        webUserId: webUser.id,
        existingTelegramId: webUser.telegram_id,
        attemptedTelegramId: telegramUser.telegram_id,
      },
      'Web user already linked to Telegram'
    );
    return reply.status(409).send({
      error: 'ACCOUNT_ALREADY_LINKED',
      message: 'This account is already linked to Telegram',
    });
  }

  // Check if Telegram user is already linked to a different auth_id
  if (telegramUser.auth_id !== null && telegramUser.auth_id !== webUser.auth_id) {
    logger.warn(
      {
        telegramUserId: telegramUser.id,
        existingAuthId: telegramUser.auth_id,
        attemptedAuthId: webUser.auth_id,
      },
      'Telegram user already linked to different web account'
    );
    return reply.status(409).send({
      error: 'ACCOUNT_ALREADY_LINKED',
      message: 'This Telegram account is already linked to a different web account',
    });
  }

  // Link accounts: Add telegram_id to web user's unified_users record
  // We keep the web user's record and add the Telegram ID to it
  const { data: mergedUser, error: updateError } = await supabase
    .from('unified_users')
    .update({
      telegram_id: telegramUser.telegram_id,
      is_telegram_linked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', webUser.id)
    .select()
    .single();

  if (updateError) {
    logger.error(
      { error: updateError, webUserId: webUser.id, telegramId: telegramUser.telegram_id },
      'Failed to link accounts'
    );
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to link accounts',
    });
  }

  // If Telegram user had a separate unified_users record, we should merge data and delete it
  // This handles the case where the Telegram user existed independently before linking
  if (telegramUser.id !== webUser.id) {
    logger.info(
      {
        telegramUserId: telegramUser.id,
        webUserId: webUser.id,
        telegramId: telegramUser.telegram_id,
      },
      'Merging separate Telegram and web user records'
    );

    // Merge credits atomically using PostgreSQL function
    // Note: user_credits.user_id maps to auth.users.id, which is unified_users.auth_id
    if (telegramUser.auth_id && webUser.auth_id) {
      const { data: mergeResult, error: mergeError } = await supabase.rpc(
        'merge_user_credits',
        {
          source_user_id: telegramUser.auth_id,
          target_user_id: webUser.auth_id,
        }
      );

      if (mergeError) {
        logger.error(
          {
            error: mergeError,
            sourceUserId: telegramUser.id,
            sourceAuthId: telegramUser.auth_id,
            targetUserId: webUser.id,
            targetAuthId: webUser.auth_id,
          },
          'Failed to merge credits (non-fatal, continuing)'
        );
        // Non-fatal: continue with account linking even if credits merge fails
      } else if (mergeResult && mergeResult.length > 0) {
        const merged = mergeResult[0];
        logger.info(
          {
            sourceUserId: telegramUser.id,
            targetUserId: webUser.id,
            mergedCredits: {
              basic: merged.merged_basic,
              pro: merged.merged_pro,
              cassandra: merged.merged_cassandra,
            },
            sourceDeleted: merged.source_deleted,
          },
          'Credits merged atomically'
        );
      } else {
        logger.info(
          { sourceUserId: telegramUser.id, targetUserId: webUser.id },
          'No credits to merge (one or both users have no credit records)'
        );
      }
    } else {
      logger.info(
        {
          sourceUserId: telegramUser.id,
          sourceAuthId: telegramUser.auth_id,
          targetUserId: webUser.id,
          targetAuthId: webUser.auth_id,
        },
        'Skipping credit merge: one or both users have no auth_id'
      );
    }

    // Delete the separate Telegram user record (cascades to related data)
    const { error: deleteError } = await supabase
      .from('unified_users')
      .delete()
      .eq('id', telegramUser.id);

    if (deleteError) {
      logger.error(
        { error: deleteError, telegramUserId: telegramUser.id },
        'Failed to delete separate Telegram user record (non-fatal)'
      );
      // Non-fatal: the main linking is done, cleanup failure is acceptable
    }
  }

  logger.info(
    {
      userId: webUser.id,
      telegramId: telegramUser.telegram_id,
      authId: webUser.auth_id,
    },
    'Accounts linked successfully'
  );

  return reply.send({
    success: true,
    user: mergedUser as UnifiedUser,
  });
}

/**
 * Register the account linking route with Fastify
 *
 * Registers POST /api/auth/link endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerLinkRoute(fastify: FastifyInstance) {
  fastify.post('/auth/link', linkHandler);
}
