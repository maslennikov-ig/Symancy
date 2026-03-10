// supabase/functions/payment-webhook/index.ts
// YooKassa webhook handler with API-based payment verification
// Handles both one-time payments and subscription payments
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2"
import { webhookCorsHeaders } from "../_shared/cors.ts"

// Types
type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra'
type CreditType = 'basic' | 'pro' | 'cassandra'

interface YooKassaPaymentMethod {
  type: string
  id: string
  saved: boolean
  card?: { first6: string; last4: string; expiry_month: string; expiry_year: string; card_type: string }
  title?: string
}

interface YooKassaPayment {
  id: string
  status: string
  amount: { value: string; currency: string }
  metadata: {
    user_id: string
    product_type?: ProductType
    purchase_id?: string
    // Subscription-specific metadata
    payment_type?: 'subscription_initial' | 'subscription_renewal'
    subscription_id?: string
    subscription_payment_id?: string
    tier?: string
    billing_period_months?: number
    is_retry?: boolean
  }
  payment_method?: YooKassaPaymentMethod
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

// ============================================================
// ONE-TIME PAYMENT HANDLERS (existing logic, unchanged)
// ============================================================

// Handle successful payment
async function handlePaymentSucceeded(
  payment: YooKassaPayment,
  supabase: SupabaseClient
): Promise<void> {
  const { metadata, id: yukassaPaymentId } = payment
  const { user_id, product_type, purchase_id } = metadata

  const tariff = getTariffDetails(product_type!)

  // Check if purchase already processed (idempotency)
  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('id', purchase_id!)
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
    .eq('id', purchase_id!)

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
    await sendEmailConfirmation(user_id, product_type!, supabase)
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

  const tariff = getTariffDetails(product_type!)
  const cancellationReason = cancellation_details?.reason || null
  const cancellationParty = cancellation_details?.party || null

  // Check if already processed
  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('id', purchase_id!)
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
    .eq('id', purchase_id!)

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

// ============================================================
// SUBSCRIPTION PAYMENT HANDLERS (new logic)
// ============================================================

// Handle successful subscription payment (initial or renewal)
async function handleSubscriptionPaymentSucceeded(
  payment: YooKassaPayment,
  supabase: SupabaseClient
): Promise<void> {
  const { metadata, id: yukassaPaymentId, payment_method } = payment
  const {
    user_id,
    subscription_id,
    subscription_payment_id,
    payment_type,
    tier,
    billing_period_months,
  } = metadata

  if (!subscription_id || !subscription_payment_id || !tier) {
    console.error('Missing subscription metadata:', metadata)
    throw new Error('Missing required subscription metadata')
  }

  const isInitial = payment_type === 'subscription_initial'

  // Idempotency: check if subscription payment already processed
  const { data: existingSubPayment } = await supabase
    .from('subscription_payments')
    .select('id, status')
    .eq('id', subscription_payment_id)
    .single()

  if (existingSubPayment?.status === 'succeeded') {
    console.log('Subscription payment already processed, skipping:', { subscription_payment_id, yukassaPaymentId })
    return
  }

  // Update subscription_payments status
  const { error: updatePaymentError } = await supabase
    .from('subscription_payments')
    .update({
      status: 'succeeded',
      yukassa_payment_id: yukassaPaymentId,
    })
    .eq('id', subscription_payment_id)

  if (updatePaymentError) {
    console.error('Error updating subscription payment:', updatePaymentError)
    throw updatePaymentError
  }

  // Calculate period dates
  const now = new Date()
  const periodMonths = billing_period_months || 1
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + periodMonths)

  const nextBillingDate = new Date(periodEnd)

  // Build subscription update
  const subscriptionUpdate: Record<string, unknown> = {
    status: 'active',
    started_at: isInitial ? now.toISOString() : undefined,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_date: nextBillingDate.toISOString(),
    retry_count: 0,
    grace_period_end: null,
  }

  // Save payment method ID on initial payment (for recurring billing)
  if (isInitial && payment_method?.saved && payment_method.id) {
    subscriptionUpdate.yukassa_payment_method_id = payment_method.id
    console.log('Saved payment method:', {
      payment_method_id: payment_method.id,
      card_last4: payment_method.card?.last4,
    })
  }

  // Remove undefined values
  Object.keys(subscriptionUpdate).forEach(key => {
    if (subscriptionUpdate[key] === undefined) {
      delete subscriptionUpdate[key]
    }
  })

  const { error: updateSubError } = await supabase
    .from('subscriptions')
    .update(subscriptionUpdate)
    .eq('id', subscription_id)

  if (updateSubError) {
    console.error('Error updating subscription:', updateSubError)
    throw updateSubError
  }

  // Grant subscription credits via RPC
  const { data: creditsResult, error: grantError } = await supabase.rpc('grant_subscription_credits', {
    p_subscription_id: subscription_id,
    p_user_id: user_id,
    p_tier: tier,
  })

  if (grantError) {
    console.error('Error granting subscription credits:', grantError)
    console.error('CRITICAL: Failed to grant subscription credits', {
      subscription_id,
      subscription_payment_id,
      user_id,
      tier,
      error: grantError,
    })
  } else {
    console.log('Subscription credits granted:', creditsResult)
  }

  // Track analytics
  const analyticsEvent = isInitial ? 'subscription_activated' : 'subscription_renewed'
  try {
    await supabase.from('payment_analytics').insert({
      event: analyticsEvent,
      user_id,
      product_type: tier,
      amount_rub: parseInt(payment.amount.value),
      metadata: {
        yukassa_payment_id: yukassaPaymentId,
        subscription_id,
        subscription_payment_id,
        billing_period_months: periodMonths,
        payment_method_saved: payment_method?.saved || false,
      },
    })
  } catch (analyticsError) {
    console.error('Analytics error (non-critical):', analyticsError)
  }

  console.log(`Subscription ${analyticsEvent}:`, {
    subscription_id,
    subscription_payment_id,
    user_id,
    tier,
    yukassa_payment_id: yukassaPaymentId,
    period_end: periodEnd.toISOString(),
  })
}

// Handle failed/canceled subscription payment
async function handleSubscriptionPaymentCanceled(
  payment: YooKassaPayment,
  supabase: SupabaseClient
): Promise<void> {
  const { metadata, id: yukassaPaymentId, cancellation_details } = payment
  const {
    user_id,
    subscription_id,
    subscription_payment_id,
    payment_type,
    tier,
  } = metadata

  if (!subscription_id || !subscription_payment_id) {
    console.error('Missing subscription metadata in canceled payment:', metadata)
    throw new Error('Missing required subscription metadata')
  }

  const isInitial = payment_type === 'subscription_initial'
  const failureReason = cancellation_details
    ? `${cancellation_details.party}: ${cancellation_details.reason}`
    : 'Payment canceled'

  // Idempotency: check if already processed
  const { data: existingSubPayment } = await supabase
    .from('subscription_payments')
    .select('id, status')
    .eq('id', subscription_payment_id)
    .single()

  if (existingSubPayment?.status === 'canceled') {
    console.log('Subscription payment cancellation already processed, skipping:', { subscription_payment_id })
    return
  }

  // Update subscription_payments
  const { error: updatePaymentError } = await supabase
    .from('subscription_payments')
    .update({
      status: 'canceled',
      yukassa_payment_id: yukassaPaymentId,
      failure_reason: failureReason,
      cancellation_reason: cancellation_details?.reason || null,
    })
    .eq('id', subscription_payment_id)

  if (updatePaymentError) {
    console.error('Error updating subscription payment:', updatePaymentError)
    throw updatePaymentError
  }

  // Update subscription status based on payment type
  if (isInitial) {
    // Initial payment failed: subscription never activated
    const { error: updateSubError } = await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('id', subscription_id)

    if (updateSubError) {
      console.error('Error expiring subscription after initial failure:', updateSubError)
    }
  } else {
    // Renewal payment failed: enter grace period
    const gracePeriodEnd = new Date()
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3) // 3 days grace period

    // Get current retry_count to increment
    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('retry_count')
      .eq('id', subscription_id)
      .single()

    const newRetryCount = (currentSub?.retry_count || 0) + 1

    const { error: updateSubError } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        grace_period_end: gracePeriodEnd.toISOString(),
        retry_count: newRetryCount,
      })
      .eq('id', subscription_id)

    if (updateSubError) {
      console.error('Error setting subscription to past_due:', updateSubError)
    }
  }

  // Track analytics
  try {
    await supabase.from('payment_analytics').insert({
      event: isInitial ? 'subscription_initial_failed' : 'subscription_renewal_failed',
      user_id,
      product_type: tier || null,
      amount_rub: parseInt(payment.amount.value),
      metadata: {
        yukassa_payment_id: yukassaPaymentId,
        subscription_id,
        subscription_payment_id,
        payment_type,
        failure_reason: failureReason,
        is_initial: isInitial,
      },
    })
  } catch (analyticsError) {
    console.error('Analytics error (non-critical):', analyticsError)
  }

  console.log(`Subscription payment ${isInitial ? 'initial' : 'renewal'} failed:`, {
    subscription_id,
    subscription_payment_id,
    user_id,
    yukassa_payment_id: yukassaPaymentId,
    failure_reason: failureReason,
  })
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

// ============================================================
// ROUTING HELPER
// ============================================================

// Determine if this is a subscription payment based on metadata
function isSubscriptionPayment(metadata: YooKassaPayment['metadata']): boolean {
  return metadata.payment_type === 'subscription_initial' || metadata.payment_type === 'subscription_renewal'
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight (for testing, production webhooks don't send OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: webhookCorsHeaders })
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...webhookCorsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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
        { status: 400, headers: { ...webhookCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event, object: payment } = payload

    console.log('Webhook received:', {
      event,
      payment_id: payment?.id,
      status: payment?.status,
      user_id: payment?.metadata?.user_id,
      purchase_id: payment?.metadata?.purchase_id,
      payment_type: payment?.metadata?.payment_type,
      subscription_id: payment?.metadata?.subscription_id,
    })

    // Validate required metadata (user_id is always required)
    if (!payment?.metadata?.user_id) {
      console.error('Missing required user_id in webhook payload', payment?.metadata)
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // For one-time payments, purchase_id is required
    // For subscription payments, subscription_id and subscription_payment_id are required
    const isSub = isSubscriptionPayment(payment.metadata)
    if (!isSub && !payment.metadata.purchase_id) {
      console.error('Missing purchase_id for one-time payment', payment?.metadata)
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (isSub && (!payment.metadata.subscription_id || !payment.metadata.subscription_payment_id)) {
      console.error('Missing subscription metadata', payment?.metadata)
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
        { status: 400, headers: { ...webhookCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (verifiedPayment.status !== payment.status) {
      console.error('Payment status mismatch:', {
        webhook_status: payment.status,
        api_status: verifiedPayment.status
      })
      return new Response(
        JSON.stringify({ error: 'Status mismatch', code: 'STATUS_MISMATCH' }),
        { status: 400, headers: { ...webhookCorsHeaders, 'Content-Type': 'application/json' } }
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

    // Route to appropriate handler based on payment_type
    if (isSub) {
      // ---- SUBSCRIPTION PAYMENT ----
      if (event === 'payment.succeeded') {
        await handleSubscriptionPaymentSucceeded(verifiedPayment, supabase)
      } else if (event === 'payment.canceled') {
        await handleSubscriptionPaymentCanceled(verifiedPayment, supabase)
      } else {
        console.log('Unhandled subscription event type:', event)
      }
    } else {
      // ---- ONE-TIME PAYMENT (existing logic) ----
      if (event === 'payment.succeeded') {
        await handlePaymentSucceeded(verifiedPayment, supabase)
      } else if (event === 'payment.canceled') {
        await handlePaymentCanceled(verifiedPayment, supabase)
      } else {
        console.log('Unhandled event type:', event)
      }
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
