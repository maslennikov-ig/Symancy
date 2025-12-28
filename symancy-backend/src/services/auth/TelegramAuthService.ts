/**
 * Telegram Login Widget Authentication Service
 *
 * Verifies Telegram Login Widget authentication data using HMAC-SHA256 signature verification.
 * Based on official Telegram documentation: https://core.telegram.org/widgets/login#checking-authorization
 *
 * @module TelegramAuthService
 */

import crypto from 'node:crypto';
import { getEnv } from '../../config/env.js';
import { getLogger } from '../../core/logger.js';

/**
 * Telegram authentication data structure from Login Widget
 *
 * @interface TelegramAuthData
 * @property {number} id - Telegram user ID
 * @property {string} first_name - User's first name
 * @property {string} [last_name] - User's last name (optional)
 * @property {string} [username] - User's username (optional)
 * @property {string} [photo_url] - User's profile photo URL (optional)
 * @property {number} auth_date - Unix timestamp when authentication occurred
 * @property {string} hash - HMAC-SHA256 signature for verification
 */
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verification result with detailed error information
 */
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  userId?: number;
}

/**
 * Maximum allowed age for authentication data (24 hours in milliseconds)
 */
const MAX_AUTH_AGE_MS = 86400000; // 24 hours

/**
 * Verify Telegram Login Widget authentication data
 *
 * Performs the following checks:
 * 1. Validates auth_date is not older than 24 hours
 * 2. Creates data-check-string from sorted auth data
 * 3. Computes secret key as SHA256(bot_token)
 * 4. Calculates HMAC-SHA256 signature
 * 5. Compares calculated hash with provided hash
 *
 * @param {TelegramAuthData} data - Authentication data from Telegram Login Widget
 * @returns {VerificationResult} Verification result with success status and optional error reason
 *
 * @example
 * ```typescript
 * const authData = {
 *   id: 123456789,
 *   first_name: "John",
 *   username: "johndoe",
 *   auth_date: Math.floor(Date.now() / 1000),
 *   hash: "abc123..."
 * };
 *
 * const result = verifyTelegramAuth(authData);
 * if (result.valid) {
 *   console.log(`User ${result.userId} authenticated successfully`);
 * } else {
 *   console.error(`Authentication failed: ${result.reason}`);
 * }
 * ```
 */
export function verifyTelegramAuth(data: TelegramAuthData): VerificationResult {
  const startTime = Date.now();

  try {
    const { hash, ...authData } = data;

    // Validate required fields
    if (!data.id || !data.first_name || !data.auth_date || !data.hash) {
      getLogger().warn({
        hasId: !!data.id,
        hasFirstName: !!data.first_name,
        hasAuthDate: !!data.auth_date,
        hasHash: !!data.hash,
      }, 'Telegram auth verification failed: missing required fields');
      return {
        valid: false,
        reason: 'Missing required fields',
      };
    }

    // Check auth_date is not older than 24 hours
    const authTimestamp = authData.auth_date * 1000; // Convert to milliseconds
    const age = Date.now() - authTimestamp;

    if (age > MAX_AUTH_AGE_MS) {
      const ageHours = Math.floor(age / 3600000);
      getLogger().warn({
        userId: data.id,
        authDate: new Date(authTimestamp).toISOString(),
        ageHours,
      }, 'Telegram auth verification failed: auth_date too old');
      return {
        valid: false,
        reason: `Authentication data expired (${ageHours} hours old)`,
      };
    }

    if (age < 0) {
      getLogger().warn({
        userId: data.id,
        authDate: new Date(authTimestamp).toISOString(),
      }, 'Telegram auth verification failed: auth_date in the future');
      return {
        valid: false,
        reason: 'Authentication date is in the future',
      };
    }

    // Create data-check-string from sorted keys (excluding hash)
    // Format: key1=value1\nkey2=value2\n...
    const checkString = Object.keys(authData)
      .sort()
      .map((key) => {
        const value = authData[key as keyof typeof authData];
        // Handle undefined values by converting to empty string
        const stringValue = value !== undefined ? String(value) : '';
        return `${key}=${stringValue}`;
      })
      .join('\n');

    // Secret key = SHA256(bot_token)
    const env = getEnv();
    const secretKey = crypto
      .createHash('sha256')
      .update(env.TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate HMAC-SHA256(data-check-string, secret_key)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    // Compare hashes (timing-safe comparison)
    const valid = crypto.timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );

    const duration = Date.now() - startTime;

    if (valid) {
      getLogger().info({
        userId: data.id,
        username: data.username,
        authAge: Math.floor(age / 1000), // seconds
        durationMs: duration,
      }, 'Telegram auth verification successful');
      return {
        valid: true,
        userId: data.id,
      };
    } else {
      getLogger().warn({
        userId: data.id,
        username: data.username,
        expectedHashPrefix: calculatedHash.substring(0, 8),
        receivedHashPrefix: hash.substring(0, 8),
        durationMs: duration,
      }, 'Telegram auth verification failed: invalid hash');
      return {
        valid: false,
        reason: 'Invalid signature',
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    getLogger().error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: data?.id,
      durationMs: duration,
    }, 'Telegram auth verification error');
    return {
      valid: false,
      reason: 'Verification error',
    };
  }
}

/**
 * Verify Telegram authentication data and throw on failure
 *
 * Convenience wrapper that throws an error if verification fails.
 * Useful for authentication middleware.
 *
 * @param {TelegramAuthData} data - Authentication data from Telegram Login Widget
 * @returns {number} Verified Telegram user ID
 * @throws {Error} If verification fails
 *
 * @example
 * ```typescript
 * try {
 *   const userId = verifyTelegramAuthOrThrow(authData);
 *   // Proceed with authenticated user
 * } catch (error) {
 *   // Handle authentication failure
 *   reply.status(401).send({ error: 'Unauthorized' });
 * }
 * ```
 */
export function verifyTelegramAuthOrThrow(data: TelegramAuthData): number {
  const result = verifyTelegramAuth(data);

  if (!result.valid) {
    throw new Error(`Telegram authentication failed: ${result.reason}`);
  }

  return result.userId!;
}
