// supabase/functions/create-subscription/index.ts
// Creates a subscription with YooKassa payment (save_payment_method for recurring billing)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types
type SubscriptionTier = 'basic' | 'advanced' | 'premium'

interface CreateSubscriptionRequest {
  tier: SubscriptionTier
  billing_period_months: number
  return_url?: string
}

// Subscription tier prices (monthly, in RUB)
const TIER_PRICES: Record<string, number> = { basic: 299, advanced: 799, premium: 3333 }
const BILLING_DISCOUNTS: Record<number, number> = { 1: 0, 3: 15, 6: 25, 12: 50 }

const TIER_NAMES: Record<string, string> = {
  basic: 'Базовый',
  advanced: 'Продвинутый',
  premium: 'Премиум',
}

const VALID_TIERS: SubscriptionTier[] = ['basic', 'advanced', 'premium']
const VALID_BILLING_PERIODS = [1, 3, 6, 12]

// Fiscal receipt configuration (54-FZ)
const RECEIPT_TAX_SYSTEM_CODE = 2  // УСН (доходы)
const RECEIPT_VAT_CODE = 1  // Без НДС

function isValidTier(tier: string): tier is SubscriptionTier {
  return VALID_TIERS.includes(tier as SubscriptionTier)
}

function calculatePrice(tier: string, billingPeriodMonths: number): { total: number; base: number; discount: number } {
  const monthlyPrice = TIER_PRICES[tier]
  const discountPercent = BILLING_DISCOUNTS[billingPeriodMonths] || 0
  const base = monthlyPrice * billingPeriodMonths
  const total = Math.round(base * (1 - discountPercent / 100))
  return { total, base, discount: discountPercent }
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
    let body: CreateSubscriptionRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate tier
    const { tier, billing_period_months, return_url } = body

    if (!tier || !isValidTier(tier)) {
      return new Response(
        JSON.stringify({
          error: `Invalid subscription tier. Must be one of: ${VALID_TIERS.join(', ')}`,
          code: "INVALID_TIER"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate billing period
    if (!billing_period_months || !VALID_BILLING_PERIODS.includes(billing_period_months)) {
      return new Response(
        JSON.stringify({
          error: `Invalid billing period. Must be one of: ${VALID_BILLING_PERIODS.join(', ')}`,
          code: "INVALID_BILLING_PERIOD"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate price
    const { total: amountRub, base: baseAmountRub, discount: discountPercent } = calculatePrice(tier, billing_period_months)

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check for existing active/pending subscription
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, tier')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'pending'])
      .maybeSingle()

    if (existingSub) {
      return new Response(
        JSON.stringify({
          error: `You already have an ${existingSub.status} subscription (${existingSub.tier}). Cancel it first before subscribing to a new plan.`,
          code: "EXISTING_SUBSCRIPTION"
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create subscription record (status=pending)
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + billing_period_months)

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        tier,
        status: 'pending',
        billing_period_months,
        amount_rub: amountRub,
        base_amount_rub: baseAmountRub,
        discount_percent: discountPercent,
      })
      .select('id')
      .single()

    if (subError || !subscription) {
      console.error("Error creating subscription:", subError)
      return new Response(
        JSON.stringify({ error: "Failed to create subscription", code: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const subscriptionId = subscription.id

    // Create initial subscription_payments record
    const { data: subPayment, error: paymentRecordError } = await supabaseAdmin
      .from('subscription_payments')
      .insert({
        subscription_id: subscriptionId,
        user_id: userId,
        amount_rub: amountRub,
        status: 'pending',
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        is_initial: true,
      })
      .select('id')
      .single()

    if (paymentRecordError || !subPayment) {
      console.error("Error creating subscription payment:", paymentRecordError)
      // Clean up subscription
      await supabaseAdmin.from('subscriptions').delete().eq('id', subscriptionId)
      return new Response(
        JSON.stringify({ error: "Failed to create payment record", code: "DB_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const subscriptionPaymentId = subPayment.id

    // Get YooKassa credentials
    const shopId = Deno.env.get("YUKASSA_SHOP_ID")
    const secretKey = Deno.env.get("YUKASSA_SECRET_KEY")

    if (!shopId || !secretKey) {
      console.error("YooKassa credentials not configured")
      return new Response(
        JSON.stringify({ error: "Payment service not configured", code: "YUKASSA_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Build return URL for 3D Secure redirect
    const origin = return_url
      ? new URL(return_url).origin
      : "https://symancy.ru"
    const paymentReturnUrl = `${origin}/subscription/result?subscription_id=${subscriptionId}`

    const tierName = TIER_NAMES[tier]
    const periodLabel = billing_period_months === 1 ? '1 мес.' : `${billing_period_months} мес.`
    const description = `Symancy - Подписка "${tierName}" (${periodLabel})`
    const idempotenceKey = crypto.randomUUID()

    // Create YooKassa payment with save_payment_method for recurring billing
    const yukassaPayload = {
      amount: {
        value: amountRub.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "embedded",
        return_url: paymentReturnUrl,
      },
      capture: true,
      save_payment_method: true,
      merchant_customer_id: userId,
      description,
      receipt: {
        customer: {
          email: user.email,
        },
        items: [
          {
            description,
            quantity: "1.00",
            amount: {
              value: amountRub.toFixed(2),
              currency: "RUB",
            },
            vat_code: RECEIPT_VAT_CODE,
            measure: "piece",
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
        tax_system_code: RECEIPT_TAX_SYSTEM_CODE,
      },
      metadata: {
        user_id: userId,
        subscription_id: subscriptionId,
        subscription_payment_id: subscriptionPaymentId,
        payment_type: "subscription_initial",
        tier,
        billing_period_months,
      },
    }

    console.log("Creating YooKassa subscription payment:", {
      subscriptionId,
      tier,
      billing_period_months,
      amount: amountRub,
    })

    const yukassaResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
        Authorization: `Basic ${btoa(`${shopId}:${secretKey}`)}`,
      },
      body: JSON.stringify(yukassaPayload),
    })

    if (!yukassaResponse.ok) {
      const errorText = await yukassaResponse.text()
      console.error("YooKassa API error:", yukassaResponse.status, errorText)
      // Clean up DB records
      await supabaseAdmin.from('subscription_payments').delete().eq('id', subscriptionPaymentId)
      await supabaseAdmin.from('subscriptions').delete().eq('id', subscriptionId)
      return new Response(
        JSON.stringify({ error: "Failed to create payment", code: "YUKASSA_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const yukassaPayment = await yukassaResponse.json()

    // Validate YooKassa response
    if (!yukassaPayment.id || !yukassaPayment.confirmation?.confirmation_token) {
      console.error("Invalid YooKassa response:", yukassaPayment)
      return new Response(
        JSON.stringify({ error: "Invalid payment gateway response", code: "YUKASSA_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const confirmationToken = yukassaPayment.confirmation.confirmation_token

    // Update subscription_payments with yukassa_payment_id
    const { error: updateError } = await supabaseAdmin
      .from('subscription_payments')
      .update({ yukassa_payment_id: yukassaPayment.id })
      .eq('id', subscriptionPaymentId)

    if (updateError) {
      console.error("Error updating subscription payment with yukassa_payment_id:", updateError)
      console.error("CRITICAL: Payment created in YooKassa but failed to store yukassa_payment_id", {
        yukassa_payment_id: yukassaPayment.id,
        subscription_payment_id: subscriptionPaymentId,
      })
    }

    // Track analytics event
    try {
      await supabaseAdmin.from("payment_analytics").insert({
        event: "subscription_started",
        user_id: userId,
        product_type: tier,
        amount_rub: amountRub,
        metadata: {
          yukassa_payment_id: yukassaPayment.id,
          subscription_id: subscriptionId,
          subscription_payment_id: subscriptionPaymentId,
          billing_period_months,
          discount_percent: discountPercent,
        },
      })
    } catch (analyticsError) {
      console.error("Analytics error:", analyticsError)
    }

    console.log("Subscription payment created successfully:", {
      subscriptionId,
      subscriptionPaymentId,
      yukassa_payment_id: yukassaPayment.id,
      tier,
    })

    // Return confirmation token for widget initialization
    return new Response(
      JSON.stringify({
        confirmation_token: confirmationToken,
        subscription_id: subscriptionId,
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
