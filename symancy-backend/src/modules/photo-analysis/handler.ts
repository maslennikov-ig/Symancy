/**
 * Photo message handler for coffee fortune telling bot
 * Validates photo requests and shows topic selection keyboard
 */
import type { BotContext } from "../router/middleware.js";
import { getLogger } from "../../core/logger.js";
import { isMaintenanceMode } from "../config/service.js";
import { TELEGRAM_PHOTO_SIZE_LIMIT } from "../../config/constants.js";
import { createTopicKeyboard, getTopicSelectionMessage } from "./keyboards.js";

const logger = getLogger().child({ module: "photo-handler" });


/**
 * Handle photo message from Telegram
 * Main entry point for photo-based fortune telling
 *
 * Flow:
 * 1. Validate context and photo
 * 2. Check maintenance mode
 * 3. Validate photo size
 * 4. Show topic selection keyboard
 *
 * Note: Job enqueueing happens in topic-handler.ts after user selects a topic
 *
 * @param ctx - Extended grammY context with user profile and state
 */
export async function handlePhotoMessage(ctx: BotContext): Promise<void> {
  // Type guards: Ensure required context data exists
  if (!ctx.message?.photo || !ctx.chat || !ctx.from) {
    logger.warn("Invalid photo message context");
    return;
  }

  const telegramUserId = ctx.from.id;

  logger.info({ telegramUserId }, "Received photo message");

  // Check maintenance mode (early exit)
  if (await isMaintenanceMode()) {
    await ctx.reply("⚙️ Бот находится на обслуживании. Попробуйте позже.");
    return;
  }

  // Get largest photo (best quality for vision analysis)
  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    logger.warn({ telegramUserId }, "No photos in message");
    return;
  }

  const photo = photos[photos.length - 1];
  if (!photo) {
    logger.warn({ telegramUserId }, "Photo is undefined");
    return;
  }

  // Validate photo size (Telegram limit: 10MB)
  const fileSize = photo.file_size;
  if (fileSize !== undefined) {
    if (fileSize > TELEGRAM_PHOTO_SIZE_LIMIT) {
      logger.warn(
        {
          telegramUserId,
          fileSize,
          limit: TELEGRAM_PHOTO_SIZE_LIMIT,
        },
        "Photo exceeds size limit"
      );
      await ctx.reply(
        "📸 Изображение слишком большое. Максимальный размер: 10 МБ.\n" +
        "Попробуйте сжать фото или отправить другое."
      );
      return;
    }
  } else {
    // If file_size is unknown, log warning but proceed
    // Worker will handle actual download size limits
    logger.warn({ telegramUserId, fileId: photo.file_id }, "Photo size unknown, proceeding anyway");
  }

  // Get user language: profile > Telegram client > fallback to Russian
  const userLanguage = ctx.profile?.language_code || ctx.from.language_code || "ru";

  // Create topic selection keyboard with photo fileId embedded
  const keyboard = createTopicKeyboard(photo.file_id, userLanguage);
  const promptMessage = getTopicSelectionMessage(userLanguage);

  // Send topic selection prompt with keyboard
  await ctx.reply(promptMessage, { reply_markup: keyboard });

  logger.info(
    {
      telegramUserId,
      fileId: photo.file_id,
      fileSize: photo.file_size,
    },
    "Topic selection keyboard shown"
  );
}
