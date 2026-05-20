/**
 * Comparison Chain
 *
 * Generates a comparison interpretation of TWO coffee-ground vision results.
 * Used by the compare-photos worker (two-cup flow).
 *
 * Two modes:
 * - dynamics: same person, two moments — Arina (warm psychologist, no esoterics)
 * - compatibility: two different people — Cassandra (mystic, symbolic language)
 *
 * Returns plain interpretation text. The LLM is asked for strict JSON
 * (matching the existing { intro, sections: [{ title, content }] } shape used
 * by the frontend renderer); this chain RETURNS THE RAW STRING. Callers may
 * either send it as-is (preferred for Telegram — strict JSON is unfriendly) or
 * format it for display. The default formatter `formatComparisonForTelegram`
 * converts the JSON envelope into Telegram-safe HTML.
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createModel } from "../core/langchain/models.js";
import { getLogger } from "../core/logger.js";
import type { VisionAnalysisResult } from "../types/langchain.js";
import type { CompareMode } from "../types/job-schemas.js";
import {
  ARINA_DYNAMICS_PROMPT,
  CASSANDRA_COMPATIBILITY_PROMPT,
  type ComparisonLanguage,
} from "./comparison-prompts.js";
import {
  MODEL_ARINA_DYNAMICS,
  MODEL_CASSANDRA_COMPATIBILITY,
} from "../config/constants.js";

const logger = getLogger().child({ module: "comparison-chain" });

/**
 * Result of a comparison generation.
 */
export interface ComparisonResult {
  /** Telegram-safe HTML text ready to deliver to the user. */
  text: string;
  /** Raw model output (JSON envelope, used for storage / debugging). */
  rawText: string;
  /** Tokens used by the comparison model invocation. */
  tokensUsed: number;
  /** Model name actually invoked. */
  modelUsed: string;
  /** Whether parsing succeeded (false = fallback rendering). */
  success: boolean;
}

/**
 * Options for generating a comparison.
 */
export interface GenerateComparisonInput {
  firstVisionResult: VisionAnalysisResult;
  secondVisionResult: VisionAnalysisResult;
  compareMode: CompareMode;
  language?: string;
  userName?: string;
}

/**
 * Normalize language to a supported ComparisonLanguage.
 */
function normalizeLanguage(language?: string): ComparisonLanguage {
  if (!language) return "ru";
  const code = language.toLowerCase();
  if (code.startsWith("zh")) return "zh";
  if (code.startsWith("en")) return "en";
  return "ru";
}

/**
 * Pick model + system-prompt by compare mode.
 */
function selectModelAndPrompt(
  compareMode: CompareMode,
  language: ComparisonLanguage,
): { modelName: string; systemPrompt: string; temperature: number; maxTokens: number } {
  if (compareMode === "dynamics") {
    return {
      modelName: MODEL_ARINA_DYNAMICS,
      systemPrompt: ARINA_DYNAMICS_PROMPT(language),
      temperature: 0.85,
      maxTokens: 2000,
    };
  }
  // compatibility
  return {
    modelName: MODEL_CASSANDRA_COMPATIBILITY,
    systemPrompt: CASSANDRA_COMPATIBILITY_PROMPT(language),
    temperature: 1.0,
    maxTokens: 2400,
  };
}

/**
 * Build the user message: pure data payload with the two vision results,
 * matching the prompt contract ("firstVisionResult" / "secondVisionResult").
 */
function buildUserPayload(
  first: VisionAnalysisResult,
  second: VisionAnalysisResult,
  userName?: string,
): string {
  // Strip tokensUsed so we don't pollute the prompt with bookkeeping fields.
  const stripTokens = (v: VisionAnalysisResult) => ({
    symbols: v.symbols,
    colors: v.colors,
    patterns: v.patterns,
    rawDescription: v.rawDescription,
  });

  const namePart = userName ? `User name (for context only, do NOT echo it verbatim): ${userName}\n\n` : "";

  return `${namePart}firstVisionResult: ${JSON.stringify(stripTokens(first), null, 2)}\n\nsecondVisionResult: ${JSON.stringify(stripTokens(second), null, 2)}\n\nProduce the comparison NOW as a single strict JSON object per your system instructions.`;
}

/**
 * Strip an optional ```json ... ``` markdown fence around model output.
 * Some models are stubborn about wrapping even when told not to.
 */
function unwrapJsonFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return trimmed;
}

/**
 * Parsed JSON envelope returned by both prompts.
 */
interface ComparisonEnvelope {
  intro: string;
  sections: Array<{ title: string; content: string }>;
}

/**
 * Best-effort JSON parser for the comparison envelope.
 * Returns null on any failure.
 */
function tryParseEnvelope(raw: string): ComparisonEnvelope | null {
  try {
    const cleaned = unwrapJsonFence(raw);
    const parsed: unknown = JSON.parse(cleaned);

    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    if (typeof obj.intro !== "string") return null;
    if (!Array.isArray(obj.sections)) return null;

    const sections: Array<{ title: string; content: string }> = [];
    for (const s of obj.sections) {
      if (typeof s !== "object" || s === null) return null;
      const sec = s as Record<string, unknown>;
      if (typeof sec.title !== "string" || typeof sec.content !== "string") return null;
      sections.push({ title: sec.title, content: sec.content });
    }

    return { intro: obj.intro, sections };
  } catch {
    return null;
  }
}

/**
 * Render the JSON envelope as Telegram-safe HTML.
 * Section titles become bold, intro is paragraph above.
 * The caller is expected to run sanitizeTelegramHtml on the output before sending.
 */
function renderEnvelopeForTelegram(envelope: ComparisonEnvelope): string {
  const parts: string[] = [];

  if (envelope.intro.trim()) {
    parts.push(envelope.intro.trim());
  }

  for (const section of envelope.sections) {
    const title = section.title.trim();
    const content = section.content.trim();
    if (!title && !content) continue;
    if (title) {
      parts.push(`<b>${title}</b>\n${content}`);
    } else {
      parts.push(content);
    }
  }

  return parts.join("\n\n");
}

/**
 * Generate a comparison interpretation of two cups.
 *
 * @returns ComparisonResult with text ready to send, plus metadata.
 */
export async function generateComparison(
  input: GenerateComparisonInput,
): Promise<ComparisonResult> {
  const { firstVisionResult, secondVisionResult, compareMode, language, userName } = input;

  const lang = normalizeLanguage(language);
  const { modelName, systemPrompt, temperature, maxTokens } = selectModelAndPrompt(compareMode, lang);

  logger.debug({ compareMode, lang, modelName }, "Generating comparison");

  const model = createModel(modelName, { temperature, maxTokens });
  const userPayload = buildUserPayload(firstVisionResult, secondVisionResult, userName);

  const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPayload)];

  try {
    const response = await model.invoke(messages);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    const rawText =
      typeof response.content === "string"
        ? response.content
        : response.content
            .filter((block) => block.type === "text")
            .map((block) => ("text" in block ? block.text : ""))
            .join("\n");

    const envelope = tryParseEnvelope(rawText);

    if (!envelope) {
      logger.warn({ compareMode, lang, preview: rawText.slice(0, 200) }, "Comparison response not parseable as JSON envelope, sending raw");
      // Fallback: send the raw text. It may already be human-readable for some
      // models that refuse JSON; sanitizeTelegramHtml at the worker layer will
      // strip unsupported tags.
      return {
        text: rawText.trim(),
        rawText,
        tokensUsed,
        modelUsed: modelName,
        success: false,
      };
    }

    const rendered = renderEnvelopeForTelegram(envelope);

    return {
      text: rendered,
      rawText,
      tokensUsed,
      modelUsed: modelName,
      success: true,
    };
  } catch (error) {
    logger.error({ error, compareMode, lang, modelName }, "Comparison chain invocation failed");
    throw error;
  }
}
