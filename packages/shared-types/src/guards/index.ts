/**
 * Omnichannel Chat Type Guards
 *
 * Runtime type checking utilities.
 */

import {
  ChannelSchema,
  InterfaceSchema,
} from '../schemas/enums.js';
import type {
  ChannelType,
  InterfaceType,
} from '../schemas/enums.js';
import {
  TelegramAuthDataSchema,
  SendMessageRequestSchema,
} from '../schemas/requests.js';
import type {
  TelegramAuthData,
  SendMessageRequest,
} from '../schemas/requests.js';

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

export function isChannel(value: unknown): value is ChannelType {
  return ChannelSchema.safeParse(value).success;
}

export function isInterface(value: unknown): value is InterfaceType {
  return InterfaceSchema.safeParse(value).success;
}

export function isValidTelegramAuth(data: unknown): data is TelegramAuthData {
  return TelegramAuthDataSchema.safeParse(data).success;
}

export function isValidSendMessageRequest(data: unknown): data is SendMessageRequest {
  return SendMessageRequestSchema.safeParse(data).success;
}
