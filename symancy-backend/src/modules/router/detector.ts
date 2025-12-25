/**
 * Message type detector for routing Telegram updates
 * Categorizes incoming messages by type and extracts command data
 */
import type { Context } from "grammy";
import type { MessageType } from "../../types/telegram.js";

/**
 * Detect message type from Telegram context
 * @param ctx - Grammy context object
 * @returns Detected message type
 */
export function detectMessageType(ctx: Context): MessageType {
  const message = ctx.message;

  if (!message) {
    if (ctx.callbackQuery) {
      return "callback";
    }
    return "unknown";
  }

  // Check for photo with proper null/array validation
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    return "photo";
  }

  // Check for command with proper null check
  if (message.text && message.text.startsWith("/")) {
    return "command";
  }

  // Check for text
  if (message.text) {
    return "text";
  }

  return "unknown";
}

/**
 * Check if message is a specific command
 * @param ctx - Grammy context object
 * @param command - Command name (without slash)
 * @returns True if message matches command
 */
export function isCommand(ctx: Context, command: string): boolean {
  const text = ctx.message?.text;
  if (!text) return false;

  return text === `/${command}` || text.startsWith(`/${command} `);
}

/**
 * Extract command arguments from message text
 * @param ctx - Grammy context object
 * @returns Command arguments as string, empty if none
 */
export function getCommandArgs(ctx: Context): string {
  const text = ctx.message?.text;
  if (!text) return "";

  const spaceIndex = text.indexOf(" ");
  if (spaceIndex === -1) return "";

  return text.slice(spaceIndex + 1).trim();
}
