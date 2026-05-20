// supabase/functions/compare-coffee/index.ts
//
// Compare two coffee grounds cups for the Symancy web app.
// - dynamics      → Arina, same person, two moments in time      (consumes `pro` credit)
// - compatibility → Cassandra, two different people, one reading (consumes `cassandra` credit)
//
// Auth: Bearer <user_jwt>. Auth user is looked up in unified_users via auth_id.
// Credits: consume_unified_credit / refund_unified_credit (keyed by telegram_id of the
// linked unified_users row). Web-only users (no telegram_id) fall back to a direct
// row-level update on unified_user_credits via the service-role client.
//
// History: two rows are inserted into analysis_history:
//   1. {dynamics|compatibility}_first      → vision_result of cup #1, interpretation = NULL
//   2. {dynamics|compatibility}             → vision_result of cup #2 + interpretation JSON,
//                                            paired_analysis_id → id of row #1

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { VISION_SYSTEM_PROMPT } from "../analyze-coffee/prompts.ts";
import { ARINA_DYNAMICS_PROMPT, CASSANDRA_COMPATIBILITY_PROMPT } from "../analyze-coffee/comparison-prompts.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://symancy.ru";
const APP_NAME = "Symancy/1.0";

const VISION_MODEL = "x-ai/grok-4.1-fast";
const DYNAMICS_MODEL = "openai/gpt-oss-120b";
const COMPATIBILITY_MODEL = "moonshotai/kimi-k2-thinking";

const ALLOWED_MIME = new Set(["image/webp", "image/jpeg", "image/png"]);
const ALLOWED_LANG = new Set(["ru", "en", "zh"]);
const ALLOWED_MODES = new Set(["dynamics", "compatibility"] as const);

type CompareMode = "dynamics" | "compatibility";
type CreditType = "pro" | "cassandra";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, code: string, status: number): Response {
  return jsonResponse({ error: message, code }, status);
}

function languageInstruction(language: string): string {
  switch (language) {
    case "en":
      return "Respond in English.";
    case "zh":
      return "请用中文回答。";
    case "ru":
    default:
      return "Отвечай на русском языке.";
  }
}

interface VisionCallResult {
  visionResult: { description: string };
  tokensUsed: number;
}

async function callVision(image: string, mimeType: string): Promise<VisionCallResult> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": SITE_URL,
      "X-Title": APP_NAME,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Vision API Error:", err);
    throw new Error("Vision service unavailable");
  }

  const data = await response.json();
  const description = data?.choices?.[0]?.message?.content ?? "";
  const tokensUsed = data?.usage?.total_tokens ?? 0;

  if (!description) {
    console.error("Vision API returned empty content", data);
    throw new Error("Vision service returned empty content");
  }

  return {
    visionResult: { description },
    tokensUsed,
  };
}

interface ComparisonCallResult {
  parsed: { intro: string; sections: Array<{ title: string; content: string }> };
  raw: string;
  tokensUsed: number;
  model: string;
}

async function callComparison(
  systemPrompt: string,
  firstVisionResult: { description: string },
  secondVisionResult: { description: string },
  language: string,
  model: string,
): Promise<ComparisonCallResult> {
  const userPayload = JSON.stringify({ firstVisionResult, secondVisionResult });
  const userMessage = `${userPayload}\n\n${languageInstruction(language)}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": SITE_URL,
      "X-Title": APP_NAME,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Comparison API Error:", err);
    throw new Error("Comparison service unavailable");
  }

  const data = await response.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const tokensUsed: number = data?.usage?.total_tokens ?? 0;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("Comparison JSON parse error", { raw, err: String(e) });
    const invalidErr = new Error("AI response was not valid JSON");
    (invalidErr as Error & { _httpStatus?: number })._httpStatus = 502;
    throw invalidErr;
  }

  if (
    !parsed ||
    typeof parsed.intro !== "string" ||
    !Array.isArray(parsed.sections)
  ) {
    console.error("Comparison JSON has wrong shape", parsed);
    const shapeErr = new Error("AI response did not match expected shape");
    (shapeErr as Error & { _httpStatus?: number })._httpStatus = 502;
    throw shapeErr;
  }

  return { parsed, raw, tokensUsed, model };
}

// ---------------------------------------------------------------------------
// Credit operations
// ---------------------------------------------------------------------------

interface UnifiedUserLookup {
  unifiedUserId: string;
  telegramId: number | null;
}

async function lookupUnifiedUser(
  serviceClient: SupabaseClient,
  authId: string,
): Promise<UnifiedUserLookup | null> {
  const { data, error } = await serviceClient
    .from("unified_users")
    .select("id, telegram_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) {
    console.error("unified_users lookup error", error);
    return null;
  }
  if (!data) return null;
  return {
    unifiedUserId: data.id as string,
    telegramId: data.telegram_id == null ? null : Number(data.telegram_id),
  };
}

interface CreditOpResult {
  success: boolean;
  remaining: number | null;
  reason?: string;
}

/**
 * Consume one credit of the given type. Prefers RPC consume_unified_credit
 * (keyed by telegram_id). Falls back to a direct SQL update on
 * unified_user_credits for web-only users that have no telegram_id yet.
 */
async function consumeCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<CreditOpResult> {
  if (user.telegramId != null) {
    const { data, error } = await serviceClient.rpc("consume_unified_credit", {
      p_telegram_id: user.telegramId,
      p_credit_type: creditType,
    });
    if (error) {
      console.error("consume_unified_credit RPC error", error);
      return { success: false, remaining: null, reason: error.message };
    }
    // rpc returns TABLE(success boolean, remaining integer) → comes back as an array
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: !!row?.success,
      remaining: typeof row?.remaining === "number" ? row.remaining : null,
    };
  }

  // Fallback for web-only users without telegram_id linkage.
  const column = `credits_${creditType}`; // credits_pro | credits_cassandra
  const { data: current, error: fetchErr } = await serviceClient
    .from("unified_user_credits")
    .select(`id, ${column}`)
    .eq("unified_user_id", user.unifiedUserId)
    .maybeSingle();

  if (fetchErr) {
    console.error("unified_user_credits fetch error", fetchErr);
    return { success: false, remaining: null, reason: fetchErr.message };
  }
  if (!current) {
    return { success: false, remaining: 0, reason: "No credit row" };
  }

  const balance = Number((current as Record<string, unknown>)[column] ?? 0);
  if (balance <= 0) {
    return { success: false, remaining: 0, reason: "Insufficient credits" };
  }

  const { error: updErr } = await serviceClient
    .from("unified_user_credits")
    .update({ [column]: balance - 1, updated_at: new Date().toISOString() })
    .eq("unified_user_id", user.unifiedUserId);

  if (updErr) {
    console.error("unified_user_credits decrement error", updErr);
    return { success: false, remaining: balance, reason: updErr.message };
  }
  return { success: true, remaining: balance - 1 };
}

/**
 * Refund one credit. Best-effort: logs on failure but never throws.
 */
async function refundCreditForAuthUser(
  serviceClient: SupabaseClient,
  user: UnifiedUserLookup,
  creditType: CreditType,
): Promise<void> {
  try {
    if (user.telegramId != null) {
      const { error } = await serviceClient.rpc("refund_unified_credit", {
        p_telegram_id: user.telegramId,
        p_credit_type: creditType,
      });
      if (error) {
        console.error("refund_unified_credit RPC error", error);
      }
      return;
    }

    const column = `credits_${creditType}`;
    const { data: current, error: fetchErr } = await serviceClient
      .from("unified_user_credits")
      .select(`id, ${column}`)
      .eq("unified_user_id", user.unifiedUserId)
      .maybeSingle();

    if (fetchErr || !current) {
      console.error("Refund fallback fetch failed", fetchErr);
      return;
    }
    const balance = Number((current as Record<string, unknown>)[column] ?? 0);
    const { error: updErr } = await serviceClient
      .from("unified_user_credits")
      .update({ [column]: balance + 1, updated_at: new Date().toISOString() })
      .eq("unified_user_id", user.unifiedUserId);
    if (updErr) {
      console.error("Refund fallback update failed", updErr);
    }
  } catch (e) {
    console.error("Refund threw", e);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  // Track credit consumption so we can refund on downstream failure.
  let consumedCreditType: CreditType | null = null;
  let unifiedUser: UnifiedUserLookup | null = null;

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // 1. AUTH
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing Authorization header", "UNAUTHORIZED", 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    // 2. PARSE & VALIDATE INPUT
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", "BAD_REQUEST", 400);
    }

    const firstImage = body.firstImage as string | undefined;
    const firstMimeType = body.firstMimeType as string | undefined;
    const secondImage = body.secondImage as string | undefined;
    const secondMimeType = body.secondMimeType as string | undefined;
    const compareModeRaw = body.compareMode as string | undefined;
    const language = (body.language as string | undefined) ?? "ru";

    if (!firstImage || !secondImage) {
      return errorResponse("Both images are required", "BAD_REQUEST", 400);
    }
    if (!firstMimeType || !ALLOWED_MIME.has(firstMimeType)) {
      return errorResponse("Invalid firstMimeType", "BAD_REQUEST", 400);
    }
    if (!secondMimeType || !ALLOWED_MIME.has(secondMimeType)) {
      return errorResponse("Invalid secondMimeType", "BAD_REQUEST", 400);
    }
    if (!compareModeRaw || !ALLOWED_MODES.has(compareModeRaw as CompareMode)) {
      return errorResponse("Invalid compareMode", "BAD_REQUEST", 400);
    }
    if (!ALLOWED_LANG.has(language)) {
      return errorResponse("Invalid language", "BAD_REQUEST", 400);
    }
    const compareMode = compareModeRaw as CompareMode;

    // 3. RESOLVE UNIFIED USER
    unifiedUser = await lookupUnifiedUser(serviceClient, user.id);
    if (!unifiedUser) {
      return errorResponse(
        "Unified user record missing; complete onboarding first",
        "UNIFIED_USER_NOT_FOUND",
        409,
      );
    }

    // 4. CONSUME CREDIT
    const creditType: CreditType = compareMode === "dynamics" ? "pro" : "cassandra";
    const consumeResult = await consumeCreditForAuthUser(serviceClient, unifiedUser, creditType);
    if (!consumeResult.success) {
      return errorResponse(
        "Insufficient credits",
        "INSUFFICIENT_CREDITS",
        402,
      );
    }
    consumedCreditType = creditType;

    // 5. PARALLEL VISION ANALYSIS
    const [firstVision, secondVision] = await Promise.all([
      callVision(firstImage, firstMimeType),
      callVision(secondImage, secondMimeType),
    ]);

    // 6. COMPARISON
    const promptFn = compareMode === "dynamics"
      ? ARINA_DYNAMICS_PROMPT
      : CASSANDRA_COMPATIBILITY_PROMPT;
    const systemPrompt = promptFn(language as "ru" | "en" | "zh");
    const interpretationModel = compareMode === "dynamics"
      ? DYNAMICS_MODEL
      : COMPATIBILITY_MODEL;

    const comparison = await callComparison(
      systemPrompt,
      firstVision.visionResult,
      secondVision.visionResult,
      language,
      interpretationModel,
    );

    // 7. PERSIST HISTORY
    // 7a. First cup (vision-only stub) — must exist before we can reference it.
    const firstAnalysisType = compareMode === "dynamics" ? "dynamics_first" : "compatibility_first";
    const mainAnalysisType = compareMode; // 'dynamics' | 'compatibility'
    const persona = compareMode === "dynamics" ? "arina" : "cassandra";
    const totalVisionTokens = firstVision.tokensUsed + secondVision.tokensUsed;

    // telegram_user_id is NOT NULL on analysis_history; web-only users use 0 as a sentinel.
    const telegramUserIdForHistory = unifiedUser.telegramId ?? 0;

    const { data: firstRow, error: firstErr } = await serviceClient
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserIdForHistory,
        unified_user_id: unifiedUser.unifiedUserId,
        analysis_type: firstAnalysisType,
        persona,
        vision_result: firstVision.visionResult,
        vision_model_used: VISION_MODEL,
        vision_tokens_used: firstVision.tokensUsed,
        interpretation: null,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (firstErr || !firstRow) {
      console.error("analysis_history first insert error", firstErr);
      throw new Error("Failed to persist first cup history");
    }

    const { data: mainRow, error: mainErr } = await serviceClient
      .from("analysis_history")
      .insert({
        telegram_user_id: telegramUserIdForHistory,
        unified_user_id: unifiedUser.unifiedUserId,
        analysis_type: mainAnalysisType,
        persona,
        vision_result: secondVision.visionResult,
        vision_model_used: VISION_MODEL,
        vision_tokens_used: totalVisionTokens,
        interpretation: JSON.stringify(comparison.parsed),
        tokens_used: comparison.tokensUsed,
        model_used: interpretationModel,
        status: "completed",
        completed_at: new Date().toISOString(),
        paired_analysis_id: firstRow.id,
      })
      .select("id")
      .single();

    if (mainErr || !mainRow) {
      console.error("analysis_history main insert error", mainErr);
      throw new Error("Failed to persist comparison history");
    }

    // 8. RESPONSE
    return jsonResponse({
      success: true,
      result: comparison.parsed,
      analysisId: mainRow.id,
      pairedAnalysisId: firstRow.id,
      compareMode,
    });
  } catch (error) {
    const err = error as Error & { _httpStatus?: number };
    console.error("compare-coffee error", err);

    // Refund on any post-consume failure.
    if (consumedCreditType && unifiedUser) {
      await refundCreditForAuthUser(serviceClient, unifiedUser, consumedCreditType);
    }

    const status = err._httpStatus ?? 500;
    const code = status === 502 ? "AI_BAD_RESPONSE" : "INTERNAL_ERROR";
    return errorResponse(err.message || "Internal server error", code, status);
  }
});
