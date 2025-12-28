/**
 * Conversation Service
 *
 * Service layer for managing conversations in the omnichannel system.
 * Handles conversation creation, retrieval, and state management.
 */

import { getSupabase } from '../../core/database.js';
import { getLogger } from '../../core/logger.js';
import type { Conversation, Persona } from '../../types/omnichannel.js';

const logger = getLogger().child({ module: 'conversation-service' });

/**
 * UUID validation regex (RFC 4122 compliant)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 *
 * @param value - String to validate
 * @returns True if valid UUID format
 */
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Get or create an active conversation for a unified user
 *
 * This function:
 * 1. Tries to find the most recent active conversation for the user
 * 2. If none exists, creates a new conversation with default settings
 *
 * @param unifiedUserId - The UUID of the unified user
 * @param persona - Optional persona to use for new conversation (defaults to 'arina')
 * @returns The active conversation (existing or newly created)
 * @throws Error if database operation fails
 */
export async function getOrCreateConversation(
  unifiedUserId: string,
  persona: Persona = 'arina'
): Promise<Conversation> {
  const supabase = getSupabase();

  logger.debug({ unifiedUserId, persona }, 'Getting or creating conversation');

  // Try to find most recent active conversation
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('unified_user_id', unifiedUserId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  // If found, return existing conversation
  if (existing && !findError) {
    logger.debug(
      {
        conversationId: existing.id,
        unifiedUserId,
        messageCount: existing.message_count,
      },
      'Found existing active conversation'
    );
    return existing as Conversation;
  }

  // PGRST116 = no rows returned (expected when user has no conversations)
  if (findError && findError.code !== 'PGRST116') {
    logger.error({ error: findError, unifiedUserId }, 'Failed to find conversation');
    throw new Error(`Failed to find conversation: ${findError.message}`);
  }

  // No active conversation found - create new one
  logger.debug({ unifiedUserId, persona }, 'Creating new conversation');

  const { data: newConversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      unified_user_id: unifiedUserId,
      persona,
      status: 'active',
      context: {},
      message_count: 0,
    })
    .select('*')
    .single();

  if (createError || !newConversation) {
    logger.error({ error: createError, unifiedUserId }, 'Failed to create conversation');
    throw new Error(`Failed to create conversation: ${createError?.message}`);
  }

  logger.info(
    {
      conversationId: newConversation.id,
      unifiedUserId,
      persona,
    },
    'Created new conversation'
  );

  return newConversation as Conversation;
}

/**
 * Get a conversation by ID
 *
 * @param conversationId - The UUID of the conversation
 * @returns The conversation or null if not found
 * @throws Error if database operation fails
 */
export async function getConversationById(
  conversationId: string
): Promise<Conversation | null> {
  const supabase = getSupabase();

  // Validate UUID format before database query
  if (!isValidUUID(conversationId)) {
    logger.error({ conversationId }, 'Invalid conversation ID format');
    throw new Error('Invalid conversation ID format');
  }

  logger.debug({ conversationId }, 'Getting conversation by ID');

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      logger.debug({ conversationId }, 'Conversation not found');
      return null;
    }

    logger.error({ error, conversationId }, 'Failed to get conversation');
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Increment message count for a conversation
 * Called after successfully storing a message
 *
 * @param conversationId - The UUID of the conversation
 * @throws Error if database operation fails
 */
export async function incrementMessageCount(conversationId: string): Promise<void> {
  const supabase = getSupabase();

  // Validate UUID format before RPC call
  if (!isValidUUID(conversationId)) {
    logger.error({ conversationId }, 'Invalid conversation ID format');
    throw new Error('Invalid conversation ID format');
  }

  logger.debug({ conversationId }, 'Incrementing message count');

  const { error } = await supabase.rpc('increment_conversation_message_count', {
    p_conversation_id: conversationId,
  });

  if (error) {
    logger.error({ error, conversationId }, 'Failed to increment message count');
    // Don't throw - this is a non-critical operation
    // The conversation will still work, just with an incorrect count
  }
}

/**
 * Archive a conversation (soft delete)
 *
 * @param conversationId - The UUID of the conversation
 * @throws Error if database operation fails
 */
export async function archiveConversation(conversationId: string): Promise<void> {
  const supabase = getSupabase();

  // Validate UUID format before database update
  if (!isValidUUID(conversationId)) {
    logger.error({ conversationId }, 'Invalid conversation ID format');
    throw new Error('Invalid conversation ID format');
  }

  logger.debug({ conversationId }, 'Archiving conversation');

  const { error } = await supabase
    .from('conversations')
    .update({ status: 'archived' })
    .eq('id', conversationId);

  if (error) {
    logger.error({ error, conversationId }, 'Failed to archive conversation');
    throw new Error(`Failed to archive conversation: ${error.message}`);
  }

  logger.info({ conversationId }, 'Conversation archived');
}
