/**
 * qualityCheck.ts
 *
 * AI-based photo quality pre-check for coffee grounds images.
 * Runs a lightweight vision call BEFORE credit consumption to detect
 * poor-quality photos and return actionable hints without charging the user.
 *
 * Returns machine-readable issue codes so the frontend can display
 * localized text without coupling to any specific language.
 */

import { createClient } from "npm:@supabase/supabase-js@2"
import { getPrompt } from "./getPrompt.ts"

// ============================================================================
// Types
// ============================================================================

/**
 * Machine-readable hint codes.
 * Frontend maps these to localized strings via quality.hints.* i18n keys.
 */
export type QualityHintCode =
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "no_grounds"
  | "cup_bottom_not_visible"
  | "image_not_coffee"
  | "too_much_liquid"

/**
 * Raw structure expected from the AI quality-check model.
 */
interface QualityCheckAIResponse {
  ok: boolean
  issues: string[]
  hints: QualityHintCode[]
}

/**
 * Result returned by runQualityCheck().
 */
export interface QualityCheckResult {
  ok: boolean
  /** Machine-readable hint codes (empty when ok=true) */
  hints: QualityHintCode[]
  /** Raw issue descriptions from the model (for logging/debugging) */
  issues: string[]
}

// ============================================================================
// Fallback prompt (used when DB is unavailable)
// ============================================================================

export const QUALITY_CHECK_FALLBACK_PROMPT = `You are a strict image quality inspector for a coffee grounds reading app.

Your ONLY job: decide whether the submitted photo is usable for coffee grounds analysis.

A GOOD photo must have ALL of the following:
1. A cup/saucer with coffee grounds clearly visible (not liquid coffee)
2. The bottom of the cup is visible with grounds pattern
3. Adequate lighting — not too dark, not overexposed
4. Image is reasonably sharp (not severely blurred)

Evaluate the image and respond with ONLY a raw JSON object (no markdown fences, no extra text):

{
  "ok": <boolean — true if the photo is suitable for analysis>,
  "issues": [<short English description of each problem found, or empty array if ok>],
  "hints": [<array of applicable code strings from the allowed list below, or empty array if ok>]
}

Allowed hint codes (use ONLY these exact strings):
- "too_dark"              — image is too dark to see the grounds
- "too_bright"            — image is overexposed/too bright
- "blurry"                — image is out of focus or severely motion-blurred
- "no_grounds"            — no coffee grounds visible (liquid coffee, empty cup, or non-coffee object)
- "cup_bottom_not_visible"— the bottom of the cup with grounds pattern is not visible
- "image_not_coffee"      — the image does not appear to be a coffee cup at all
- "too_much_liquid"       — the cup still has too much liquid coffee; grounds are submerged

Rules:
- Be STRICT but fair. Reject only genuinely problematic photos.
- A slightly imperfect but clearly readable grounds photo should pass (ok=true).
- Return ok=false ONLY if the photo cannot realistically be used for grounds analysis.
- The "hints" array must contain ONLY codes from the allowed list above.
- Output ONLY the JSON object. No prose, no explanation outside JSON.`

// ============================================================================
// Main function
// ============================================================================

/**
 * Run a lightweight AI quality check on the submitted coffee image.
 *
 * Uses the same OpenRouter API as the main analysis but with a cheap,
 * fast vision-capable model. Credit is NOT consumed at this stage.
 *
 * @param supabase     Supabase client (for loading the quality_check prompt)
 * @param image        Base64-encoded image data (no data-URL prefix)
 * @param mimeType     MIME type of the image (e.g. "image/webp")
 * @param openRouterKey OpenRouter API key
 * @param siteUrl      HTTP-Referer header value
 * @param appName      X-Title header value
 * @param qualityModel Model to use for quality check (fast vision-capable model)
 */
export async function runQualityCheck(
  supabase: ReturnType<typeof createClient>,
  image: string,
  mimeType: string,
  openRouterKey: string,
  siteUrl: string,
  appName: string,
  qualityModel: string,
): Promise<QualityCheckResult> {
  // Load prompt from DB (with fallback to hardcoded prompt)
  const promptResult = await getPrompt(
    supabase,
    "quality_check",
    QUALITY_CHECK_FALLBACK_PROMPT,
  )

  if (promptResult.error) {
    console.warn(
      `Quality check prompt loaded from ${promptResult.source}: ${promptResult.error}`,
    )
  }

  const systemPrompt = promptResult.content

  // Call OpenRouter vision model
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "HTTP-Referer": siteUrl,
      "X-Title": appName,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: qualityModel,
      temperature: 0.1, // Low temperature: we want consistent, factual judgments
      max_tokens: 256,  // Quality check response is small
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Evaluate this coffee cup photo for quality.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${image}`,
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error("Quality check API error:", errText)
    // On API failure: allow the photo to pass (fail-open).
    // Better to run the main analysis on a potentially bad photo
    // than to block users due to a quality-check service failure.
    console.warn("QUALITY_CHECK_BYPASS: API unavailable, allowing photo to pass")
    return { ok: true, hints: [], issues: [] }
  }

  const apiResult = await response.json()
  const rawContent: string = apiResult?.choices?.[0]?.message?.content ?? ""

  // Parse and validate the AI response
  let parsed: QualityCheckAIResponse
  try {
    parsed = JSON.parse(rawContent)
  } catch (e) {
    console.error("Quality check JSON parse error:", rawContent)
    // Fail-open on parse error: do not block the user
    console.warn("QUALITY_CHECK_BYPASS: JSON parse failed, allowing photo to pass")
    return { ok: true, hints: [], issues: [] }
  }

  // Sanitize: only keep allowed hint codes
  const allowedCodes: QualityHintCode[] = [
    "too_dark",
    "too_bright",
    "blurry",
    "no_grounds",
    "cup_bottom_not_visible",
    "image_not_coffee",
    "too_much_liquid",
  ]

  const safeHints: QualityHintCode[] = Array.isArray(parsed.hints)
    ? (parsed.hints.filter((h): h is QualityHintCode =>
        allowedCodes.includes(h as QualityHintCode)
      ))
    : []

  const safeIssues: string[] = Array.isArray(parsed.issues)
    ? parsed.issues.filter((i) => typeof i === "string").slice(0, 10)
    : []

  const ok = typeof parsed.ok === "boolean" ? parsed.ok : safeHints.length === 0

  console.log(
    JSON.stringify({
      event: "QUALITY_CHECK_RESULT",
      ok,
      hints: safeHints,
      issues: safeIssues,
    }),
  )

  return { ok, hints: safeHints, issues: safeIssues }
}
