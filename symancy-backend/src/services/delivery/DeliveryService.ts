/**
 * DeliveryService - Handles message delivery to different channels
 *
 * Responsibilities:
 * - Deliver messages to Telegram via Bot API
 * - Deliver messages to Web via Supabase Realtime (INSERT into messages table)
 * - Retry logic with exponential backoff and jitter
 * - Error handling for transient failures (network, rate limits, 5xx)
 */

import type { ParseMode } from "grammy/types";
import { getBotApi } from "../../core/telegram.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import type {
  DeliveryResult,
  ChannelType,
  InterfaceType,
  MessageRole,
  ContentType,
} from "../../types/omnichannel.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Retry configuration for delivery attempts
 * Uses exponential backoff with jitter to avoid thundering herd
 */
const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
  jitterPercent: 20, // ±20% jitter
} as const;

/**
 * Telegram send options
 */
export interface TelegramSendOptions {
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
}

/**
 * Realtime delivery options
 */
export interface RealtimeSendOptions {
  role?: MessageRole;
  content_type?: ContentType;
  reply_to_message_id?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Transient errors that should trigger retry
 */
const TRANSIENT_ERROR_PATTERNS = [
  /network/i,
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /Too Many Requests/i,
  /rate limit/i,
  /429/,
  /5\d{2}/, // 5xx server errors
];

/**
 * Permanent errors that should NOT trigger retry
 */
const PERMANENT_ERROR_PATTERNS = [
  /bot was blocked/i,
  /user is deactivated/i,
  /chat not found/i,
  /Forbidden/i,
  /Bad Request/i,
];

/**
 * Error patterns that indicate user blocked the bot (T053)
 * These should trigger user status update (mark as inactive)
 */
const USER_BLOCKED_ERROR_PATTERNS = [
  /bot was blocked/i,
  /user is deactivated/i,
  /BLOCKED_BY_USER/i,
  /Forbidden: bot was blocked by the user/i,
  /chat not found/i,  // Often means user deleted account or blocked
];

// =============================================================================
// DELIVERY SERVICE
// =============================================================================

/**
 * DeliveryService - Singleton for message delivery across channels
 */
export class DeliveryService {
  private static instance: DeliveryService | null = null;
  private readonly logger = getLogger().child({ module: "delivery" });

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DeliveryService {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Deliver message to Telegram via Bot API
   *
   * @param chatId - Telegram chat ID
   * @param content - Message content (text)
   * @param options - Telegram send options
   * @returns DeliveryResult with success status and external message ID
   */
  public async deliverToTelegram(
    chatId: number,
    content: string,
    options?: TelegramSendOptions
  ): Promise<DeliveryResult> {
    const logger = this.logger.child({ method: "deliverToTelegram", chatId });

    logger.debug(
      { contentLength: content.length, options },
      "Starting Telegram delivery"
    );

    try {
      const result = await this.retryWithBackoff(
        async () => {
          logger.debug({ contentLength: content.length }, "Sending Telegram message");

          const api = getBotApi();
          const message = await api.sendMessage(chatId, content, {
            parse_mode: options?.parse_mode,
            link_preview_options: options?.disable_web_page_preview
              ? { is_disabled: true }
              : undefined,
            disable_notification: options?.disable_notification,
            reply_to_message_id: options?.reply_to_message_id,
          });

          return {
            success: true,
            externalMessageId: String(message.message_id),
            deliveredAt: new Date(message.date * 1000),
          };
        },
        (error) => this.isTransientError(error)
      );

      logger.info(
        { externalMessageId: result.externalMessageId, deliveredAt: result.deliveredAt },
        "Telegram message delivered successfully"
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, errorMessage, isPermanent: !this.isTransientError(error) },
        "Failed to deliver Telegram message after all retries"
      );

      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * Deliver message to Web via Supabase Realtime
   * Inserts message into messages table, which triggers Realtime broadcast
   *
   * @param conversationId - Conversation UUID
   * @param content - Message content (text)
   * @param channel - Channel type (default: 'web')
   * @param interface - Interface type (default: 'browser')
   * @param options - Additional message options
   * @returns DeliveryResult with success status and message ID
   */
  public async deliverToRealtime(
    conversationId: string,
    content: string,
    channel: ChannelType = "web",
    interface_type: InterfaceType = "browser",
    options?: RealtimeSendOptions
  ): Promise<DeliveryResult> {
    const logger = this.logger.child({
      method: "deliverToRealtime",
      conversationId,
    });

    logger.debug(
      {
        contentLength: content.length,
        channel,
        interface: interface_type,
        role: options?.role || "assistant",
      },
      "Starting Realtime delivery"
    );

    try {
      const result = await this.retryWithBackoff(
        async () => {
          logger.debug({ contentLength: content.length }, "Inserting Realtime message");

          const supabase = getSupabase();

          // Insert message into messages table
          // This triggers Realtime broadcast to subscribed clients
          const { data, error } = await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              channel,
              interface: interface_type,
              role: options?.role || "assistant",
              content,
              content_type: options?.content_type || "text",
              reply_to_message_id: options?.reply_to_message_id,
              metadata: options?.metadata || {},
              processing_status: "completed",
            })
            .select("id, created_at")
            .single();

          if (error) {
            throw new Error(`Supabase insert error: ${error.message}`);
          }

          if (!data) {
            throw new Error("Insert succeeded but no data returned");
          }

          return {
            success: true,
            externalMessageId: data.id,
            deliveredAt: new Date(data.created_at),
          };
        },
        (error) => this.isTransientError(error)
      );

      logger.info(
        { messageId: result.externalMessageId, deliveredAt: result.deliveredAt },
        "Realtime message delivered successfully"
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error, errorMessage, isPermanent: !this.isTransientError(error) },
        "Failed to deliver Realtime message after all retries"
      );

      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * Route message to appropriate delivery method based on channel/interface
   *
   * @param channel - Channel type (telegram, web, etc.)
   * @param interface_type - Interface type (bot, browser, etc.)
   * @param params - Delivery parameters
   * @returns DeliveryResult
   */
  public async deliver(
    channel: ChannelType,
    interface_type: InterfaceType,
    params: {
      chatId?: number;
      conversationId?: string;
      content: string;
      telegramOptions?: TelegramSendOptions;
      realtimeOptions?: RealtimeSendOptions;
    }
  ): Promise<DeliveryResult> {
    const logger = this.logger.child({ method: "deliver", channel, interface: interface_type });

    try {
      // Route based on channel and interface
      if (channel === "telegram" && interface_type === "bot") {
        if (!params.chatId) {
          const error = "chatId required for telegram/bot delivery";
          logger.error(error);
          return { success: false, errorMessage: error };
        }

        logger.debug({ chatId: params.chatId }, "Routing to Telegram delivery");
        return await this.deliverToTelegram(params.chatId, params.content, params.telegramOptions);
      }

      if (channel === "web" && (interface_type === "browser" || interface_type === "webapp")) {
        if (!params.conversationId) {
          const error = "conversationId required for web delivery";
          logger.error(error);
          return { success: false, errorMessage: error };
        }

        logger.debug({ conversationId: params.conversationId }, "Routing to Realtime delivery");
        return await this.deliverToRealtime(
          params.conversationId,
          params.content,
          channel,
          interface_type,
          params.realtimeOptions
        );
      }

      // Unsupported channel/interface combination
      const error = `Unsupported delivery route: ${channel}/${interface_type}`;
      logger.error(error);
      return { success: false, errorMessage: error };
    } catch (error) {
      // Defensive catch-all for unexpected errors
      // deliverToTelegram and deliverToRealtime should never throw,
      // but this ensures consistent error handling
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error, errorMessage }, "Unexpected error in deliver method");

      return {
        success: false,
        errorMessage: `Delivery failed: ${errorMessage}`,
      };
    }
  }

  // ===========================================================================
  // RETRY LOGIC
  // ===========================================================================

  /**
   * Retry operation with exponential backoff and jitter
   *
   * @param operation - Async operation to retry
   * @param shouldRetry - Function to determine if error is transient
   * @returns Result from operation
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on permanent errors
        if (!shouldRetry(error)) {
          this.logger.warn(
            { error, attempt },
            "Permanent error detected, not retrying"
          );
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === RETRY_CONFIG.maxAttempts) {
          this.logger.error(
            { error, attempt },
            "Max retry attempts reached"
          );
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.multiplier, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );

        // Add jitter (±20%)
        const jitter = baseDelay * (RETRY_CONFIG.jitterPercent / 100);
        const delay = baseDelay + (Math.random() * 2 - 1) * jitter;

        this.logger.warn(
          { error, attempt, delayMs: Math.round(delay) },
          "Transient error, retrying after delay"
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached due to throw in loop, but TypeScript needs it
    throw lastError;
  }

  /**
   * Determine if error is transient (should retry)
   * HIGH-7 FIX: Default to RETRY for unknown errors (fail-safe approach)
   */
  private isTransientError(error: unknown): boolean {
    const errorString = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error && 'code' in error ? (error as { code?: string }).code : null;

    // Check for EXPLICIT permanent errors first
    if (PERMANENT_ERROR_PATTERNS.some((pattern) => pattern.test(errorString))) {
      this.logger.debug({ errorString }, 'Classified as permanent error');
      return false;
    }

    // Check for known transient errors
    if (TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(errorString))) {
      this.logger.debug({ errorString }, 'Classified as transient error');
      return true;
    }

    // Check common network error codes
    const transientCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNABORTED',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EAI_AGAIN',
    ];

    if (errorCode && transientCodes.includes(errorCode)) {
      this.logger.debug({ errorCode }, 'Classified as transient by error code');
      return true;
    }

    // HIGH-7 FIX: Default to RETRY for unknown errors (fail-safe)
    // Better to retry a non-transient error than to fail a transient one
    this.logger.warn(
      { errorString, errorCode },
      'Unknown error type, defaulting to TRANSIENT (will retry)'
    );
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // PUBLIC HELPERS (T053)
  // ===========================================================================

  /**
   * Check if an error message indicates the user blocked the bot
   *
   * Per spec (US5 T053): When bot is blocked, system should:
   * 1. Detect the error (this method)
   * 2. Mark user as inactive (caller responsibility via ProactiveMessageService)
   *
   * @param errorMessage - Error message to check
   * @returns true if error indicates user blocked the bot
   */
  public isUserBlockedError(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    return USER_BLOCKED_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get singleton DeliveryService instance
 */
export function getDeliveryService(): DeliveryService {
  return DeliveryService.getInstance();
}
