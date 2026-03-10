// supabase/functions/cancel-subscription/index.ts
// Cancels an active subscription (access continues until current period end)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CancelSubscriptionRequest {
  subscription_id: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Only allow POST method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify JWT and extract user_id
    const authHeader = req.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const jwt = authHeader.replace("Bearer ", "")

    // Create Supabase client to verify JWT and get user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // Use anon key with user's JWT to verify auth
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)

    if (authError || !user) {
      console.error("Auth error:", authError)
      return new Response(
        JSON.stringify({ error: "Invalid token", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const userId = user.id

    // Parse request body
    let body: CancelSubscriptionRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { subscription_id } = body

    if (!subscription_id) {
      return new Response(
        JSON.stringify({ error: "Missing subscription_id", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch subscription and verify ownership
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, status, tier, current_period_end')
      .eq('id', subscription_id)
      .single()

    if (fetchError || !subscription) {
      console.error("Subscription not found:", fetchError)
      return new Response(
        JSON.stringify({ error: "Subscription not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify subscription belongs to user
    if (subscription.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Subscription not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify subscription is in a cancellable state
    if (!['active', 'past_due'].includes(subscription.status)) {
      return new Response(
        JSON.stringify({
          error: `Cannot cancel subscription with status: ${subscription.status}`,
          code: "INVALID_STATUS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Cancel subscription: set status, canceled_at, expires_at = current_period_end
    const now = new Date().toISOString()
    const expiresAt = subscription.current_period_end || now

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: now,
        expires_at: expiresAt,
      })
      .eq('id', subscription_id)

    if (updateError) {
      console.error("Error canceling subscription:", updateError)
      return new Response(
        JSON.stringify({ error: "Failed to cancel subscription", code: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Track analytics event
    try {
      await supabaseAdmin.from("payment_analytics").insert({
        event: "subscription_canceled",
        user_id: userId,
        product_type: subscription.tier,
        amount_rub: 0,
        metadata: {
          subscription_id,
          tier: subscription.tier,
          expires_at: expiresAt,
          previous_status: subscription.status,
        },
      })
    } catch (analyticsError) {
      console.error("Analytics error:", analyticsError)
    }

    console.log("Subscription canceled:", {
      subscription_id,
      user_id: userId,
      tier: subscription.tier,
      expires_at: expiresAt,
    })

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error("Unexpected error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})
