/**
 * Proactive Messaging Service Module
 *
 * Exports ProactiveMessageService for sending engagement messages
 * to users with linked Telegram accounts.
 */

export {
  ProactiveMessageService,
  getProactiveMessageService,
  type ProactiveEligibleUser,
  type ProactiveMessageType,
  type ProactiveMessageResult,
} from "./ProactiveMessageService.js";
