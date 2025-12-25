// supabase/functions/create-payment/index.ts
// Creates YooKassa payment and returns confirmation_token for widget initialization
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types
type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra'

interface CreatePaymentRequest {
  product_type: ProductType
  return_url?: string
}

interface Tariff {
  price: number
  credits: number
  creditType: 'basic' | 'pro' | 'cassandra'
  name: string
  description: string
}

// Tariff definitions matching types/payment.ts
const TARIFFS: Record<ProductType, Tariff> = {
  basic: {
    price: 100,
    credits: 1,
    creditType: 'basic',
    name: 'Новичок',
    description: '1 базовая расшифровка (3-4 блока)',
  },
  pack5: {
    price: 300,
    credits: 5,
    creditType: 'basic',
    name: 'Любитель',
    description: '5 расшифровок (скидка 40%)',
  },
  pro: {
    price: 500,
    credits: 1,
    creditType: 'pro',
    name: 'Внутренний мудрец',
    description: '1 PRO расшифровка (6+ блоков)',
  },
  cassandra: {
    price: 1000,
    credits: 1,
    creditType: 'cassandra',
    name: 'Кассандра',
    description: 'Эзотерическое предсказание',
  },
}

const VALID_PRODUCT_TYPES: ProductType[] = ['basic', 'pack5', 'pro', 'cassandra']

function isValidProductType(type: string): type is ProductType {
  return VALID_PRODUCT_TYPES.includes(type as ProductType)
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
    let body: CreatePaymentRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate product_type
    const { product_type, return_url } = body

    if (!product_type || !isValidProductType(product_type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid product type. Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`,
          code: "INVALID_PRODUCT_TYPE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get tariff details
    const tariff = TARIFFS[product_type]
    const purchaseId = crypto.randomUUID()

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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
    const paymentReturnUrl = `${origin}/payment/result?purchase_id=${purchaseId}`

    // Create YooKassa payment
    const yukassaPayload = {
      amount: {
        value: tariff.price.toFixed(2),
        currency: "RUB",
      },
      confirmation: {
        type: "embedded",
        return_url: paymentReturnUrl, // Required for 3D Secure
      },
      capture: true,
      description: `Symancy - ${tariff.name} (${tariff.description})`,
      metadata: {
        user_id: userId,
        product_type: product_type,
        purchase_id: purchaseId,
      },
    }

    console.log("Creating YooKassa payment:", { purchaseId, product_type, amount: tariff.price })

    const yukassaResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": purchaseId, // Use purchase_id as idempotency key
        Authorization: `Basic ${btoa(`${shopId}:${secretKey}`)}`,
      },
      body: JSON.stringify(yukassaPayload),
    })

    if (!yukassaResponse.ok) {
      const errorText = await yukassaResponse.text()
      console.error("YooKassa API error:", yukassaResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: "Failed to create payment",
          code: "YUKASSA_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const yukassaPayment = await yukassaResponse.json()

    // Validate YooKassa response has required fields
    if (!yukassaPayment.id || !yukassaPayment.confirmation?.confirmation_token) {
      console.error("Invalid YooKassa response:", yukassaPayment)
      return new Response(
        JSON.stringify({
          error: "Invalid payment gateway response",
          code: "YUKASSA_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const confirmationToken = yukassaPayment.confirmation.confirmation_token

    // Insert pending purchase into database
    const { error: dbError } = await supabaseAdmin
      .from("purchases")
      .insert({
        id: purchaseId,
        user_id: userId,
        product_type: product_type,
        amount_rub: tariff.price,
        yukassa_payment_id: yukassaPayment.id,
        status: "pending",
        credits_granted: tariff.credits,
        metadata: {
          credit_type: tariff.creditType,
          idempotence_key: purchaseId,
          return_url: return_url || null,
        },
      })

    if (dbError) {
      console.error("Database error:", dbError)
      // Payment was created in YooKassa but we couldn't store it
      // Log for manual reconciliation but still return success to user
      console.error("CRITICAL: Payment created in YooKassa but failed to store in DB", {
        yukassa_payment_id: yukassaPayment.id,
        purchase_id: purchaseId,
        user_id: userId,
      })
    }

    // Track analytics event
    try {
      await supabaseAdmin.from("payment_analytics").insert({
        event: "payment_started",
        user_id: userId,
        product_type: product_type,
        amount_rub: tariff.price,
        metadata: {
          yukassa_payment_id: yukassaPayment.id,
          purchase_id: purchaseId,
        },
      })
    } catch (analyticsError) {
      // Don't fail the request if analytics fails
      console.error("Analytics error:", analyticsError)
    }

    console.log("Payment created successfully:", {
      purchaseId,
      yukassa_payment_id: yukassaPayment.id,
      product_type,
    })

    // Return confirmation token for widget initialization
    return new Response(
      JSON.stringify({
        confirmation_token: confirmationToken,
        purchase_id: purchaseId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error("Unexpected error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})
