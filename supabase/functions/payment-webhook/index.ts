// supabase/functions/payment-webhook/index.ts
// YooKassa webhook handler with API-based payment verification
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2"

// CORS headers (inlined to avoid shared module issues in deployment)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types
type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra'
type CreditType = 'basic' | 'pro' | 'cassandra'

interface YooKassaPayment {
  id: string
  status: string
  amount: { value: string; currency: string }
  metadata: {
    user_id: string
    product_type: ProductType
    purchase_id: string
  }
  cancellation_details?: {
    party: string
    reason: string
  }
}

interface YooKassaWebhookPayload {
  type: 'notification'
  event: 'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture'
  object: YooKassaPayment
}

interface Tariff {
  price: number
  credits: number
  creditType: CreditType
  name: string
}

// Tariff definitions matching create-payment/index.ts
const TARIFFS: Record<ProductType, Tariff> = {
  basic: { price: 100, credits: 1, creditType: 'basic', name: 'Новичок' },
  pack5: { price: 300, credits: 5, creditType: 'basic', name: 'Любитель' },
  pro: { price: 500, credits: 1, creditType: 'pro', name: 'Внутренний мудрец' },
  cassandra: { price: 1000, credits: 1, creditType: 'cassandra', name: 'Кассандра' },
}

// Verify payment by calling YooKassa API
// This is the recommended approach per YooKassa docs (no HMAC signature)
async function verifyPaymentWithApi(
  paymentId: string,
  shopId: string,
  secretKey: string
): Promise<YooKassaPayment | null> {
  try {
    const credentials = btoa(`${shopId}:${secretKey}`)

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('YooKassa API error:', response.status, await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('YooKassa API verification error:', error)
    return null
  }
}

// Get tariff details for a product type
function getTariffDetails(productType: ProductType): Tariff {
  return TARIFFS[productType] || TARIFFS.basic
}

// Handle successful payment
async function handlePaymentSucceeded(
  payment: YooKassaPayment,
  supabase: SupabaseClient
): Promise<void> {
  const { metadata, id: yukassaPaymentId } = payment
  const { user_id, product_type, purchase_id } = metadata

  const tariff = getTariffDetails(product_type)

  // Check if purchase already processed (idempotency)
  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('id', purchase_id)
    .single()

  if (existingPurchase?.status === 'succeeded') {
    console.log('Payment already processed, skipping:', { purchase_id, yukassaPaymentId })
    return
  }

  // Update purchase status
  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      status: 'succeeded',
      yukassa_payment_id: yukassaPaymentId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', purchase_id)

  if (updateError) {
    console.error('Error updating purchase:', updateError)
    throw updateError
  }

  // Grant credits using RPC function
  const { error: grantError } = await supabase.rpc('grant_credits', {
    p_user_id: user_id,
    p_product_type: product_type,
    p_credits: tariff.credits
  })

  if (grantError) {
    console.error('Error granting credits:', grantError)
    // Don't throw - we've already updated purchase status
    // Log for manual intervention
    console.error('CRITICAL: Failed to grant credits after purchase update', {
      purchase_id,
      user_id,
      product_type,
      credits: tariff.credits,
      error: grantError
    })
  }

  // Track analytics event
  try {
    await supabase.from('payment_analytics').insert({
      event: 'payment_succeeded',
      user_id,
      product_type,
      amount_rub: tariff.price,
      metadata: { yukassa_payment_id: yukassaPaymentId, purchase_id }
    })
  } catch (analyticsError) {
    console.error('Analytics error (non-critical):', analyticsError)
  }

  // Send email confirmation (optional, non-blocking)
  try {
    await sendEmailConfirmation(user_id, product_type, supabase)
  } catch (emailError) {
    console.error('Email error (non-critical):', emailError)
  }

  console.log('Payment succeeded:', {
    purchase_id,
    user_id,
    product_type,
    credits: tariff.credits,
    yukassa_payment_id: yukassaPaymentId
  })
}

// Handle canceled payment
async function handlePaymentCanceled(
  payment: YooKassaPayment,
  supabase: SupabaseClient
): Promise<void> {
  const { metadata, id: yukassaPaymentId, cancellation_details } = payment
  const { user_id, product_type, purchase_id } = metadata

  const tariff = getTariffDetails(product_type)
  const cancellationReason = cancellation_details?.reason || null
  const cancellationParty = cancellation_details?.party || null

  // Check if already processed
  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('id', purchase_id)
    .single()

  if (existingPurchase?.status === 'canceled') {
    console.log('Payment cancellation already processed, skipping:', { purchase_id })
    return
  }

  // Update purchase status with cancellation details
  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      status: 'canceled',
      yukassa_payment_id: yukassaPaymentId,
      cancellation_reason: cancellationReason,
      cancellation_party: cancellationParty,
    })
    .eq('id', purchase_id)

  if (updateError) {
    console.error('Error updating purchase:', updateError)
    throw updateError
  }

  // Track analytics event
  try {
    await supabase.from('payment_analytics').insert({
      event: 'payment_canceled',
      user_id,
      product_type,
      amount_rub: tariff.price,
      metadata: { yukassa_payment_id: yukassaPaymentId, purchase_id, cancellation_reason: cancellationReason, cancellation_party: cancellationParty }
    })
  } catch (analyticsError) {
    console.error('Analytics error (non-critical):', analyticsError)
  }

  console.log('Payment canceled:', { purchase_id, yukassa_payment_id: yukassaPaymentId, cancellation_reason: cancellationReason, cancellation_party: cancellationParty })
}

// Send email confirmation via Resend API
async function sendEmailConfirmation(
  userId: string,
  productType: ProductType,
  supabase: SupabaseClient
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured, skipping email')
    return
  }

  // Get user email from Supabase Auth
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)

  if (userError || !user?.email) {
    console.log('Could not get user email:', userError)
    return
  }

  const tariff = getTariffDetails(productType)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Symancy <noreply@symancy.ru>',
      to: user.email,
      subject: 'Оплата прошла успешно - Symancy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Спасибо за покупку!</h1>
          <p>Вы успешно приобрели тариф "<strong>${tariff.name}</strong>".</p>
          <p>На ваш счёт добавлено <strong>${tariff.credits}</strong> ${tariff.credits === 1 ? 'кредит' : 'кредитов'}.</p>
          <p style="margin-top: 20px;">
            <a href="https://symancy.ru" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Перейти к анализу
            </a>
          </p>
          <p style="color: #666; margin-top: 30px; font-size: 12px;">
            Если у вас есть вопросы, напишите нам: support@symancy.ru
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Resend API error:', response.status, errorText)
    throw new Error(`Email sending failed: ${response.status}`)
  }

  console.log('Email confirmation sent to:', user.email)
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight (for testing, production webhooks don't send OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get raw body
    const body = await req.text()

    // Get YooKassa credentials for API verification
    const shopId = Deno.env.get('YUKASSA_SHOP_ID')
    const secretKey = Deno.env.get('YUKASSA_SECRET_KEY')

    if (!shopId || !secretKey) {
      console.error('YooKassa credentials not configured')
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse webhook payload
    let payload: YooKassaWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch {
      console.error('Invalid JSON in webhook body')
      return new Response(
        JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event, object: payment } = payload

    console.log('Webhook received:', {
      event,
      payment_id: payment?.id,
      status: payment?.status,
      user_id: payment?.metadata?.user_id,
      purchase_id: payment?.metadata?.purchase_id
    })

    // Validate required metadata
    if (!payment?.metadata?.user_id || !payment?.metadata?.purchase_id) {
      console.error('Missing required metadata in webhook payload', payment?.metadata)
      // Return 200 to prevent retries for malformed payloads
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify payment exists and status matches via YooKassa API
    // This is the recommended verification method per YooKassa docs
    const verifiedPayment = await verifyPaymentWithApi(payment.id, shopId, secretKey)

    if (!verifiedPayment) {
      console.error('Could not verify payment with YooKassa API:', payment.id)
      return new Response(
        JSON.stringify({ error: 'Payment verification failed', code: 'VERIFICATION_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (verifiedPayment.status !== payment.status) {
      console.error('Payment status mismatch:', {
        webhook_status: payment.status,
        api_status: verifiedPayment.status
      })
      return new Response(
        JSON.stringify({ error: 'Status mismatch', code: 'STATUS_MISMATCH' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    )

    // Handle event - use verifiedPayment for both to ensure data consistency from API
    if (event === 'payment.succeeded') {
      await handlePaymentSucceeded(verifiedPayment, supabase)
    } else if (event === 'payment.canceled') {
      await handlePaymentCanceled(verifiedPayment, supabase)
    } else {
      console.log('Unhandled event type:', event)
    }

    // Always return 200 OK to acknowledge receipt
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)

    // Return 200 to prevent YooKassa retry storms for unrecoverable errors
    // Errors are logged for investigation
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
