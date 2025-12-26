/**
 * Photo message handler for coffee fortune telling bot
 * Validates photo requests, checks credits, and queues analysis jobs
 */
import type { BotContext } from "../router/middleware.js";
import type { PhotoAnalysisJobData } from "../../types/telegram.js";
import { getLogger } from "../../core/logger.js";
import { hasCredits } from "../credits/service.js";
import { sendJob } from "../../core/queue.js";
import { isMaintenanceMode } from "../config/service.js";
import {
  QUEUE_ANALYZE_PHOTO,
  TELEGRAM_PHOTO_SIZE_LIMIT,
} from "../../config/constants.js";
import { arinaStrategy } from "./personas/arina.strategy.js";
import { cassandraStrategy } from "./personas/cassandra.strategy.js";
import type { PersonaStrategy } from "./personas/arina.strategy.js";

const logger = getLogger().child({ module: "photo-handler" });

/**
 * Persona strategy map for loading messages and credit costs
 */
const PERSONA_STRATEGIES: Record<"arina" | "cassandra", PersonaStrategy> = {
  arina: arinaStrategy,
  cassandra: cassandraStrategy,
};

/**
 * Determine persona from message caption
 * @param caption - Message caption text (if any)
 * @returns Selected persona name
 */
function determinePersona(caption?: string): "arina" | "cassandra" {
  if (!caption) {
    return "arina"; // Default persona
  }

  const lowerCaption = caption.toLowerCase();

  // Check for Cassandra/premium keywords
  if (
    lowerCaption.includes("cassandra") ||
    lowerCaption.includes("кассандра") ||
    lowerCaption.includes("premium") ||
    lowerCaption.includes("премиум")
  ) {
    return "cassandra";
  }

  // Default to warm, supportive persona
  return "arina";
}


/**
 * Handle photo message from Telegram
 * Main entry point for photo-based fortune telling
 *
 * Flow:
 * 1. Validate context and photo
 * 2. Check maintenance mode
 * 3. Validate photo size
 * 4. Check user credits
 * 5. Determine persona
 * 6. Send loading message
 * 7. Enqueue background job
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
  const chatId = ctx.chat.id;

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
  if (photo.file_size && photo.file_size > TELEGRAM_PHOTO_SIZE_LIMIT) {
    logger.warn(
      {
        telegramUserId,
        fileSize: photo.file_size,
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

  // Determine persona from caption (if provided)
  const caption = ctx.message.caption;
  const persona = determinePersona(caption);

  // Get strategy for selected persona
  const strategy = PERSONA_STRATEGIES[persona];
  const creditCost = strategy.getCreditCost();

  // Check if user has enough credits
  if (!(await hasCredits(telegramUserId, creditCost))) {
    logger.info(
      { telegramUserId, persona, creditsNeeded: creditCost },
      "User has insufficient credits"
    );

    const personaLabel = persona === "cassandra" ? "премиум гадание" : "гадание";
    await ctx.reply(
      `💳 У вас недостаточно кредитов для ${personaLabel}.\n` +
        `Необходимо: ${creditCost} кредит(ов)\n` +
        "Пожалуйста, пополните баланс."
    );
    return;
  }

  // Get loading message for selected persona using strategy
  const loadingText = strategy.getLoadingMessage(ctx.from.language_code || "ru");

  // Send loading message (quick response <100ms)
  const loadingMessage = await ctx.reply(loadingText);

  // Prepare job data for background worker
  const jobData: PhotoAnalysisJobData = {
    telegramUserId,
    chatId,
    messageId: loadingMessage.message_id,
    fileId: photo.file_id,
    persona,
    language: ctx.from.language_code || "ru",
    userName: ctx.profile?.name || ctx.from.username || ctx.from.first_name || undefined,
  };

  // Enqueue job to pg-boss
  const jobId = await sendJob(QUEUE_ANALYZE_PHOTO, jobData);

  if (!jobId) {
    logger.error({ telegramUserId }, "Failed to enqueue photo analysis job");
    await ctx.api.editMessageText(
      chatId,
      loadingMessage.message_id,
      "❌ Не удалось обработать запрос. Попробуйте ещё раз."
    );
    return;
  }

  logger.info(
    {
      jobId,
      telegramUserId,
      persona,
      fileSize: photo.file_size,
    },
    "Photo analysis job queued"
  );
}
