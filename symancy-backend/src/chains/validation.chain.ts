/**
 * Image Validation Chain
 * Validates if an image contains coffee grounds before full analysis
 * Used to protect against trolls sending irrelevant images
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createVisionModel } from "../core/langchain/models.js";
import type {
  ValidationChainInput,
  ImageValidationResult,
  ImageValidationCategory,
} from "../types/langchain.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getLogger } from "../core/logger.js";

const logger = getLogger().child({ module: "validation-chain" });

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cached validation prompt
 * Loaded once at module initialization
 */
let cachedValidationPrompt: string | null = null;

/**
 * Load validation prompt from disk
 * Caches result for subsequent calls
 */
async function loadValidationPrompt(): Promise<string> {
  if (cachedValidationPrompt) {
    return cachedValidationPrompt;
  }

  const promptPath = path.join(
    __dirname,
    "../../prompts/vision/validate.txt"
  );

  try {
    cachedValidationPrompt = await readFile(promptPath, "utf-8");
    return cachedValidationPrompt;
  } catch (error) {
    throw new Error(
      `Failed to load validation prompt from ${promptPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Valid categories for parsing
 */
const VALID_CATEGORIES: ImageValidationCategory[] = [
  "VALID_COFFEE",
  "EMPTY_CUP",
  "TEA_LEAVES",
  "NOT_A_CUP",
  "LOW_QUALITY",
];

/**
 * Parse validation response from model
 * Extracts JSON from potentially wrapped response
 */
function parseValidationResponse(rawText: string): ImageValidationResult {
  const text = rawText.trim();

  // Try to extract JSON from response
  let jsonStr = text;

  // Handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!.trim();
  }

  // Handle plain JSON
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate category
    const category = parsed.category as ImageValidationCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      logger.warn({ parsedCategory: parsed.category }, "Invalid category, defaulting to VALID_COFFEE");
      return {
        isValid: true,
        category: "VALID_COFFEE",
        confidence: 0.5,
        description: parsed.description || "Image content unclear",
        rejectionReason: undefined,
      };
    }

    // Validate confidence
    let confidence = parseFloat(parsed.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.7;
    }

    const isValid = category === "VALID_COFFEE";

    // Extract description (required for chat model context)
    const description = parsed.description || getDefaultDescription(category);

    return {
      isValid,
      category,
      confidence,
      description,
      rejectionReason: isValid ? undefined : (parsed.reason || getDefaultRejectionReason(category)),
    };
  } catch (parseError) {
    logger.warn({ rawText, error: parseError }, "Failed to parse validation response, defaulting to valid");

    // Default to valid on parse error (be permissive)
    return {
      isValid: true,
      category: "VALID_COFFEE",
      confidence: 0.5,
      description: "Image content unclear",
      rejectionReason: undefined,
    };
  }
}

/**
 * Get default rejection reason for category
 */
function getDefaultRejectionReason(category: ImageValidationCategory): string {
  switch (category) {
    case "EMPTY_CUP":
      return "The cup appears to be empty or clean";
    case "TEA_LEAVES":
      return "This looks like tea leaves, not coffee grounds";
    case "NOT_A_CUP":
      return "This image does not appear to show a cup";
    case "LOW_QUALITY":
      return "The image quality is too low to analyze";
    default:
      return "Unable to identify coffee grounds";
  }
}

/**
 * Get default description for category (when model doesn't provide one)
 */
function getDefaultDescription(category: ImageValidationCategory): string {
  switch (category) {
    case "VALID_COFFEE":
      return "A cup with coffee grounds";
    case "EMPTY_CUP":
      return "An empty or clean cup without coffee grounds";
    case "TEA_LEAVES":
      return "A cup with tea leaves instead of coffee grounds";
    case "NOT_A_CUP":
      return "An image that does not show a cup";
    case "LOW_QUALITY":
      return "A blurry or dark image where details are not visible";
    default:
      return "Image content unclear";
  }
}

/**
 * Validate image for coffee grounds
 * Main entry point for validation chain
 *
 * @param input - Validation chain input with base64-encoded image
 * @returns Validation result with category and confidence
 *
 * @example
 * ```typescript
 * const result = await validateCoffeeGrounds({
 *   imageBase64: "iVBORw0KGgoAAAANSUhEUgAA..."
 * });
 * if (!result.isValid) {
 *   console.log(`Rejected: ${result.category} - ${result.rejectionReason}`);
 * }
 * ```
 */
export async function validateCoffeeGrounds(
  input: ValidationChainInput
): Promise<ImageValidationResult> {
  const startTime = Date.now();

  // Load system prompt
  const systemPrompt = await loadValidationPrompt();

  // Create vision model with lower token limit for fast validation (async - loads from dynamic config)
  const model = await createVisionModel({
    maxTokens: 150, // Small response needed
    temperature: 0.1, // More deterministic
    timeout: 15000, // 15 seconds - validation should be fast
  });

  // Build multimodal message with image
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Classify this image. Respond with JSON only.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/webp;base64,${input.imageBase64}`,
          },
        },
      ],
    }),
  ];

  // Invoke vision model
  const response = await model.invoke(messages);

  // Extract text content from response
  const rawText =
    typeof response.content === "string"
      ? response.content
      : response.content
          .filter((block) => block.type === "text")
          .map((block) => ("text" in block ? block.text : ""))
          .join("\n");

  // Parse response
  const result = parseValidationResponse(rawText);

  const duration = Date.now() - startTime;
  logger.info(
    {
      category: result.category,
      isValid: result.isValid,
      confidence: result.confidence,
      durationMs: duration,
    },
    "Image validation completed"
  );

  return result;
}
