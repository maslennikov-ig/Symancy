/**
 * Create Conversation Endpoint
 *
 * Handles POST /api/conversations for creating or retrieving an active conversation.
 * Validates JWT and creates a conversation for the authenticated user.
 *
 * @module api/conversations/create-conversation
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyToken, isTelegramToken } from '../../services/auth/JwtService.js';
import { findOrCreateByAuthId } from '../../services/user/UnifiedUserService.js';
import { getOrCreateConversation } from '../../services/conversation/ConversationService.js';
import { getLogger } from '../../core/logger.js';
import type { Persona } from '../../types/omnichannel.js';

const logger = getLogger().child({ module: 'conversations' });

/**
 * Request body schema for creating a conversation
 */
const CreateConversationSchema = z.object({
  persona: z.enum(['arina', 'cassandra']).default('arina'),
});

/**
 * Request body type
 */
interface CreateConversationBody {
  persona?: 'arina' | 'cassandra';
}

/**
 * Handle POST /api/conversations request
 *
 * Workflow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Resolve unified_user_id based on token type (Telegram or Web)
 * 3. Get or create active conversation
 * 4. Return 201 with conversation object
 *
 * @param request - Fastify request with CreateConversationBody
 * @param reply - Fastify reply
 * @returns Conversation object (201)
 *
 * @example
 * ```typescript
 * // POST /api/conversations
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * // Body (optional):
 * {
 *   "persona": "arina"
 * }
 *
 * // Response 201:
 * {
 *   "id": "uuid...",
 *   "unified_user_id": "uuid...",
 *   "persona": "arina",
 *   "status": "active",
 *   "message_count": 0,
 *   "created_at": "2024-01-01T00:00:00.000Z",
 *   "updated_at": "2024-01-01T00:00:00.000Z"
 * }
 *
 * // Response 401 (unauthorized):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Missing or invalid authorization header"
 * }
 * ```
 */
export async function createConversationHandler(
  request: FastifyRequest<{ Body: CreateConversationBody }>,
  reply: FastifyReply
) {
  const body = request.body || {};

  // Validate request body using Zod schema
  const parseResult = CreateConversationSchema.safeParse(body);
  if (!parseResult.success) {
    logger.warn(
      { errors: parseResult.error.flatten(), body },
      'Invalid conversation request'
    );

    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Invalid request data',
      ...(process.env.NODE_ENV === 'development' && {
        details: parseResult.error.flatten(),
      }),
    });
  }

  const { persona } = parseResult.data;

  // Extract Authorization header
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  // Extract token (remove "Bearer " prefix)
  const token = authHeader.slice(7);

  // Verify JWT token with exception handling
  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'JWT verification failed with exception'
    );
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  if (!payload) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  // Resolve unified_user_id based on token type
  // - Telegram tokens: payload.sub is already unified_users.id
  // - Supabase Auth tokens: payload.sub is auth.users.id, need to lookup/create unified user
  let unifiedUserId: string;

  if (isTelegramToken(payload)) {
    // Telegram user - sub is already the unified_users.id
    unifiedUserId = payload.sub;
    logger.debug({ unifiedUserId, telegramId: payload.telegram_id }, 'Telegram user authenticated');
  } else {
    // Web user (Supabase Auth) - sub is auth.users.id, need to get/create unified user
    const authId = payload.sub;
    logger.debug({ authId }, 'Web user authenticated, resolving unified user');

    try {
      // Find or create unified user for this Supabase Auth user
      const unifiedUser = await findOrCreateByAuthId({
        authId,
        displayName: payload.email || undefined,
        languageCode: 'ru', // Default language
      });
      unifiedUserId = unifiedUser.id;
      logger.debug({ authId, unifiedUserId }, 'Resolved web user to unified user');
    } catch (error) {
      logger.error({ error, authId }, 'Failed to resolve unified user from auth_id');
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to resolve user',
      });
    }
  }

  // Get or create active conversation
  try {
    const conversation = await getOrCreateConversation(unifiedUserId, persona as Persona);

    logger.info(
      {
        conversationId: conversation.id,
        unifiedUserId,
        persona,
        isNew: conversation.message_count === 0,
      },
      'Conversation ready'
    );

    return reply.status(201).send(conversation);
  } catch (error) {
    logger.error({ error, unifiedUserId, persona }, 'Failed to get or create conversation');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create conversation',
    });
  }
}

/**
 * Register the create conversation route
 *
 * @param fastify - Fastify instance
 */
export function registerCreateConversationRoute(fastify: FastifyInstance): void {
  fastify.post('/conversations', {
    config: {
      rateLimit: {
        max: 10, // 10 conversations per minute
        timeWindow: '1 minute',
      },
    },
  }, createConversationHandler);
}
