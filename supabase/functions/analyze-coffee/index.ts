
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { ARINA_SYSTEM_PROMPT, CASSANDRA_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from "./prompts.ts"
import { getCreditType } from "./creditMapping.ts"

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")
const SITE_URL = Deno.env.get("SITE_URL") || "https://symancy.ru"
const APP_NAME = "Symancy/1.0"
const VISION_MODEL = "google/gemini-1.5-flash"
const INTERPRETATION_MODEL = "google/gemini-1.5-flash"

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

    // 3. CONSUME CREDIT (Atomic Transaction)
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

    // 4. AI ANALYSIS - STEP 1: VISION
    // Using Gemini 1.5 Flash via OpenRouter for cost/speed
    const visionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": SITE_URL,
        "X-Title": APP_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [
          {
            role: "system",
            content: VISION_SYSTEM_PROMPT
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

    // 5. AI ANALYSIS - STEP 2: INTERPRETATION
    // Select Prompt
    let systemPromptTemplate = mode === 'esoteric' ? CASSANDRA_SYSTEM_PROMPT : ARINA_SYSTEM_PROMPT
    
    // Inject User Data
    const userName = userData?.name || "Friend"
    const userAge = userData?.age || "Unknown"
    const userGender = userData?.gender || "Unknown"
    const userIntent = userData?.intent || "General guidance"

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
        model: "google/gemini-1.5-flash",
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

    // 6. SAVE HISTORY
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
            model: INTERPRETATION_MODEL,
            vision_model: VISION_MODEL,
            user_data: userData,
            vision_summary: visionDescription.substring(0, 200) + "..."
        }
      })

    if (historyError) {
        console.error("History Save Error:", historyError)
        // We don't fail the request if history save fails, but it's bad.
    }

    // 7. RETURN RESULT
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
