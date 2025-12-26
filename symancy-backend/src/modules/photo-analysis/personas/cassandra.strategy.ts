/**
 * Cassandra Persona Strategy
 * Strategy pattern implementation for premium photo analysis with Cassandra persona
 * Defines loading messages, credit costs, and interpretation logic for direct, analytical readings
 */
import { generateInterpretation } from "../../../chains/interpretation.chain.js";
import type {
  InterpretationResult,
  VisionAnalysisResult,
} from "../../../types/langchain.js";
import { MODEL_CASSANDRA } from "../../../config/constants.js";
import type { InterpretOptions, PersonaStrategy } from "./arina.strategy.js";

/**
 * Cassandra Persona Strategy Implementation
 * Direct, honest, pragmatic coffee ground readings
 * Premium tier with 3-credit cost
 */
export const cassandraStrategy: PersonaStrategy = {
  /**
   * Get loading message for Cassandra persona
   * Returns localized loading message with mystical theme
   */
  getLoadingMessage(language?: string): string {
    const lang: string = language ?? "ru";
    const messages: Record<string, string> = {
      ru: "🔮 Всматриваюсь в знаки судьбы...",
      en: "🔮 Gazing into the signs of fate...",
      zh: "🔮 凝视命运的征兆...",
    };

    return (messages[lang] ?? messages.ru) as string;
  },

  /**
   * Get credit cost for Cassandra analysis
   * Cassandra uses 3 premium credits per reading
   */
  getCreditCost(): number {
    return 3;
  },

  /**
   * Get model identifier for Cassandra
   * Returns the Cassandra model name from constants
   */
  getModelName(): string {
    return MODEL_CASSANDRA;
  },

  /**
   * Interpret vision result with Cassandra persona
   * Calls the interpretation chain with Cassandra persona settings
   *
   * @param visionResult - Structured vision analysis result
   * @param options - Language and user name options
   * @returns Interpretation with persona-specific text
   *
   * @example
   * ```typescript
   * const visionResult = await analyzeVision({ imageBase64: "..." });
   * const interpretation = await cassandraStrategy.interpret(visionResult, {
   *   language: "ru",
   *   userName: "Александр"
   * });
   * console.log(interpretation.text); // "Александр, в гуще я вижу..."
   * ```
   */
  async interpret(
    visionResult: VisionAnalysisResult,
    options: InterpretOptions
  ): Promise<InterpretationResult> {
    const { language = "ru", userName = "друг" } = options;

    // Call interpretation chain with Cassandra persona
    const result = await generateInterpretation({
      visionResult,
      persona: "cassandra",
      language,
      userName,
    });

    return result;
  },
};
