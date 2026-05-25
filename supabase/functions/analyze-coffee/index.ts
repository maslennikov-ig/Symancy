
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { ARINA_SYSTEM_PROMPT, CASSANDRA_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from "./prompts.ts"
import { getPrompt } from "./getPrompt.ts"
import { getConfigValue } from "./getConfig.ts"
import { getCreditType } from "./creditMapping.ts"
import { runQualityCheck } from "./qualityCheck.ts"

/**
 * Sanitize user input before prompt interpolation to prevent prompt injection.
 * - Escapes template markers ({{ and }})
 * - Removes newlines (prevents instruction injection)
 * - Limits length to prevent token overflow
 */
function sanitizePromptInput(input: string, maxLength = 200): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\{\{/g, '&#123;&#123;')  // Escape opening template markers
    .replace(/\}\}/g, '&#125;&#125;')  // Escape closing template markers
    .replace(/[\n\r]/g, ' ')            // Remove newlines
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim()
    .substring(0, maxLength);           // Limit length
}

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")
const SITE_URL = Deno.env.get("SITE_URL") || "https://symancy.ru"
const APP_NAME = "Symancy/1.0"
// Fallback models/params (used only if system_config is unreachable).
// Live values come from system_config via getConfig() — admin panel controls
// both Telegram bot and Web Edge Function from one place.
// Keep these in sync with symancy-backend/src/config/constants.ts.
const FALLBACK_VISION_MODEL = "google/gemma-4-31b-it"
const FALLBACK_VISION_TEMPERATURE = 0.7
const FALLBACK_VISION_MAX_TOKENS = 4096

const FALLBACK_ARINA_MODEL = "qwen/qwen3.6-plus"
const FALLBACK_ARINA_TEMPERATURE = 0.9
const FALLBACK_ARINA_MAX_TOKENS = 5000
const FALLBACK_ARINA_FREQUENCY_PENALTY = 0.6
const FALLBACK_ARINA_PRESENCE_PENALTY = 0.5

const FALLBACK_CASSANDRA_MODEL = "moonshotai/kimi-k2-thinking"
const FALLBACK_CASSANDRA_TEMPERATURE = 1.1
const FALLBACK_CASSANDRA_MAX_TOKENS = 5000
const FALLBACK_CASSANDRA_FREQUENCY_PENALTY = 0.4
const FALLBACK_CASSANDRA_PRESENCE_PENALTY = 0.3

// Quality check model: cheap, fast, vision-capable.
// Used only for the pre-check call — does NOT affect main analysis quality.
// Deliberately a lightweight model to keep latency and cost low.
const FALLBACK_QUALITY_CHECK_MODEL = "google/gemma-3-12b-it"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. AUTHENTICATION
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Missing Authorization header")

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Unauthorized")

    // 2. PARSE REQUEST
    const { image, mimeType, userData, mode = 'psychologist', creditType, language = 'ru' } = await req.json()

    if (!image) throw new Error("Image is required")

    // 3. QUALITY PRE-CHECK (before credit consumption)
    // Run a lightweight vision call to detect bad photos.
    // If the photo is rejected, return hints WITHOUT consuming any credit.
    const qualityCheckModel = await getConfigValue(
      supabaseClient,
      "quality_check_model",
      FALLBACK_QUALITY_CHECK_MODEL,
    )

    const qualityResult = await runQualityCheck(
      supabaseClient,
      image,
      mimeType,
      OPENROUTER_API_KEY!,
      SITE_URL,
      APP_NAME,
      qualityCheckModel,
    )

    if (!qualityResult.ok) {
      // Photo quality is insufficient — return hints, do NOT consume credit.
      return new Response(
        JSON.stringify({
          success: false,
          code: "QUALITY_CHECK_FAILED",
          hints: qualityResult.hints,
          issues: qualityResult.issues,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // 4. CONSUME CREDIT (Atomic Transaction)
    // Determine credit type from mode or explicit override
    const resolvedCreditType = getCreditType(mode, creditType)

    const { data: creditResult, error: creditError } = await supabaseClient.rpc('consume_credit', {
      p_user_id: user.id,
      p_credit_type: resolvedCreditType
    })

    if (creditError || !creditResult.success) {
      return new Response(JSON.stringify({
        error: "Insufficient credits", 
        code: "INSUFFICIENT_CREDITS" 
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 5. AI ANALYSIS - STEP 1: VISION
    // Model + params come from system_config (admin panel), with code fallback.
    const visionPromptResult = await getPrompt(supabaseClient, 'vision', VISION_SYSTEM_PROMPT);
    const visionSystemPrompt = visionPromptResult.content;
    if (visionPromptResult.error) {
      console.warn(`Vision prompt loaded from ${visionPromptResult.source}: ${visionPromptResult.error}`);
    }

    const [visionModel, visionTemperature, visionMaxTokens] = await Promise.all([
      getConfigValue(supabaseClient, 'vision_model', FALLBACK_VISION_MODEL),
      getConfigValue(supabaseClient, 'vision_temperature', FALLBACK_VISION_TEMPERATURE),
      getConfigValue(supabaseClient, 'vision_max_tokens', FALLBACK_VISION_MAX_TOKENS),
    ]);

    const visionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": APP_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: visionModel,
        temperature: visionTemperature,
        max_tokens: visionMaxTokens,
        messages: [
          {
            role: "system",
            content: visionSystemPrompt
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } }
            ]
          }
        ]
      })
    })

    if (!visionResponse.ok) {
        const err = await visionResponse.text()
        console.error("Vision API Error:", err)
        console.error("AI_FAILURE_AFTER_CREDIT", { userId: user.id, creditType: resolvedCreditType, error: err })
        throw new Error("AI Vision service unavailable")
    }

    const visionResult = await visionResponse.json()
    const visionDescription = visionResult.choices[0].message.content

    // 6. AI ANALYSIS - STEP 2: INTERPRETATION
    // Persona-specific model + params from system_config (admin panel), with code fallback.
    const isEsoteric = mode === 'esoteric';
    const selectedPromptKey = isEsoteric ? 'cassandra' : 'arina';
    const selectedFallback = isEsoteric ? CASSANDRA_SYSTEM_PROMPT : ARINA_SYSTEM_PROMPT;

    const personaKey = isEsoteric ? 'cassandra' : 'arina';
    const personaFallbacks = isEsoteric
      ? {
          model: FALLBACK_CASSANDRA_MODEL,
          temperature: FALLBACK_CASSANDRA_TEMPERATURE,
          maxTokens: FALLBACK_CASSANDRA_MAX_TOKENS,
          frequencyPenalty: FALLBACK_CASSANDRA_FREQUENCY_PENALTY,
          presencePenalty: FALLBACK_CASSANDRA_PRESENCE_PENALTY,
        }
      : {
          model: FALLBACK_ARINA_MODEL,
          temperature: FALLBACK_ARINA_TEMPERATURE,
          maxTokens: FALLBACK_ARINA_MAX_TOKENS,
          frequencyPenalty: FALLBACK_ARINA_FREQUENCY_PENALTY,
          presencePenalty: FALLBACK_ARINA_PRESENCE_PENALTY,
        };

    const [
      interpretationModel,
      interpretationTemperature,
      interpretationMaxTokens,
      interpretationFrequencyPenalty,
      interpretationPresencePenalty,
    ] = await Promise.all([
      getConfigValue(supabaseClient, `${personaKey}_model`, personaFallbacks.model),
      getConfigValue(supabaseClient, `${personaKey}_temperature`, personaFallbacks.temperature),
      getConfigValue(supabaseClient, `${personaKey}_max_tokens`, personaFallbacks.maxTokens),
      getConfigValue(supabaseClient, `${personaKey}_frequency_penalty`, personaFallbacks.frequencyPenalty),
      getConfigValue(supabaseClient, `${personaKey}_presence_penalty`, personaFallbacks.presencePenalty),
    ]);

    const interpretPromptResult = await getPrompt(supabaseClient, selectedPromptKey, selectedFallback);
    let systemPromptTemplate = interpretPromptResult.content;
    if (interpretPromptResult.error) {
      console.warn(`Interpretation prompt loaded from ${interpretPromptResult.source}: ${interpretPromptResult.error}`);
    }
    
    // Inject User Data (sanitized to prevent prompt injection - CRITICAL-2)
    const userName = sanitizePromptInput(userData?.name, 50) || "Friend"
    const userAge = sanitizePromptInput(userData?.age, 10) || "Unknown"
    const userGender = sanitizePromptInput(userData?.gender, 20) || "Unknown"
    const userIntent = sanitizePromptInput(userData?.intent, 200) || "General guidance"

    let systemPrompt = systemPromptTemplate
      .replace(/{{NAME}}/g, userName)
      .replace(/{{AGE}}/g, userAge)
      .replace(/{{GENDER}}/g, userGender)
      .replace(/{{INTENT}}/g, userIntent)

    const interpretResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": APP_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: interpretationModel,
        temperature: interpretationTemperature,
        max_tokens: interpretationMaxTokens,
        frequency_penalty: interpretationFrequencyPenalty,
        presence_penalty: interpretationPresencePenalty,
        response_format: { type: "json_object" }, // Enforce JSON
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Here is the visual analysis of my coffee cup:\n\n${visionDescription}\n\nPlease interpret this in ${language} language.`
          }
        ]
      })
    })

    if (!interpretResponse.ok) {
        const err = await interpretResponse.text()
        console.error("Interpretation API Error:", err)
        console.error("AI_FAILURE_AFTER_CREDIT", { userId: user.id, creditType: resolvedCreditType, error: err })
        throw new Error("AI Interpretation service unavailable")
    }

    const interpretResult = await interpretResponse.json()
    const finalJsonString = interpretResult.choices[0].message.content
    let finalAnalysis
    
    try {
        finalAnalysis = JSON.parse(finalJsonString)
    } catch (e) {
        console.error("JSON Parse Error:", finalJsonString)
        // Fallback or cleanup if AI returned bad JSON
        throw new Error("Failed to generate valid analysis format")
    }

    // 7. SAVE HISTORY
    // Use service role client to bypass RLS if needed, or just standard client
    // Standard client (supabaseClient) acts as the user, so RLS must allow INSERT own history
    const { error: historyError } = await supabaseClient
      .from('analysis_history')
      .insert({
        user_id: user.id,
        analysis: finalAnalysis,
        focus_area: userData?.intent || mode, // Use intent as focus area description
        metadata: {
            mode: mode,
            model: interpretationModel,
            vision_model: visionModel,
            user_data: userData,
            vision_summary: visionDescription.substring(0, 200) + "..."
        }
      })

    if (historyError) {
        console.error("History Save Error:", historyError)
        // We don't fail the request if history save fails, but it's bad.
    }

    // 8. RETURN RESULT
    return new Response(JSON.stringify({
        success: true,
        data: finalAnalysis,
        credits_remaining: creditResult.remaining
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Function Error:", error)
    return new Response(JSON.stringify({
        error: error.message,
        code: "INTERNAL_ERROR" 
    }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
