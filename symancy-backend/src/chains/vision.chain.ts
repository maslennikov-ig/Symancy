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
  StructuredVisionResult,
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
 * Parse legacy vision model response into structured result
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
function parseLegacyVisionResponse(rawText: string): Omit<VisionAnalysisResult, 'tokensUsed'> {
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
 * Parse structured vision response into typed result
 * Handles new structured format with fallback to legacy
 */
function parseStructuredVision(rawText: string): StructuredVisionResult {
  const result: StructuredVisionResult = {
    technicalQuality: "CLEAR",
    complexityScore: 5,
    sedimentPhysics: { density: "medium", flow: "stagnant", chaos: "medium" },
    zones: { rim: "", center: "", bottom: "" },
    visualAnchors: [],
    atmosphere: [],
    rawDescription: rawText.trim(),
  };

  // Parse TECHNICAL section
  const technicalMatch = rawText.match(/TECHNICAL:\s*(\w+),?\s*(?:Complexity\s*)?(\d+)?/i);
  if (technicalMatch) {
    const quality = technicalMatch[1]?.toUpperCase();
    if (quality === "CLEAR" || quality === "BLURRY" || quality === "EMPTY" || quality === "DARK") {
      result.technicalQuality = quality;
    }
    if (technicalMatch[2]) {
      result.complexityScore = Math.min(10, Math.max(1, parseInt(technicalMatch[2], 10)));
    }
  }

  // Parse PHYSICS section
  const physicsSection = rawText.match(/PHYSICS:\s*([\s\S]*?)(?=ZONES:|ANCHORS:|ATMOSPHERE:|$)/i);
  if (physicsSection && physicsSection[1]) {
    const physicsText = physicsSection[1];

    const densityMatch = physicsText.match(/Density:\s*(\w+)/i);
    if (densityMatch) result.sedimentPhysics.density = densityMatch[1]!.toLowerCase();

    const flowMatch = physicsText.match(/Flow:\s*(.+?)(?:\n|$)/i);
    if (flowMatch) result.sedimentPhysics.flow = flowMatch[1]!.trim().toLowerCase();

    const chaosMatch = physicsText.match(/Chaos:\s*(\w+)/i);
    if (chaosMatch) result.sedimentPhysics.chaos = chaosMatch[1]!.toLowerCase();
  }

  // Parse ZONES section
  const zonesSection = rawText.match(/ZONES:\s*([\s\S]*?)(?=ANCHORS:|ATMOSPHERE:|$)/i);
  if (zonesSection && zonesSection[1]) {
    const zonesText = zonesSection[1];

    const rimMatch = zonesText.match(/\[RIM\]\s*(.+?)(?:\n|\[|$)/i);
    if (rimMatch) result.zones.rim = rimMatch[1]!.trim();

    const centerMatch = zonesText.match(/\[CENTER\]\s*(.+?)(?:\n|\[|$)/i);
    if (centerMatch) result.zones.center = centerMatch[1]!.trim();

    const bottomMatch = zonesText.match(/\[BOTTOM\]\s*(.+?)(?:\n|\[|$)/i);
    if (bottomMatch) result.zones.bottom = bottomMatch[1]!.trim();
  }

  // Parse ANCHORS section
  const anchorsSection = rawText.match(/ANCHORS:\s*([\s\S]*?)(?=ATMOSPHERE:|$)/i);
  if (anchorsSection && anchorsSection[1]) {
    const anchorLines = anchorsSection[1].match(/^\d+\.\s*(.+)$/gm) || [];

    for (const line of anchorLines) {
      const cleaned = line.replace(/^\d+\.\s*/, "");
      // Parse format: [location] description
      const locationMatch = cleaned.match(/\[([^\]]+)\]\s*(.+)/);
      if (locationMatch) {
        const location = locationMatch[1]!;
        const description = locationMatch[2]!;

        // Try to extract texture and unique feature from description
        const texturePart = description.match(/(grainy|smooth|fractured|flowing)/i);

        result.visualAnchors.push({
          location,
          geometry: description.split(",")[0]?.trim() || description,
          texture: texturePart ? texturePart[1]!.toLowerCase() : "complex",
          uniqueFeature: description,
        });
      }
    }
  }

  // Parse ATMOSPHERE section
  const atmosphereMatch = rawText.match(/ATMOSPHERE:\s*(.+?)$/im);
  if (atmosphereMatch && atmosphereMatch[1]) {
    result.atmosphere = atmosphereMatch[1]
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  return result;
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

  // Create vision model instance (async - loads from dynamic config)
  const model = await createVisionModel();

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

  // Extract token usage from response metadata
  const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

  // Extract text content from response
  const rawText =
    typeof response.content === "string"
      ? response.content
      : response.content
          .filter((block) => block.type === "text")
          .map((block) => ("text" in block ? block.text : ""))
          .join("\n");

  // Try parsing with new structured format first
  const structuredResult = parseStructuredVision(rawText);

  // Check if structured parsing yielded meaningful results
  const hasStructuredData =
    structuredResult.visualAnchors.length > 0 ||
    structuredResult.zones.rim !== "" ||
    structuredResult.atmosphere.length > 0;

  // Fall back to legacy parser if structured parsing failed
  if (!hasStructuredData) {
    const result = parseLegacyVisionResponse(rawText);
    return {
      ...result,
      tokensUsed,
    };
  }

  // Convert structured result to legacy format for backward compatibility
  const result: VisionAnalysisResult = {
    symbols: structuredResult.visualAnchors.map(a => a.uniqueFeature),
    colors: [], // Extract from atmosphere or description if needed
    patterns: [
      structuredResult.zones.rim,
      structuredResult.zones.center,
      structuredResult.zones.bottom,
    ].filter(z => z !== ""),
    rawDescription: structuredResult.rawDescription,
    tokensUsed,
  };

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
  const model = await createVisionModel();

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

      // Extract token usage from response metadata
      const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

      const rawText =
        typeof response.content === "string"
          ? response.content
          : response.content
              .filter((block) => block.type === "text")
              .map((block) => ("text" in block ? block.text : ""))
              .join("\n");

      // Try parsing with new structured format first
      const structuredResult = parseStructuredVision(rawText);

      // Check if structured parsing yielded meaningful results
      const hasStructuredData =
        structuredResult.visualAnchors.length > 0 ||
        structuredResult.zones.rim !== "" ||
        structuredResult.atmosphere.length > 0;

      // Fall back to legacy parser if structured parsing failed
      if (!hasStructuredData) {
        const result = parseLegacyVisionResponse(rawText);
        return {
          ...result,
          tokensUsed,
        };
      }

      // Convert structured result to legacy format for backward compatibility
      const result: VisionAnalysisResult = {
        symbols: structuredResult.visualAnchors.map(a => a.uniqueFeature),
        colors: [], // Extract from atmosphere or description if needed
        patterns: [
          structuredResult.zones.rim,
          structuredResult.zones.center,
          structuredResult.zones.bottom,
        ].filter(z => z !== ""),
        rawDescription: structuredResult.rawDescription,
        tokensUsed,
      };

      return result;
    },
  };
}
