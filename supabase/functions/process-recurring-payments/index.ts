// supabase/functions/process-recurring-payments/index.ts
// Cron function: processes recurring subscription payments, retries failed payments, expires dead subscriptions
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

import {
  RECEIPT_TAX_SYSTEM_CODE,
  RECEIPT_VAT_CODE,
  TIER_NAMES,
  calculatePrice,
} from "../_shared/subscription-config.ts"

Deno.serve(async (req: Request) => {
  try {
    // Only allow POST method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verify this is called with correct cron secret
    const cronKey = req.headers.get("x-cron-key")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const cronSecret = Deno.env.get("CRON_SECRET")

    if (!cronSecret || cronKey !== cronSecret) {
      console.error("Unauthorized cron call")
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Get YooKassa credentials
    const shopId = Deno.env.get("YUKASSA_SHOP_ID")
    const secretKey = Deno.env.get("YUKASSA_SECRET_KEY")

    if (!shopId || !secretKey) {
      console.error("YooKassa credentials not configured")
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const summary = { processed: 0, retried: 0, expired: 0, stale_pending: 0, errors: 0 }
    const now = new Date().toISOString()

    // ============================================================
    // STEP 0: Expire stale pending subscriptions (no payment within 2 hours)
    // ============================================================
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: stalePending, error: stalePendingError } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', expires_at: now })
      .eq('status', 'pending')
      .lt('created_at', twoHoursAgo)
      .select('id')

    if (stalePendingError) {
      console.error("Error expiring stale pending subscriptions:", stalePendingError)
    } else if (stalePending?.length) {
      summary.stale_pending = stalePending.length
      console.log("Expired stale pending subscriptions:", stalePending.map(s => s.id))

      // Cancel orphaned pending subscription_payments for expired stale subscriptions
      const staleSubIds = stalePending.map(s => s.id)
      const { error: orphanError } = await supabase
        .from('subscription_payments')
        .update({ status: 'canceled', failure_reason: 'Subscription expired (stale pending)' })
        .in('subscription_id', staleSubIds)
        .eq('status', 'pending')

      if (orphanError) {
        console.error("Error canceling orphaned payments for stale subs:", orphanError)
      }
    }

    // ============================================================
    // STEP 1: Process active subscriptions due for renewal
    // ============================================================
    const { data: dueSubscriptions, error: dueError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tier, billing_period_months, yukassa_payment_method_id, current_period_end')
      .eq('status', 'active')
      .not('yukassa_payment_method_id', 'is', null)
      .lte('next_billing_date', now)

    if (dueError) {
      console.error("Error fetching due subscriptions:", dueError)
    }

    for (const sub of dueSubscriptions || []) {
      try {
        await processRenewalPayment(sub, supabase, shopId, secretKey, false)
        summary.processed++
      } catch (error) {
        console.error("Error processing renewal for subscription:", sub.id, error)
        summary.errors++
      }
    }

    // ============================================================
    // STEP 2: Retry past_due subscriptions within grace period
    // ============================================================
    const { data: pastDueSubscriptions, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tier, billing_period_months, yukassa_payment_method_id, current_period_end, retry_count')
      .eq('status', 'past_due')
      .not('yukassa_payment_method_id', 'is', null)
      .lt('retry_count', 3)
      .gt('grace_period_end', now)

    if (pastDueError) {
      console.error("Error fetching past_due subscriptions:", pastDueError)
    }

    const retriedIds: Set<string> = new Set()
    for (const sub of pastDueSubscriptions || []) {
      try {
        // retry_count is incremented by the webhook handler on payment failure
        // so we don't increment here to avoid double-counting
        await processRenewalPayment(sub, supabase, shopId, secretKey, true)
        retriedIds.add(sub.id)
        summary.retried++
      } catch (error) {
        console.error("Error retrying payment for subscription:", sub.id, error)
        summary.errors++
      }
    }

    // ============================================================
    // STEP 3: Expire subscriptions that exhausted retries or grace period
    // ============================================================
    const { data: expiredSubscriptions, error: expiredError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tier, retry_count, grace_period_end')
      .eq('status', 'past_due')

    if (expiredError) {
      console.error("Error fetching expired subscriptions:", expiredError)
    }

    for (const sub of expiredSubscriptions || []) {
      // Skip subscriptions that were just retried in Step 2
      if (retriedIds.has(sub.id)) continue

      const shouldExpire = sub.retry_count >= 3 || (sub.grace_period_end && new Date(sub.grace_period_end) <= new Date())

      if (shouldExpire) {
        try {
          const { error: expireError } = await supabase
            .from('subscriptions')
            .update({ status: 'expired', expires_at: now })
            .eq('id', sub.id)

          if (expireError) {
            console.error("Error expiring subscription:", sub.id, expireError)
            summary.errors++
            continue
          }

          // Track analytics
          try {
            await supabase.from("payment_analytics").insert({
              event: "subscription_expired",
              user_id: sub.user_id,
              product_type: sub.tier,
              amount_rub: 0,
              metadata: {
                subscription_id: sub.id,
                retry_count: sub.retry_count,
                grace_period_end: sub.grace_period_end,
              },
            })
          } catch (analyticsError) {
            console.error("Analytics error (non-critical):", analyticsError)
          }

          summary.expired++
          console.log("Subscription expired:", sub.id)
        } catch (error) {
          console.error("Error expiring subscription:", sub.id, error)
          summary.errors++
        }
      }
    }

    // ============================================================
    // STEP 4: Expire canceled subscriptions past their expires_at
    // ============================================================
    const { data: expiredCanceled, error: canceledError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tier')
      .eq('status', 'canceled')
      .not('expires_at', 'is', null)
      .lte('expires_at', now)

    if (canceledError) {
      console.error("Error fetching expired canceled subscriptions:", canceledError)
    }

    for (const sub of expiredCanceled || []) {
      try {
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', sub.id)
        summary.expired++
        console.log("Canceled subscription expired:", sub.id)
      } catch (error) {
        console.error("Error expiring canceled subscription:", sub.id, error)
        summary.errors++
      }
    }

    console.log("Recurring payments processing complete:", summary)

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Unexpected error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

// Process a single renewal payment via YooKassa autopayment API
async function processRenewalPayment(
  sub: {
    id: string
    user_id: string
    tier: string
    billing_period_months: number
    yukassa_payment_method_id: string
    current_period_end: string | null
  },
  supabase: ReturnType<typeof createClient>,
  shopId: string,
  secretKey: string,
  isRetry: boolean
): Promise<void> {
  const amountRub = calculatePrice(sub.tier, sub.billing_period_months).total

  // Calculate new period dates
  const periodStart = sub.current_period_end
    ? new Date(sub.current_period_end)
    : new Date()
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + sub.billing_period_months)

  // Create subscription_payments record
  const { data: subPayment, error: paymentRecordError } = await supabase
    .from('subscription_payments')
    .insert({
      subscription_id: sub.id,
      user_id: sub.user_id,
      amount_rub: amountRub,
      status: 'pending',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      is_initial: false,
      payment_type: 'subscription_renewal',
    })
    .select('id')
    .single()

  if (paymentRecordError || !subPayment) {
    console.error("Error creating subscription payment record:", paymentRecordError)
    throw new Error("Failed to create payment record")
  }

  const tierName = TIER_NAMES[sub.tier]
  const periodLabel = sub.billing_period_months === 1 ? '1 мес.' : `${sub.billing_period_months} мес.`
  const description = `Symancy - Подписка "${tierName}" (${periodLabel})${isRetry ? ' [повтор]' : ''}`
  const idempotenceKey = crypto.randomUUID()

  // Fetch user email for fiscal receipt (54-FZ compliance) BEFORE building payload
  let customerEmail: string | null = null
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id)
    if (user?.email) {
      customerEmail = user.email
    }
  } catch (emailError) {
    console.error("Could not fetch user email for receipt (non-critical):", emailError)
  }

  if (!customerEmail) {
    console.error("54-FZ VIOLATION: no customer email for receipt, subscription:", sub.id, "user:", sub.user_id)
    // 54-FZ requires customer contact (email or phone) on fiscal receipts.
    // Cancel the orphaned pending payment record before throwing.
    await supabase
      .from('subscription_payments')
      .update({ status: 'canceled', failure_reason: '54-FZ: no customer email' })
      .eq('id', subPayment.id)
    throw new Error(`54-FZ: no customer email for subscription ${sub.id}`)
  }

  const receiptCustomer = { email: customerEmail }

  // Create YooKassa autopayment (no confirmation needed - uses saved payment method)
  const yukassaPayload = {
    amount: {
      value: amountRub.toFixed(2),
      currency: "RUB",
    },
    capture: true,
    payment_method_id: sub.yukassa_payment_method_id,
    description,
    receipt: {
      customer: receiptCustomer,
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
      user_id: sub.user_id,
      subscription_id: sub.id,
      subscription_payment_id: subPayment.id,
      payment_type: "subscription_renewal",
      tier: sub.tier,
      billing_period_months: sub.billing_period_months,
      is_retry: isRetry,
    },
  }

  console.log("Creating YooKassa renewal payment:", {
    subscriptionId: sub.id,
    subscriptionPaymentId: subPayment.id,
    amount: amountRub,
    isRetry,
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
    console.error("YooKassa API error for renewal:", yukassaResponse.status, errorText)

    // Update payment record as canceled with failure reason
    await supabase
      .from('subscription_payments')
      .update({
        status: 'canceled',
        failure_reason: `YooKassa API error: ${yukassaResponse.status}`,
      })
      .eq('id', subPayment.id)

    throw new Error(`YooKassa API error: ${yukassaResponse.status}`)
  }

  const yukassaPayment = await yukassaResponse.json()

  // Update subscription_payments with yukassa_payment_id
  await supabase
    .from('subscription_payments')
    .update({ yukassa_payment_id: yukassaPayment.id })
    .eq('id', subPayment.id)

  console.log("Renewal payment created:", {
    subscriptionId: sub.id,
    yukassa_payment_id: yukassaPayment.id,
    status: yukassaPayment.status,
  })
}
