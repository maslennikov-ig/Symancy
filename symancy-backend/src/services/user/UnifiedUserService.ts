/**
 * Unified User Service
 *
 * Service layer for managing unified users across all channels.
 * Uses database functions for complex operations and Supabase client for simple queries.
 */

import { getSupabase } from '../../core/database.js';
import { getLogger } from '../../core/logger.js';
import type { UnifiedUser, LanguageCode } from '../../types/omnichannel.js';

/**
 * Parameters for creating a user by Telegram ID
 */
export interface CreateUserParams {
  /** Telegram user ID */
  telegramId: number;
  /** User display name (first_name or first_name + last_name) */
  displayName: string;
  /** User language code (defaults to 'ru') */
  languageCode?: LanguageCode;
}

/**
 * Find or create a unified user by Telegram ID
 *
 * This function calls the database function `find_or_create_user_by_telegram`
 * which handles all the logic for finding existing users or creating new ones.
 *
 * @param params - User creation parameters
 * @returns The unified user (existing or newly created)
 * @throws Error if database operation fails
 */
export async function findOrCreateByTelegramId(
  params: CreateUserParams
): Promise<UnifiedUser> {
  const logger = getLogger().child({ module: 'unified-user-service' });
  const supabase = getSupabase();

  const { telegramId, displayName, languageCode = 'ru' } = params;

  logger.debug({ telegramId, displayName, languageCode }, 'Finding or creating user');

  const { data, error } = await supabase.rpc('find_or_create_user_by_telegram', {
    p_telegram_id: telegramId,
    p_display_name: displayName,
    p_language_code: languageCode,
  });

  if (error) {
    logger.error({ error, telegramId }, 'Failed to find or create user');
    throw new Error(`Failed to find or create user: ${error.message}`);
  }

  // Cast to UnifiedUser (database function returns a single row)
  const user = data as UnifiedUser;

  logger.info(
    {
      userId: user.id,
      telegramId,
      isNew: !user.onboarding_completed,
      displayName: user.display_name,
    },
    'User found or created'
  );

  return user;
}

/**
 * Get a unified user by ID
 *
 * @param userId - The UUID of the unified user
 * @returns The unified user or null if not found
 * @throws Error if database operation fails
 */
export async function getUserById(userId: string): Promise<UnifiedUser | null> {
  const logger = getLogger().child({ module: 'unified-user-service' });
  const supabase = getSupabase();

  logger.debug({ userId }, 'Getting user by ID');

  const { data, error } = await supabase
    .from('unified_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      logger.debug({ userId }, 'User not found');
      return null;
    }

    logger.error({ error, userId }, 'Failed to get user by ID');
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as UnifiedUser;
}

/**
 * Get a unified user by Telegram ID
 *
 * @param telegramId - The Telegram user ID
 * @returns The unified user or null if not found
 * @throws Error if database operation fails
 */
export async function getUserByTelegramId(telegramId: number): Promise<UnifiedUser | null> {
  const logger = getLogger().child({ module: 'unified-user-service' });
  const supabase = getSupabase();

  logger.debug({ telegramId }, 'Getting user by Telegram ID');

  const { data, error } = await supabase
    .from('unified_users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      logger.debug({ telegramId }, 'User not found');
      return null;
    }

    logger.error({ error, telegramId }, 'Failed to get user by Telegram ID');
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as UnifiedUser;
}

/**
 * Update user's last active timestamp
 *
 * @param userId - The UUID of the unified user
 * @throws Error if database operation fails
 */
export async function updateLastActive(userId: string): Promise<void> {
  const logger = getLogger().child({ module: 'unified-user-service' });
  const supabase = getSupabase();

  logger.debug({ userId }, 'Updating last active timestamp');

  const { error } = await supabase
    .from('unified_users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    logger.error({ error, userId }, 'Failed to update last active timestamp');
    throw new Error(`Failed to update last active: ${error.message}`);
  }

  logger.debug({ userId }, 'Last active timestamp updated');
}

/**
 * Mark user's onboarding as completed
 *
 * @param userId - The UUID of the unified user
 * @throws Error if database operation fails
 */
export async function completeOnboarding(userId: string): Promise<void> {
  const logger = getLogger().child({ module: 'unified-user-service' });
  const supabase = getSupabase();

  logger.debug({ userId }, 'Completing onboarding');

  const { error } = await supabase
    .from('unified_users')
    .update({ onboarding_completed: true })
    .eq('id', userId);

  if (error) {
    logger.error({ error, userId }, 'Failed to complete onboarding');
    throw new Error(`Failed to complete onboarding: ${error.message}`);
  }

  logger.info({ userId }, 'Onboarding completed');
}
