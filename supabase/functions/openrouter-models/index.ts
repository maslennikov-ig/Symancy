// supabase/functions/openrouter-models/index.ts
// Proxies requests to OpenRouter API to fetch available models
// Hides API key from frontend clients
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OpenRouterModel {
  id: string
  name: string
  pricing: {
    prompt: string
    completion: string
  }
  context_length: number
  top_provider?: {
    is_moderated?: boolean
  }
  architecture?: {
    modality?: string
  }
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

interface TransformedModel {
  id: string
  name: string
  provider: string
  shortName: string
  pricing: {
    prompt: number
    completion: number
  }
  contextLength: number
  isModerated: boolean
  modality: string
}

/**
 * Extract provider and short name from model ID
 * e.g., "google/gemini-2.0-flash" -> { provider: "google", shortName: "gemini-2.0-flash" }
 */
function parseModelId(id: string): { provider: string; shortName: string } {
  const parts = id.split('/')
  if (parts.length >= 2) {
    return {
      provider: parts[0],
      shortName: parts.slice(1).join('/'),
    }
  }
  return { provider: 'unknown', shortName: id }
}

/**
 * Transform OpenRouter model to our format
 */
function transformModel(model: OpenRouterModel): TransformedModel {
  const { provider, shortName } = parseModelId(model.id)

  return {
    id: model.id,
    name: model.name,
    provider,
    shortName,
    pricing: {
      prompt: parseFloat(model.pricing.prompt) || 0,
      completion: parseFloat(model.pricing.completion) || 0,
    },
    contextLength: model.context_length || 0,
    isModerated: model.top_provider?.is_moderated ?? false,
    modality: model.architecture?.modality || 'text',
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Only allow GET method
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY")
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not configured")
      return new Response(
        JSON.stringify({ error: "API key not configured", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Fetch models from OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://symancy.ru",
        "X-Title": "Symancy Admin",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("OpenRouter API error:", response.status, errorText)
      return new Response(
        JSON.stringify({
          error: "Failed to fetch models from OpenRouter",
          code: "UPSTREAM_ERROR",
          status: response.status
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const data = await response.json() as OpenRouterModelsResponse

    // Transform and filter models
    const models = data.data
      .map(transformModel)
      .filter(m => m.modality.includes('text')) // Filter text-capable models
      .sort((a, b) => {
        // Sort by provider first, then by name
        if (a.provider !== b.provider) {
          return a.provider.localeCompare(b.provider)
        }
        return a.name.localeCompare(b.name)
      })

    return new Response(
      JSON.stringify({
        models,
        count: models.length,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300" // Cache for 5 minutes
        }
      }
    )

  } catch (error) {
    console.error("Error in openrouter-models function:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
