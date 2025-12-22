// supabase/functions/telegram-bot-webhook/index.ts
// Telegram bot webhook for YooKassa native payments
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2"

// Types (inlined to avoid shared module deployment issues)
type ProductType = 'basic' | 'pack5' | 'pro' | 'cassandra'
type CreditType = 'basic' | 'pro' | 'cassandra'

interface Tariff {
  price: number
  credits: number
  creditType: CreditType
  name: string
}

interface TelegramInvoicePayload {
  user_id: string
  product_type: ProductType
  telegram_user_id: number
  chat_id: number
}

interface PreCheckoutQuery {
  id: string
  from: { id: number; first_name: string; last_name?: string; username?: string }
  currency: string
  total_amount: number
  invoice_payload: string
}

interface SuccessfulPayment {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
  provider_payment_charge_id: string
}

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; first_name: string; last_name?: string; username?: string }
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' }
    date: number
    text?: string
    successful_payment?: SuccessfulPayment
  }
  pre_checkout_query?: PreCheckoutQuery
}

// Tariff definitions (matching payment-webhook/index.ts)
const TARIFFS: Record<ProductType, Tariff> = {
  basic: { price: 100, credits: 1, creditType: 'basic', name: 'Новичок' },
  pack5: { price: 300, credits: 5, creditType: 'basic', name: 'Любитель' },
  pro: { price: 500, credits: 1, creditType: 'pro', name: 'Внутренний мудрец' },
  cassandra: { price: 1000, credits: 1, creditType: 'cassandra', name: 'Кассандра' },
}

// Get tariff details for a product type
function getTariffDetails(productType: ProductType): Tariff {
  return TARIFFS[productType] || TARIFFS.basic
}

// Telegram API helper
async function sendTelegramRequest(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`

  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

// Handle /buy command - Send invoice to user
async function handleBuyCommand(
  update: TelegramUpdate,
  supabase: SupabaseClient,
  botToken: string,
  providerToken: string
): Promise<void> {
  if (!update.message?.text || !update.message.from) {
    console.log('Invalid buy command message')
    return
  }

  const chatId = update.message.chat.id
  const telegramUserId = update.message.from.id
  const text = update.message.text.trim()

  // Parse product type from command: /buy or /buy basic
  const parts = text.split(/\s+/)
  const productTypeArg = parts[1]?.toLowerCase()
  let productType: ProductType = 'basic'

  // Validate product type if provided
  if (productTypeArg && productTypeArg in TARIFFS) {
    productType = productTypeArg as ProductType
  } else if (productTypeArg) {
    await sendTelegramRequest(botToken, 'sendMessage', {
      chat_id: chatId,
      text: `Неизвестный тип тарифа: ${productTypeArg}\n\nДоступные тарифы:\n- basic (100 ₽)\n- pack5 (300 ₽)\n- pro (500 ₽)\n- cassandra (1000 ₽)`
    })
    return
  }

  const tariff = getTariffDetails(productType)

  // Get or create Supabase user for this Telegram user
  const userId = await getOrCreateUser(telegramUserId, update.message.from, supabase)

  if (!userId) {
    await sendTelegramRequest(botToken, 'sendMessage', {
      chat_id: chatId,
      text: 'Произошла ошибка при создании пользователя. Попробуйте позже.'
    })
    return
  }

  // Create invoice payload
  const payload: TelegramInvoicePayload = {
    user_id: userId,
    product_type: productType,
    telegram_user_id: telegramUserId,
    chat_id: chatId
  }

  // Send invoice
  const response = await sendTelegramRequest(botToken, 'sendInvoice', {
    chat_id: chatId,
    title: tariff.name,
    description: `${tariff.credits} кредит${tariff.credits === 1 ? '' : 'ов'} для анализа кофейной гущи`,
    payload: JSON.stringify(payload),
    provider_token: providerToken,
    currency: 'RUB',
    prices: [{ label: tariff.name, amount: tariff.price * 100 }] // Convert to kopecks
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Failed to send invoice:', response.status, errorText)

    await sendTelegramRequest(botToken, 'sendMessage', {
      chat_id: chatId,
      text: 'Не удалось создать счёт для оплаты. Попробуйте позже.'
    })
  } else {
    console.log('Invoice sent:', { chatId, userId, productType, amount: tariff.price })
  }
}

// Handle pre_checkout_query - Validate and confirm
async function handlePreCheckoutQuery(
  query: PreCheckoutQuery,
  botToken: string
): Promise<void> {
  console.log('Pre-checkout query received:', {
    queryId: query.id,
    totalAmount: query.total_amount,
    currency: query.currency
  })

  try {
    // Parse payload
    const payload: TelegramInvoicePayload = JSON.parse(query.invoice_payload)
    const productType = payload.product_type

    // Validate product type
    if (!TARIFFS[productType]) {
      console.error('Invalid product type in payload:', productType)
      await sendTelegramRequest(botToken, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'Неверный тип товара'
      })
      return
    }

    const tariff = getTariffDetails(productType)
    const expectedAmount = tariff.price * 100 // kopecks

    // Validate amount matches tariff
    if (query.total_amount !== expectedAmount) {
      console.error('Amount mismatch:', {
        expected: expectedAmount,
        received: query.total_amount
      })
      await sendTelegramRequest(botToken, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'Неверная сумма оплаты'
      })
      return
    }

    // Validate currency
    if (query.currency !== 'RUB') {
      console.error('Invalid currency:', query.currency)
      await sendTelegramRequest(botToken, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'Неверная валюта'
      })
      return
    }

    // All validations passed - confirm payment
    await sendTelegramRequest(botToken, 'answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok: true
    })

    console.log('Pre-checkout query approved:', { queryId: query.id, productType })

  } catch (error) {
    console.error('Error handling pre-checkout query:', error)

    await sendTelegramRequest(botToken, 'answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: 'Ошибка обработки платежа'
    })
  }
}

// Handle successful_payment - Grant credits
async function handleSuccessfulPayment(
  update: TelegramUpdate,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  if (!update.message?.successful_payment) {
    console.log('No successful_payment in message')
    return
  }

  const payment = update.message.successful_payment
  const chatId = update.message.chat.id
  const telegramUserId = update.message.from.id

  console.log('Successful payment received:', {
    chatId,
    telegramUserId,
    totalAmount: payment.total_amount,
    providerPaymentId: payment.provider_payment_charge_id
  })

  try {
    // Parse payload
    const payload: TelegramInvoicePayload = JSON.parse(payment.invoice_payload)
    const { user_id, product_type } = payload

    const tariff = getTariffDetails(product_type)

    // Check for duplicate payment (idempotency)
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('yukassa_payment_id', payment.provider_payment_charge_id)
      .single()

    if (existingPurchase) {
      console.log('Payment already processed:', payment.provider_payment_charge_id)

      await sendTelegramRequest(botToken, 'sendMessage', {
        chat_id: chatId,
        text: 'Этот платёж уже обработан.'
      })
      return
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: user_id,
        product_type: product_type,
        amount_rub: tariff.price,
        yukassa_payment_id: payment.provider_payment_charge_id,
        status: 'succeeded',
        credits_granted: tariff.credits,
        paid_at: new Date().toISOString(),
        metadata: {
          telegram_payment_charge_id: payment.telegram_payment_charge_id,
          telegram_user_id: telegramUserId,
          chat_id: chatId
        }
      })
      .select('id')
      .single()

    if (purchaseError) {
      console.error('Error creating purchase:', purchaseError)
      throw purchaseError
    }

    // Grant credits using RPC function
    const { error: grantError } = await supabase.rpc('grant_credits', {
      p_user_id: user_id,
      p_product_type: product_type,
      p_credits: tariff.credits
    })

    if (grantError) {
      console.error('Error granting credits:', grantError)
      // Log critical error but continue to send confirmation
      console.error('CRITICAL: Failed to grant credits', {
        purchase_id: purchase?.id,
        user_id,
        product_type,
        credits: tariff.credits
      })
    }

    // Track analytics event
    try {
      await supabase.from('payment_analytics').insert({
        event: 'payment_succeeded',
        user_id: user_id,
        product_type: product_type,
        amount_rub: tariff.price,
        metadata: {
          yukassa_payment_id: payment.provider_payment_charge_id,
          telegram_payment_charge_id: payment.telegram_payment_charge_id,
          purchase_id: purchase?.id
        }
      })
    } catch (analyticsError) {
      console.error('Analytics error (non-critical):', analyticsError)
    }

    // Send confirmation message to user
    await sendTelegramRequest(botToken, 'sendMessage', {
      chat_id: chatId,
      text: `✅ Оплата прошла успешно!\n\nНа ваш счёт добавлено ${tariff.credits} кредит${tariff.credits === 1 ? '' : 'ов'} (${tariff.name}).\n\nПерейдите на сайт для анализа: https://symancy.ru`
    })

    console.log('Payment processed successfully:', {
      purchase_id: purchase?.id,
      user_id,
      product_type,
      credits: tariff.credits
    })

  } catch (error) {
    console.error('Error handling successful payment:', error)

    await sendTelegramRequest(botToken, 'sendMessage', {
      chat_id: chatId,
      text: 'Произошла ошибка при обработке платежа. Обратитесь в поддержку: support@symancy.ru'
    })
  }
}

// Get or create Supabase user for Telegram user
async function getOrCreateUser(
  telegramUserId: number,
  telegramUser: { first_name: string; last_name?: string; username?: string },
  supabase: SupabaseClient
): Promise<string | null> {
  // Email pattern for Telegram users
  const email = `telegram_${telegramUserId}@telegram.user`

  try {
    const displayName = [
      telegramUser.first_name,
      telegramUser.last_name
    ].filter(Boolean).join(' ') || `User ${telegramUserId}`

    const password = crypto.randomUUID() // Random password (user won't use it)

    // Try to create auth user (will fail if already exists)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm since it's not a real email
      user_metadata: {
        telegram_user_id: telegramUserId,
        telegram_username: telegramUser.username,
        display_name: displayName,
        source: 'telegram_bot'
      }
    })

    if (authError) {
      // If user already exists, find them by email
      if (authError.message?.includes('already been registered') || authError.message?.includes('User already registered')) {
        const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()

        if (!listErr && users) {
          const existingUser = users.find(u => u.email === email)
          if (existingUser) {
            console.log('Found existing user by email:', existingUser.id)
            return existingUser.id
          }
        }

        console.error('User exists but could not find by email:', email)
        return null
      }

      console.error('Error creating auth user:', authError)
      return null
    }

    console.log('Created new user:', authData.user.id, 'for Telegram user:', telegramUserId)
    return authData.user.id

  } catch (error) {
    console.error('Error in getOrCreateUser:', error)
    return null
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get environment variables
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const providerToken = Deno.env.get('TELEGRAM_PAYMENT_PROVIDER_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Validate environment variables
    if (!botToken || !providerToken || !supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables:', {
        botToken: !!botToken,
        providerToken: !!providerToken,
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      })

      // Return 200 to prevent Telegram retries
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Parse update
    const update: TelegramUpdate = await req.json()

    console.log('Telegram update received:', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasPreCheckoutQuery: !!update.pre_checkout_query,
      messageText: update.message?.text,
      hasSuccessfulPayment: !!update.message?.successful_payment
    })

    // Route update to appropriate handler
    if (update.message?.text?.startsWith('/buy')) {
      await handleBuyCommand(update, supabase, botToken, providerToken)
    } else if (update.pre_checkout_query) {
      await handlePreCheckoutQuery(update.pre_checkout_query, botToken)
    } else if (update.message?.successful_payment) {
      await handleSuccessfulPayment(update, supabase, botToken)
    } else {
      console.log('Unhandled update type')
    }

    // Always return 200 OK to acknowledge receipt
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)

    // Return 200 to prevent Telegram retry storms
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
