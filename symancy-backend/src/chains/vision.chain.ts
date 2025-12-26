/**
 * Vision Analysis Chain
 * Analyzes coffee ground images using vision model
 * Returns structured patterns, symbols, and colors for interpretation
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createVisionModel } from "../core/langchain/models.js";
import type {
  VisionChainInput,
  VisionAnalysisResult,
} from "../types/langchain.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cached system prompt for vision analysis
 * Loaded once at module initialization
 */
let cachedVisionPrompt: string | null = null;

/**
 * Load vision analysis prompt from disk
 * Caches result for subsequent calls
 */
async function loadVisionPrompt(): Promise<string> {
  if (cachedVisionPrompt) {
    return cachedVisionPrompt;
  }

  // Path relative to project root
  const promptPath = path.join(
    __dirname,
    "../../prompts/vision/analyze.txt"
  );

  try {
    cachedVisionPrompt = await readFile(promptPath, "utf-8");
    return cachedVisionPrompt;
  } catch (error) {
    throw new Error(
      `Failed to load vision prompt from ${promptPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse vision model response into structured result
 * Extracts symbols, colors, patterns from formatted response
 *
 * Expected format:
 * PRIMARY PATTERN: [description]
 * SECONDARY PATTERNS:
 * 1. [pattern] - [description]
 * ...
 * OVERALL COMPOSITION: [description]
 * SYMBOLIC ELEMENTS: [description]
 */
function parseVisionResponse(rawText: string): VisionAnalysisResult {
  const symbols: string[] = [];
  const colors: string[] = [];
  const patterns: string[] = [];

  // Extract primary pattern
  const primaryMatch = rawText.match(/PRIMARY PATTERN:\s*(.+?)(?:\n|$)/i);
  if (primaryMatch && primaryMatch[1]) {
    patterns.push(primaryMatch[1].trim());
  }

  // Extract secondary patterns
  const secondarySection = rawText.match(
    /SECONDARY PATTERNS:\s*([\s\S]+?)(?=OVERALL COMPOSITION:|SYMBOLIC ELEMENTS:|$)/i
  );
  if (secondarySection && secondarySection[1]) {
    const secondaryPatterns = secondarySection[1].match(/^\d+\.\s*(.+?)$/gm);
    if (secondaryPatterns) {
      secondaryPatterns.forEach((pattern) => {
        const cleaned = pattern.replace(/^\d+\.\s*/, "").trim();
        if (cleaned) {
          patterns.push(cleaned);
        }
      });
    }
  }

  // Extract symbolic elements as symbols
  const symbolicMatch = rawText.match(/SYMBOLIC ELEMENTS:\s*(.+?)$/im);
  if (symbolicMatch && symbolicMatch[1]) {
    const symbolicText = symbolicMatch[1].trim();
    // Split on common delimiters and extract meaningful symbols
    const extractedSymbols = symbolicText
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    symbols.push(...extractedSymbols);
  }

  // Extract colors from entire text (common color words)
  const colorKeywords = [
    "dark",
    "light",
    "black",
    "white",
    "brown",
    "gray",
    "grey",
    "golden",
    "silver",
    "beige",
    "tan",
  ];
  const lowerText = rawText.toLowerCase();
  colorKeywords.forEach((color) => {
    if (lowerText.includes(color) && !colors.includes(color)) {
      colors.push(color);
    }
  });

  // Extract additional symbols from patterns using keywords
  const symbolKeywords = [
    "bird",
    "fish",
    "dog",
    "cat",
    "horse",
    "dragon",
    "butterfly",
    "spider",
    "face",
    "hand",
    "eye",
    "heart",
    "ship",
    "key",
    "tree",
    "flower",
    "mountain",
    "cloud",
    "star",
    "sun",
    "moon",
    "circle",
    "triangle",
    "cross",
    "house",
    "tower",
    "bridge",
    "path",
    "road",
  ];

  symbolKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword) && !symbols.includes(keyword)) {
      symbols.push(keyword);
    }
  });

  return {
    symbols: symbols.length > 0 ? symbols : ["abstract forms"],
    colors: colors.length > 0 ? colors : ["dark", "light"],
    patterns: patterns.length > 0 ? patterns : ["complex composition"],
    rawDescription: rawText.trim(),
  };
}

/**
 * Analyze coffee ground image using vision model
 * Main entry point for vision analysis chain
 *
 * @param input - Vision chain input with base64-encoded image
 * @returns Structured analysis result with symbols, colors, patterns
 *
 * @example
 * ```typescript
 * const result = await analyzeVision({
 *   imageBase64: "iVBORw0KGgoAAAANSUhEUgAA..."
 * });
 * console.log(result.symbols); // ["bird", "tree", "cloud"]
 * console.log(result.patterns); // ["Bird silhouette in center", ...]
 * ```
 */
export async function analyzeVision(
  input: VisionChainInput
): Promise<VisionAnalysisResult> {
  // Load system prompt
  const systemPrompt = await loadVisionPrompt();

  // Create vision model instance
  const model = createVisionModel();

  // Build multimodal message with image
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Analyze this coffee ground image and provide a detailed analysis following the response format specified in your instructions:",
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

  // Parse structured response
  const result = parseVisionResponse(rawText);

  return result;
}

/**
 * Create reusable vision chain for advanced use cases
 * Returns a runnable chain that can be piped or composed
 *
 * @example
 * ```typescript
 * const chain = await createVisionChain();
 * const result = await chain.invoke({ imageBase64: "..." });
 * ```
 */
export async function createVisionChain() {
  const systemPrompt = await loadVisionPrompt();
  const model = createVisionModel();

  // Return a function that matches LangChain Runnable interface
  return {
    async invoke(input: VisionChainInput): Promise<VisionAnalysisResult> {
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage({
          content: [
            {
              type: "text",
              text: "Analyze this coffee ground image and provide a detailed analysis following the response format specified in your instructions:",
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

      const response = await model.invoke(messages);

      const rawText =
        typeof response.content === "string"
          ? response.content
          : response.content
              .filter((block) => block.type === "text")
              .map((block) => ("text" in block ? block.text : ""))
              .join("\n");

      return parseVisionResponse(rawText);
    },
  };
}
