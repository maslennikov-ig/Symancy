/**
 * OpenRouter model pricing table.
 *
 * Prices are USD per 1,000,000 tokens, split into `prompt` and `completion`.
 * Source: openrouter.ai/models (verify periodically — prices change).
 *
 * NOTE: the `analysis_history` table stores a single `tokens_used` value
 * per row (no prompt/completion split for the LLM step), so the cost
 * calculator in `generate-cost-report.ts` falls back to the arithmetic
 * mean of the two rates. When per-direction breakdown becomes available
 * the calculator can be refined without touching this table.
 *
 * Keep both the model IDs from the original PRD and the IDs actually
 * observed in production (`model_used` / `vision_model_used` values) —
 * IDs evolve as OpenRouter releases new revisions and we want any
 * historical row to resolve to *some* price entry.
 */

export interface ModelPricing {
  /** Display label for the model in reports (e.g. role + version). */
  label: string;
  /** USD per 1M prompt tokens. */
  promptPer1M: number;
  /** USD per 1M completion tokens. */
  completionPer1M: number;
  /** Human-readable role of this model in the Symancy pipeline. */
  role: "vision" | "arina-basic" | "arina-pro" | "cassandra" | "chat" | "other";
  /** Whether this pricing is a best-effort approximation (no exact match found). */
  approximate?: boolean;
}

export const OPENROUTER_PRICING: Record<string, ModelPricing> = {
  // ---------------------------------------------------------------------------
  // Vision models (image -> structured description)
  // ---------------------------------------------------------------------------
  "x-ai/grok-4-fast": {
    label: "xAI Grok 4 Fast (vision)",
    promptPer1M: 0.20,
    completionPer1M: 0.50,
    role: "vision",
  },
  "x-ai/grok-4.1-fast": {
    // Newer minor revision observed in production. Pricing assumed identical
    // to grok-4-fast until OpenRouter publishes a separate rate.
    label: "xAI Grok 4.1 Fast (vision)",
    promptPer1M: 0.20,
    completionPer1M: 0.50,
    role: "vision",
    approximate: true,
  },
  "google/gemma-4-31b-it": {
    // Referenced in symancy-backend/src/config/constants.ts as MODEL_VISION.
    // Treated as a midrange vision model; verify on next pricing refresh.
    label: "Google Gemma 4 31B IT (vision)",
    promptPer1M: 0.10,
    completionPer1M: 0.30,
    role: "vision",
    approximate: true,
  },

  // ---------------------------------------------------------------------------
  // Arina (interpretation) — basic tier
  // ---------------------------------------------------------------------------
  "qwen/qwen-3-plus": {
    label: "Qwen 3 Plus (Arina basic)",
    promptPer1M: 0.40,
    completionPer1M: 1.20,
    role: "arina-basic",
  },
  "qwen/qwen3.5-plus-02-15": {
    // Production revision actually written into model_used. Pricing assumed
    // close to qwen-3-plus baseline until confirmed against OpenRouter.
    label: "Qwen 3.5 Plus (Arina basic)",
    promptPer1M: 0.40,
    completionPer1M: 1.20,
    role: "arina-basic",
    approximate: true,
  },
  "qwen/qwen3.6-plus": {
    // Constant value referenced in code as MODEL_ARINA. Same family.
    label: "Qwen 3.6 Plus (Arina basic)",
    promptPer1M: 0.40,
    completionPer1M: 1.20,
    role: "arina-basic",
    approximate: true,
  },
  "deepseek/deepseek-v4-flash": {
    // MODEL_ARINA_BASIC / MODEL_CHAT / MODEL_MEMORY_EXTRACTION. Cheap tier.
    label: "DeepSeek V4 Flash (chat/basic)",
    promptPer1M: 0.07,
    completionPer1M: 0.30,
    role: "chat",
    approximate: true,
  },

  // ---------------------------------------------------------------------------
  // Arina (interpretation) — pro tier
  // ---------------------------------------------------------------------------
  "openai/gpt-oss-120b": {
    label: "OpenAI gpt-oss 120B (Arina pro)",
    promptPer1M: 0.50,
    completionPer1M: 2.00,
    role: "arina-pro",
  },

  // ---------------------------------------------------------------------------
  // Cassandra (premium thinking)
  // ---------------------------------------------------------------------------
  "moonshotai/kimi-k2-thinking": {
    label: "Moonshot Kimi K2 Thinking (Cassandra)",
    promptPer1M: 1.50,
    completionPer1M: 4.50,
    role: "cassandra",
  },
};

/**
 * Average price per 1M tokens (USD), used because `analysis_history.tokens_used`
 * does not distinguish prompt vs completion. Slight over- or under-estimate
 * depending on the prompt/completion ratio of any given run.
 */
export function averagePricePer1M(p: ModelPricing): number {
  return (p.promptPer1M + p.completionPer1M) / 2;
}

/**
 * Look up pricing by model id. Returns `undefined` when the id is not in the
 * table — callers should warn and treat the cost contribution as 0.
 */
export function lookupPricing(modelId: string | null | undefined): ModelPricing | undefined {
  if (!modelId) return undefined;
  return OPENROUTER_PRICING[modelId];
}
