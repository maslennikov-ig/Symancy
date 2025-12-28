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
    return reply.status(400).send({
      error: 'INVALID_REQUEST',
      message: 'Invalid message data',
      details: parseResult.error.flatten(),
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

  // Verify JWT token
  const payload = verifyToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }

  const unifiedUserId = payload.sub;
  const { content, interface: interfaceType, content_type = 'text', temp_id, persona = 'arina' } = body;

  logger.info(
    { unifiedUserId, interfaceType, contentLength: content.length },
    'Processing send message request'
  );

  try {
    const supabase = getSupabase();

    // Get or create conversation
    let conversationId: string;

    if (body.conversation_id) {
      // Use provided conversation ID (validate it belongs to user)
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', body.conversation_id)
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

    // Insert user message into messages table
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        channel: 'web',
        interface: interfaceType,
        role: 'user',
        content,
        content_type,
        metadata: temp_id ? { temp_id } : {},
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
      content,
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
 * Registers POST /api/messages endpoint.
 *
 * @param fastify - Fastify instance
 */
export function registerSendMessageRoute(fastify: FastifyInstance) {
  fastify.post('/api/messages', sendMessageHandler);
}
