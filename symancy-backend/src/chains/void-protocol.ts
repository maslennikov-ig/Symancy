/**
 * Void Protocol
 * Handle edge cases: bad photos and empty cups
 */
import type { StructuredVisionResult } from "../types/langchain.js";

/**
 * Result of void protocol check
 */
export interface VoidProtocolResult {
  /** Whether to proceed with normal interpretation */
  shouldProceed: boolean;
  /** Fallback message if not proceeding */
  fallbackMessage?: string;
  /** Special interpretation type */
  specialInterpretation?: "tabula_rasa";
}

/**
 * Fallback messages for bad photo quality (by language)
 */
const BAD_PHOTO_MESSAGES: Record<string, Record<string, string>> = {
  BLURRY: {
    ru: `Я не могу разглядеть узоры сквозь дымку...
Пожалуйста, сделай фото при хорошем освещении,
держа камеру неподвижно. Попробуем ещё раз?`,
    en: `I cannot see the patterns through the haze...
Please take a photo with good lighting,
keeping the camera steady. Shall we try again?`,
    zh: `我无法透过模糊看清图案...
请在良好的光线下拍摄，
保持相机稳定。我们再试一次？`,
  },
  DARK: {
    ru: `Тени скрывают послание чашки...
Добавь больше света и попробуй снова.`,
    en: `Shadows hide the cup's message...
Add more light and try again.`,
    zh: `阴影隐藏了杯子的信息...
增加光线后再试一次。`,
  },
  EMPTY: {
    ru: `Чашка кажется пустой...
Убедись, что кофейная гуща осталась на дне и стенках.`,
    en: `The cup appears empty...
Make sure there's coffee sediment on the bottom and walls.`,
    zh: `杯子似乎是空的...
确保杯底和杯壁有咖啡渣。`,
  },
};

/**
 * Check if photo requires special handling
 *
 * @param visionResult - Structured vision analysis result
 * @param language - User's language (ru, en, zh)
 * @returns VoidProtocolResult with action to take
 *
 * @example
 * ```typescript
 * const check = checkVoidProtocol(visionResult, "ru");
 * if (!check.shouldProceed) {
 *   await bot.sendMessage(chatId, check.fallbackMessage);
 *   return;
 * }
 * if (check.specialInterpretation === "tabula_rasa") {
 *   // Use Tabula Rasa prompt
 * }
 * ```
 */
export function checkVoidProtocol(
  visionResult: StructuredVisionResult,
  language: string = "ru"
): VoidProtocolResult {
  const lang = language.startsWith("ru") ? "ru"
    : language.startsWith("en") ? "en"
    : language.startsWith("zh") ? "zh"
    : "ru";

  // Scenario A: Blurry photo
  if (visionResult.technicalQuality === "BLURRY") {
    return {
      shouldProceed: false,
      fallbackMessage: BAD_PHOTO_MESSAGES.BLURRY?.[lang] || BAD_PHOTO_MESSAGES.BLURRY?.ru || "",
    };
  }

  // Scenario B: Dark photo
  if (visionResult.technicalQuality === "DARK") {
    return {
      shouldProceed: false,
      fallbackMessage: BAD_PHOTO_MESSAGES.DARK?.[lang] || BAD_PHOTO_MESSAGES.DARK?.ru || "",
    };
  }

  // Scenario C: Clear but empty (Tabula Rasa)
  if (
    visionResult.technicalQuality === "CLEAR" &&
    visionResult.visualAnchors.length === 0 &&
    visionResult.complexityScore <= 2
  ) {
    return {
      shouldProceed: true,
      specialInterpretation: "tabula_rasa",
    };
  }

  // Scenario D: Explicitly marked as EMPTY
  if (visionResult.technicalQuality === "EMPTY") {
    return {
      shouldProceed: true,
      specialInterpretation: "tabula_rasa",
    };
  }

  // Normal case: proceed with interpretation
  return { shouldProceed: true };
}

/**
 * Special prompt for Tabula Rasa (empty cup) interpretation
 * To be injected into the interpretation prompt
 */
export const TABULA_RASA_CONTEXT = `
SPECIAL CASE: TABULA RASA (Clean Slate)

The cup is remarkably clear — a rare occurrence called "Tabula Rasa" (Clean Slate).
This is not emptiness, but SPACE. The chaos has settled. The patterns have released their grip.

Interpret this as FREEDOM and POTENTIAL:
- No old patterns are binding the user
- This is a moment of pure choice
- The canvas is blank — they can paint anything

Keep it short (800-1000 chars). Focus on:
- The rarity and significance of a clear cup
- The power of having no predetermined path
- End with an empowering question about what they want to create in this open space

Do NOT use generic phrases. Make it feel like a special, meaningful reading.
`.trim();

/**
 * Get Tabula Rasa prompt enhancement for interpretation
 *
 * @param _language - User's language (unused, model responds based on LANGUAGE variable)
 * @returns Additional context to add to interpretation prompt
 */
export function getTabulaRasaPrompt(_language: string = "ru"): string {
  // The main TABULA_RASA_CONTEXT is in English for the model
  // The model will respond in the user's language based on LANGUAGE variable
  return TABULA_RASA_CONTEXT;
}
