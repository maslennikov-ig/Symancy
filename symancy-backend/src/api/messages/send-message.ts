/**
 * Send Message Endpoint
 *
 * Handles POST /api/messages for sending chat messages.
 * Validates JWT, manages conversations, checks credits, and queues chat reply job.
 *
 * @module api/messages/send-message
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SendMessageRequestSchema } from '../../types/omnichannel.js';
import { verifyToken } from '../../services/auth/JwtService.js';
import { getSupabase } from '../../core/database.js';
import { sendJob } from '../../core/queue.js';
import { QUEUE_CHAT_REPLY } from '../../config/constants.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger().child({ module: 'messages' });

/**
 * Maximum message length (matches Telegram limit)
 */
const MAX_MESSAGE_LENGTH = 4000;

/**
 * UUID validation regex (RFC 4122 compliant)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 * Prevents SQL injection by ensuring input is a valid UUID
 *
 * @param value - String to validate
 * @returns True if valid UUID format
 */
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Sanitize metadata fields
 * Only allows whitelisted keys with validated values
 *
 * @param metadata - Raw metadata object
 * @returns Sanitized metadata
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedKeys = ['temp_id', 'telegram_message_id', 'telegram_chat_id'];

  for (const key of allowedKeys) {
    if (key in metadata) {
      const value = metadata[key];

      if (typeof value === 'string') {
        // Remove control characters and limit length
        sanitized[key] = value
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .slice(0, 255);
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize message content
 * - Remove control characters (null bytes, etc.)
 * - Normalize excessive whitespace
 * - Trim leading/trailing whitespace
 *
 * @param content - Raw message content
 * @returns Sanitized content
 */
function sanitizeMessageContent(content: string): string {
  return content
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Remove control chars
    .replace(/\s+/g, ' ')  // Normalize whitespace to single space
    .trim();
}

/**
 * Send Message request body
 *
 * Matches SendMessageRequest from OpenAPI spec
 */
interface SendMessageBody {
  conversation_id?: string;
  content: string;
  interface: 'webapp' | 'browser';
  content_type?: string;
  temp_id?: string;
  persona?: string;
}

/**
 * Get or create active conversation for user
 *
 * @param unifiedUserId - UUID from unified_users.id
 * @param persona - AI persona ('arina' | 'cassandra')
 * @returns Conversation ID
 */
async function getOrCreateConversation(
  unifiedUserId: string,
  persona: 'arina' | 'cassandra' = 'arina'
): Promise<string> {
  const supabase = getSupabase();

  // Try to find active conversation
  const { data: existingConv, error: fetchError } = await supabase
    .from('conversations')
    .select('id')
    .eq('unified_user_id', unifiedUserId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!fetchError && existingConv) {
    logger.debug({ conversationId: existingConv.id, unifiedUserId }, 'Using existing conversation');
    return existingConv.id;
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabase
    .from('conversations')
    .insert({
      unified_user_id: unifiedUserId,
      persona,
      status: 'active',
      context: {},
      message_count: 0,
    })
    .select('id')
    .single();

  if (createError || !newConv) {
    logger.error({ error: createError, unifiedUserId }, 'Failed to create conversation');
    throw new Error('Failed to create conversation');
  }

  logger.info({ conversationId: newConv.id, unifiedUserId, persona }, 'Created new conversation');
  return newConv.id;
}

/**
 * Check if user has sufficient credits
 *
 * @param unifiedUserId - UUID from unified_users.id
 * @param persona - AI persona ('arina' | 'cassandra')
 * @returns True if user has credits
 */
async function checkCredits(
  unifiedUserId: string,
  persona: 'arina' | 'cassandra'
): Promise<boolean> {
  const supabase = getSupabase();

  // Get user credits
  const { data: credits, error } = await supabase
    .from('user_credits')
    .select('credits_basic, credits_cassandra')
    .eq('unified_user_id', unifiedUserId)
    .single();

  if (error) {
    // If no credits record exists, create one with zero credits
    if (error.code === 'PGRST116') {
      logger.debug({ unifiedUserId }, 'User has no credits record');
      return false;
    }

    logger.error({ error, unifiedUserId }, 'Failed to check credits');
    throw new Error('Failed to check credits');
  }

  // Check credit balance based on persona
  if (persona === 'cassandra') {
    return (credits?.credits_cassandra || 0) > 0;
  } else {
    // Arina uses basic credits
    return (credits?.credits_basic || 0) > 0;
  }
}

/**
 * Handle POST /api/messages request
 *
 * Workflow:
 * 1. Validate request body with Zod schema
 * 2. Extract and verify JWT from Authorization header
 * 3. Get or create conversation
 * 4. Check user has sufficient credits
 * 5. Insert user message into messages table
 * 6. Queue chat reply job to pg-boss
 * 7. Return 202 MessageAccepted response
 *
 * @param request - Fastify request with SendMessageBody
 * @param reply - Fastify reply
 * @returns MessageAccepted response (202)
 *
 * @example
 * ```typescript
 * // POST /api/messages
 * // Headers:
 * {
 *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * // Body:
 * {
 *   "content": "Hello Arina!",
 *   "interface": "webapp",
 *   "temp_id": "temp-123"
 * }
 *
 * // Response 202:
 * {
 *   "message_id": "uuid...",
 *   "conversation_id": "uuid...",
 *   "status": "pending",
 *   "temp_id": "temp-123"
 * }
 *
 * // Response 400 (invalid request):
 * {
 *   "error": "INVALID_REQUEST",
 *   "message": "Invalid message data",
 *   "details": { ... }
 * }
 *
 * // Response 401 (unauthorized):
 * {
 *   "error": "UNAUTHORIZED",
 *   "message": "Missing or invalid authorization header"
 * }
 *
 * // Response 402 (insufficient credits):
 * {
 *   "error": "INSUFFICIENT_CREDITS",
 *   "message": "Insufficient credits to send message"
 * }
 * ```
 */
export async function sendMessageHandler(
  request: FastifyRequest<{ Body: SendMessageBody }>,
  reply: FastifyReply
) {
  const body = request.body;

  // Validate request body using Zod schema
  const parseResult = SendMessageRequestSchema.safeParse(body);
  if (!parseResult.success) {
    logger.warn(
      { errors: parseResult.error.flatten(), body },
      'Invalid message request'
    );

    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Invalid message data',
      // Only expose details in development
      ...(process.env.NODE_ENV === 'development' && {
        details: parseResult.error.flatten(),
      }),
    });
  }

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

  // CRITICAL-2 FIX: Verify JWT token with exception handling
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

  const unifiedUserId = payload.sub;
  const { content, interface: interfaceType, content_type = 'text', temp_id, persona = 'arina' } = body;

  // Sanitize content
  const sanitizedContent = sanitizeMessageContent(content);

  if (sanitizedContent.length === 0) {
    logger.warn({ unifiedUserId }, 'Message content empty after sanitization');
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Message content is empty',
    });
  }

  // MED-8 FIX: Add maximum length validation
  if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
    logger.warn(
      { unifiedUserId, length: sanitizedContent.length },
      'Message content too long'
    );
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  logger.info(
    { unifiedUserId, interfaceType, contentLength: sanitizedContent.length },
    'Processing send message request'
  );

  try {
    const supabase = getSupabase();

    // Get or create conversation
    let conversationId: string;

    if (body.conversation_id) {
      // CRITICAL-1 FIX: Validate UUID format BEFORE database query
      // This prevents SQL injection by ensuring input is a valid UUID
      if (!isValidUUID(body.conversation_id)) {
        logger.warn(
          { unifiedUserId, conversationId: body.conversation_id },
          'Invalid conversation ID format'
        );
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid conversation ID format',
        });
      }

      // Use provided conversation ID (validate it belongs to user)
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', body.conversation_id)  // Safe: UUID validated above
        .eq('unified_user_id', unifiedUserId)
        .single();

      if (convError || !conv) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Conversation not found or does not belong to user',
        });
      }

      conversationId = conv.id;
    } else {
      // Create or get active conversation
      conversationId = await getOrCreateConversation(unifiedUserId, persona as 'arina' | 'cassandra');
    }

    // Check credits
    const hasEnoughCredits = await checkCredits(unifiedUserId, persona as 'arina' | 'cassandra');

    if (!hasEnoughCredits) {
      return reply.status(402).send({
        error: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits to send message',
      });
    }

    // HIGH-8 FIX: Sanitize metadata before insert
    const rawMetadata = temp_id ? { temp_id } : {};
    const sanitizedMetadata = sanitizeMetadata(rawMetadata);

    // Insert user message into messages table
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        channel: 'web',
        interface: interfaceType,
        role: 'user',
        content: sanitizedContent,  // Use sanitized content
        content_type,
        metadata: sanitizedMetadata,  // HIGH-8: Use sanitized metadata
        processing_status: 'pending',
      })
      .select('id')
      .single();

    if (messageError || !message) {
      logger.error({ error: messageError, unifiedUserId, conversationId }, 'Failed to insert message');
      throw new Error('Failed to insert message');
    }

    logger.debug({ messageId: message.id, conversationId }, 'User message inserted');

    // Queue chat reply job to pg-boss
    const jobId = await sendJob(QUEUE_CHAT_REPLY, {
      unified_user_id: unifiedUserId,
      conversation_id: conversationId,
      message_id: message.id,
      content: sanitizedContent,  // Use sanitized content
      persona,
      interface: interfaceType,
    });

    if (!jobId) {
      logger.error({ messageId: message.id, conversationId }, 'Failed to queue chat reply job');
      throw new Error('Failed to queue chat reply job');
    }

    logger.info({ messageId: message.id, jobId, conversationId }, 'Chat reply job queued');

    // Return 202 MessageAccepted
    return reply.status(202).send({
      message_id: message.id,
      conversation_id: conversationId,
      status: 'pending',
      temp_id: temp_id || undefined,
    });
  } catch (error) {
    logger.error({ error, unifiedUserId }, 'Failed to process send message');

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Failed to process message',
    });
  }
}

/**
 * Register the send message route with Fastify
 *
 * Registers POST /api/messages endpoint with stricter rate limiting.
 *
 * @param fastify - Fastify instance
 */
export function registerSendMessageRoute(fastify: FastifyInstance) {
  // HIGH-3 FIX: Add stricter rate limiting for message sending
  // More restrictive than global limit since this triggers LLM calls
  fastify.post('/api/messages', {
    config: {
      rateLimit: {
        max: 20,  // 20 messages per minute per user
        timeWindow: '1 minute',
      },
    },
  }, sendMessageHandler);
}
