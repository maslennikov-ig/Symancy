/**
 * Arina Persona Strategy
 * Strategy pattern implementation for photo analysis with Arina persona
 * Defines loading messages, credit costs, and interpretation logic
 */
import { generateInterpretation } from "../../../chains/interpretation.chain.js";
import type {
  InterpretationResult,
  VisionAnalysisResult,
} from "../../../types/langchain.js";
import { MODEL_ARINA } from "../../../config/constants.js";

/**
 * Options for interpretation
 */
export interface InterpretOptions {
  language?: string; // default 'ru'
  userName?: string; // optional user name
}

/**
 * Persona Strategy Interface
 * Defines contract for all persona implementations
 */
export interface PersonaStrategy {
  /**
   * Get loading message to display while processing
   * @param language - Optional language code (ru, en, zh)
   * @returns Loading message in requested language
   */
  getLoadingMessage(language?: string): string;

  /**
   * Get credit cost for this persona's analysis
   * @returns Number of credits required
   */
  getCreditCost(): number;

  /**
   * Get model name/identifier for this persona
   * @returns Model identifier string
   */
  getModelName(): string;

  /**
   * Interpret vision analysis result using persona
   * @param visionResult - Result from vision analysis chain
   * @param options - Interpretation options (language, userName)
   * @returns Interpretation result with text and token usage
   */
  interpret(
    visionResult: VisionAnalysisResult,
    options: InterpretOptions
  ): Promise<InterpretationResult>;
}

/**
 * Arina Persona Strategy Implementation
 * Warm, mystical, supportive coffee ground readings
 */
export const arinaStrategy: PersonaStrategy = {
  /**
   * Get loading message for Arina persona
   * Returns localized loading message
   */
  getLoadingMessage(language?: string): string {
    const lang: string = language ?? "ru";
    const messages: Record<string, string> = {
      ru: "☕️ Смотрю в гущу...",
      en: "☕️ Reading the grounds...",
      zh: "☕️ 正在解读咖啡渣...",
    };

    return (messages[lang] ?? messages.ru) as string;
  },

  /**
   * Get credit cost for Arina analysis
   * Arina uses 1 basic credit per reading
   */
  getCreditCost(): number {
    return 1;
  },

  /**
   * Get model identifier for Arina
   * Returns the Arina model name from constants
   */
  getModelName(): string {
    return MODEL_ARINA;
  },

  /**
   * Interpret vision result with Arina persona
   * Calls the interpretation chain with Arina persona settings
   *
   * @param visionResult - Structured vision analysis result
   * @param options - Language and user name options
   * @returns Interpretation with persona-specific text
   *
   * @example
   * ```typescript
   * const visionResult = await analyzeVision({ imageBase64: "..." });
   * const interpretation = await arinaStrategy.interpret(visionResult, {
   *   language: "ru",
   *   userName: "Мария"
   * });
   * console.log(interpretation.text); // "Дорогая Мария, в гуще я вижу..."
   * ```
   */
  async interpret(
    visionResult: VisionAnalysisResult,
    options: InterpretOptions
  ): Promise<InterpretationResult> {
    const { language = "ru", userName = "дорогой друг" } = options;

    // Call interpretation chain with Arina persona
    const result = await generateInterpretation({
      visionResult,
      persona: "arina",
      language,
      userName,
    });

    return result;
  },
};
