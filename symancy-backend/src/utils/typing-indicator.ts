/**
 * Typing Indicator Utility
 *
 * Continuous typing indicator for Telegram
 * Per TZ: Send typing action every 4 seconds
 */
import type { Api } from "grammy";
import { TYPING_INTERVAL_MS } from "../config/constants.js";
import { logger } from "../core/logger.js";

/**
 * Continuous typing indicator that stops when callback resolves
 */
export class TypingIndicator {
  private intervalId: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private api: Api,
    private chatId: number
  ) {}

  /**
   * Start sending typing action
   */
  start(): void {
    if (this.stopped) {
      logger.warn("Typing indicator already stopped, cannot start");
      return;
    }

    // Send immediately
    this.sendTyping();

    // Then every 4 seconds
    this.intervalId = setInterval(() => {
      if (!this.stopped) {
        this.sendTyping();
      }
    }, TYPING_INTERVAL_MS);

    logger.debug("Typing indicator started", { chatId: this.chatId });
  }

  /**
   * Stop sending typing action
   */
  stop(): void {
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.debug("Typing indicator stopped", { chatId: this.chatId });
  }

  private sendTyping(): void {
    this.api.sendChatAction(this.chatId, "typing").catch((error) => {
      // Ignore errors - chat might be unavailable
      logger.trace("Failed to send typing action (ignored)", { error, chatId: this.chatId });
    });
  }
}

/**
 * Execute callback while showing typing indicator
 *
 * @param api - Grammy API instance
 * @param chatId - Telegram chat ID
 * @param callback - Async callback to execute
 * @returns Result of callback
 */
export async function withTyping<T>(
  api: Api,
  chatId: number,
  callback: () => Promise<T>
): Promise<T> {
  const indicator = new TypingIndicator(api, chatId);
  indicator.start();

  try {
    return await callback();
  } finally {
    indicator.stop();
  }
}
