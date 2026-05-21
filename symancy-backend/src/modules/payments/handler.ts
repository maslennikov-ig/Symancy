/**
 * Payment handlers for Telegram-native payments.
 *
 * Supports two methods:
 *  - YooKassa via Telegram Bot Payments (RUB) — needs TELEGRAM_PAYMENT_PROVIDER_TOKEN.
 *  - Telegram Stars (XTR) — `provider_token = ""`, no token required.
 *
 * Flow:
 *   /buy [tariff]  →  tariff picker  →  payment-method picker  →  invoice
 *   pre_checkout_query  →  validate currency / amount
 *   successful_payment  →  idempotent purchase row + credit grant
 */
import type { Context } from "grammy";
import { getEnv } from "../../config/env.js";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import { findOrCreateByTelegramId } from "../../services/user/UnifiedUserService.js";
import type { BotContext } from "../router/middleware.js";
import {
  STARS_PRICES,
  TARIFFS,
  isProductType,
  type InvoicePayload,
  type PaymentMethod,
  type ProductType,
} from "./constants.js";
import {
  createPaymentMethodKeyboard,
  createTariffPickerKeyboard,
  parsePaymentCallback,
} from "./keyboards.js";

const logger = getLogger().child({ module: "payments" });

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve the unified user id for the current Telegram user, creating one if
 * needed. Returns null if we cannot determine the user.
 */
async function resolveUnifiedUserId(
  ctx: BotContext
): Promise<{ unifiedUserId: string; authId: string | null } | null> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    return null;
  }

  const displayName =
    ctx.profile?.name ||
    ctx.from?.first_name ||
    ctx.from?.username ||
    `tg_${telegramId}`;

  try {
    const user = await findOrCreateByTelegramId({
      telegramId,
      displayName,
    });
    return {
      unifiedUserId: user.id,
      authId: user.auth_id ?? null,
    };
  } catch (error) {
    logger.error(
      { error, telegramId },
      "Failed to find or create unified user for payment"
    );
    return null;
  }
}

/**
 * Build the invoice payload string that Telegram will echo back to us in
 * `pre_checkout_query` and `successful_payment`.
 */
function buildInvoicePayload(
  unifiedUserId: string,
  product: ProductType,
  telegramUserId: number,
  chatId: number,
  method: PaymentMethod
): string {
  const payload: InvoicePayload = {
    user_id: unifiedUserId,
    product_type: product,
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    payment_method: method,
  };
  return JSON.stringify(payload);
}

/**
 * Safely parse an invoice payload echoed back from Telegram.
 */
function parseInvoicePayload(raw: string): InvoicePayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<InvoicePayload>;
    if (
      typeof parsed.user_id === "string" &&
      typeof parsed.product_type === "string" &&
      isProductType(parsed.product_type) &&
      typeof parsed.telegram_user_id === "number" &&
      typeof parsed.chat_id === "number" &&
      (parsed.payment_method === "yookassa" ||
        parsed.payment_method === "stars")
    ) {
      return {
        user_id: parsed.user_id,
        product_type: parsed.product_type,
        telegram_user_id: parsed.telegram_user_id,
        chat_id: parsed.chat_id,
        payment_method: parsed.payment_method,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// COMMAND HANDLER: /buy [tariff?]
// =============================================================================

/**
 * Handle `/buy` and `/buy <tariff>`.
 *
 *  - No argument         → send tariff picker keyboard.
 *  - Argument is tariff  → skip straight to payment-method picker.
 *  - Argument unknown    → fall back to tariff picker with a hint.
 */
export async function handleBuyCommand(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text ?? "";
  const parts = text.split(/\s+/);
  const arg = parts[1]?.toLowerCase();

  logger.info(
    { telegramUserId: ctx.from?.id, arg },
    "Handling /buy command"
  );

  if (arg && isProductType(arg)) {
    const tariff = TARIFFS[arg];
    const stars = STARS_PRICES[arg];
    await ctx.reply(
      `💎 <b>${tariff.name}</b>\n${tariff.description}\n\n` +
        `Цена: <b>${tariff.price}₽</b> или <b>${stars} ⭐</b>\n\n` +
        `Выберите способ оплаты:`,
      {
        parse_mode: "HTML",
        reply_markup: createPaymentMethodKeyboard(arg),
      }
    );
    return;
  }

  await ctx.reply(
    "💎 <b>Покупка кредитов</b>\n\n" +
      "Выберите тариф:\n" +
      `• ☕ <b>Новичок</b> — ${TARIFFS.basic.credits} гадание за ${TARIFFS.basic.price}₽\n` +
      `• 📦 <b>Любитель</b> — ${TARIFFS.pack5.credits} гаданий за ${TARIFFS.pack5.price}₽\n` +
      `• 🧘 <b>Внутренний мудрец</b> — 1 расширенное гадание за ${TARIFFS.pro.price}₽\n` +
      `• 🔮 <b>Кассандра</b> — 1 премиум-гадание за ${TARIFFS.cassandra.price}₽\n\n` +
      "Доступны оплата картой (YooKassa) и Telegram Stars.",
    {
      parse_mode: "HTML",
      reply_markup: createTariffPickerKeyboard(),
    }
  );
}

// =============================================================================
// CALLBACK DISPATCHER
// =============================================================================

/**
 * Handle `buy:*` and `pay:*` callbacks coming from inline keyboards.
 *
 * Routing:
 *  - `buy:<tariff>`        → swap to payment-method picker (edit message in place).
 *  - `buy:back`            → swap back to tariff picker.
 *  - `pay:yookassa:<tariff>` → send YooKassa invoice (or graceful fallback).
 *  - `pay:stars:<tariff>`    → send Telegram Stars invoice.
 */
export async function handleBuyCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    return;
  }

  const parsed = parsePaymentCallback(data);
  if (!parsed) {
    logger.warn({ data, telegramUserId: ctx.from?.id }, "Invalid payment callback");
    await ctx.answerCallbackQuery({ text: "Неверный формат данных" });
    return;
  }

  try {
    if (parsed.kind === "back") {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "💎 <b>Покупка кредитов</b>\n\nВыберите тариф:",
        {
          parse_mode: "HTML",
          reply_markup: createTariffPickerKeyboard(),
        }
      );
      return;
    }

    if (parsed.kind === "tariff") {
      const product = parsed.product;
      const tariff = TARIFFS[product];
      const stars = STARS_PRICES[product];
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `💎 <b>${tariff.name}</b>\n${tariff.description}\n\n` +
          `Цена: <b>${tariff.price}₽</b> или <b>${stars} ⭐</b>\n\n` +
          `Выберите способ оплаты:`,
        {
          parse_mode: "HTML",
          reply_markup: createPaymentMethodKeyboard(product),
        }
      );
      return;
    }

    // parsed.kind === "pay"
    await ctx.answerCallbackQuery();
    if (parsed.method === "yookassa") {
      await sendYooKassaInvoice(ctx, parsed.product);
    } else {
      await sendStarsInvoice(ctx, parsed.product);
    }
  } catch (error) {
    logger.error(
      { error, data, telegramUserId: ctx.from?.id },
      "Error while handling payment callback"
    );
    try {
      await ctx.answerCallbackQuery({ text: "Произошла ошибка" });
    } catch {
      // already answered
    }
  }
}

// =============================================================================
// INVOICE SENDERS
// =============================================================================

/**
 * Send a YooKassa (RUB) invoice via Telegram Bot Payments.
 *
 * If `TELEGRAM_PAYMENT_PROVIDER_TOKEN` is not configured we degrade gracefully:
 * the user is informed and pointed at the web checkout and Telegram Stars.
 */
async function sendYooKassaInvoice(
  ctx: BotContext,
  product: ProductType
): Promise<void> {
  const chatId = ctx.chat?.id;
  const telegramUserId = ctx.from?.id;
  if (!chatId || !telegramUserId) {
    return;
  }

  const env = getEnv();
  const providerToken = env.TELEGRAM_PAYMENT_PROVIDER_TOKEN;

  if (!providerToken || providerToken.trim().length === 0) {
    logger.warn(
      { telegramUserId, product },
      "YooKassa requested but TELEGRAM_PAYMENT_PROVIDER_TOKEN not configured"
    );
    await ctx.reply(
      "💳 Оплата картой через бота временно недоступна.\n\n" +
        "Вы можете оплатить:\n" +
        "• ⭐ Telegram Stars прямо здесь — нажмите соответствующую кнопку\n" +
        "• 💳 Картой на сайте — https://symancy.ru/pricing"
    );
    return;
  }

  const userIds = await resolveUnifiedUserId(ctx);
  if (!userIds) {
    await ctx.reply(
      "😔 Не удалось определить ваш аккаунт. Попробуйте /start и повторите."
    );
    return;
  }

  const tariff = TARIFFS[product];
  const payload = buildInvoicePayload(
    userIds.unifiedUserId,
    product,
    telegramUserId,
    chatId,
    "yookassa"
  );

  try {
    await ctx.api.sendInvoice(
      chatId,
      `Symancy: ${tariff.name}`,
      tariff.description,
      payload,
      "RUB",
      [{ label: tariff.name, amount: tariff.price * 100 }],
      { provider_token: providerToken }
    );
    logger.info(
      { telegramUserId, product, amount: tariff.price },
      "YooKassa invoice sent"
    );
  } catch (error) {
    logger.error(
      { error, telegramUserId, product },
      "Failed to send YooKassa invoice"
    );
    await ctx.reply(
      "😔 Не удалось создать счёт. Попробуйте ещё раз позже или " +
        "оплатите на сайте: https://symancy.ru/pricing"
    );
  }
}

/**
 * Send a Telegram Stars (XTR) invoice.
 *
 * Stars require:
 *  - `provider_token = ""` (empty string)
 *  - `currency = "XTR"`
 *  - exactly one `prices` entry whose `amount` is the integer star count
 *    (NO `* 100` — stars have no fractional part).
 */
async function sendStarsInvoice(
  ctx: BotContext,
  product: ProductType
): Promise<void> {
  const chatId = ctx.chat?.id;
  const telegramUserId = ctx.from?.id;
  if (!chatId || !telegramUserId) {
    return;
  }

  const userIds = await resolveUnifiedUserId(ctx);
  if (!userIds) {
    await ctx.reply(
      "😔 Не удалось определить ваш аккаунт. Попробуйте /start и повторите."
    );
    return;
  }

  const tariff = TARIFFS[product];
  const stars = STARS_PRICES[product];
  const payload = buildInvoicePayload(
    userIds.unifiedUserId,
    product,
    telegramUserId,
    chatId,
    "stars"
  );

  try {
    await ctx.api.sendInvoice(
      chatId,
      `Symancy: ${tariff.name}`,
      tariff.description,
      payload,
      "XTR",
      [{ label: tariff.name, amount: stars }],
      { provider_token: "" }
    );
    logger.info(
      { telegramUserId, product, stars },
      "Stars invoice sent"
    );
  } catch (error) {
    logger.error(
      { error, telegramUserId, product },
      "Failed to send Stars invoice"
    );
    await ctx.reply(
      "😔 Не удалось создать счёт Telegram Stars. Попробуйте ещё раз позже."
    );
  }
}

// =============================================================================
// PRE-CHECKOUT QUERY
// =============================================================================

/**
 * Validate a pre_checkout_query before Telegram completes the charge.
 *
 *  - The payload must be ours (valid JSON, product known).
 *  - The currency must match the chosen method (RUB↔yookassa, XTR↔stars).
 *  - The total amount must match the expected tariff price.
 *
 * Must respond within 10 seconds.
 */
export async function handlePreCheckoutQuery(ctx: Context): Promise<void> {
  const query = ctx.preCheckoutQuery;
  if (!query) {
    return;
  }

  const reject = async (reason: string): Promise<void> => {
    logger.warn(
      {
        telegramUserId: query.from.id,
        currency: query.currency,
        totalAmount: query.total_amount,
        invoicePayload: query.invoice_payload,
        reason,
      },
      "Rejecting pre_checkout_query"
    );
    try {
      await ctx.answerPreCheckoutQuery(false, reason);
    } catch (error) {
      logger.error({ error, reason }, "Failed to answer pre_checkout_query");
    }
  };

  const payload = parseInvoicePayload(query.invoice_payload);
  if (!payload) {
    return reject("Неверный формат счёта");
  }

  const tariff = TARIFFS[payload.product_type];

  if (payload.payment_method === "yookassa") {
    // RUB total_amount is in kopecks.
    const expected = tariff.price * 100;
    if (query.currency !== "RUB") {
      return reject("Несоответствие валюты");
    }
    if (query.total_amount !== expected) {
      return reject("Неверная сумма");
    }
  } else {
    // Stars: integer star count, no multiplier.
    const expected = STARS_PRICES[payload.product_type];
    if (query.currency !== "XTR") {
      return reject("Несоответствие валюты");
    }
    if (query.total_amount !== expected) {
      return reject("Неверная сумма");
    }
  }

  try {
    await ctx.answerPreCheckoutQuery(true);
    logger.info(
      {
        telegramUserId: query.from.id,
        product: payload.product_type,
        method: payload.payment_method,
        amount: query.total_amount,
        currency: query.currency,
      },
      "pre_checkout_query approved"
    );
  } catch (error) {
    logger.error(
      { error, telegramUserId: query.from.id },
      "Failed to approve pre_checkout_query"
    );
  }
}

// =============================================================================
// SUCCESSFUL PAYMENT
// =============================================================================

/**
 * Handle a successful payment service-message.
 *
 *  - Idempotency:
 *      * YooKassa: dedup by `purchases.yukassa_payment_id` = provider_payment_charge_id.
 *      * Stars:    dedup by `purchases.metadata->>telegram_payment_charge_id`.
 *  - Insert a row into `purchases` (best-effort — see notes).
 *  - Grant credits via `admin_adjust_credits(unified_user_id, …)`.
 *  - Reply to the user with a confirmation.
 *
 * NOTE on `purchases.user_id`:
 *   The column is `uuid NOT NULL` and references `auth.users(id)`.
 *   Telegram users without a linked web account do not have an auth row,
 *   so we cannot insert into `purchases` for them. In that case we still
 *   grant credits (the source of truth for the bot) and log a warning so
 *   the row can be backfilled by ops if we later add auth-shadow users.
 */
export async function handleSuccessfulPayment(ctx: BotContext): Promise<void> {
  const payment = ctx.message?.successful_payment;
  const chatId = ctx.chat?.id;
  const telegramUserId = ctx.from?.id;
  if (!payment || !chatId || !telegramUserId) {
    return;
  }

  const isStars = payment.currency === "XTR";
  const providerChargeId = payment.provider_payment_charge_id || null;
  const telegramChargeId = payment.telegram_payment_charge_id;

  logger.info(
    {
      telegramUserId,
      currency: payment.currency,
      totalAmount: payment.total_amount,
      providerChargeId,
      telegramChargeId,
      isStars,
    },
    "Received successful_payment"
  );

  const payload = parseInvoicePayload(payment.invoice_payload);
  if (!payload) {
    logger.error(
      { telegramUserId, invoicePayload: payment.invoice_payload },
      "Could not parse successful_payment invoice payload"
    );
    await ctx.reply(
      "✅ Платёж получен, но произошла ошибка при начислении. " +
        "Свяжитесь с поддержкой: support@symancy.ru"
    );
    return;
  }

  const tariff = TARIFFS[payload.product_type];
  const supabase = getSupabase();

  // -----------------------------------------------------------------------
  // Idempotency
  // -----------------------------------------------------------------------
  try {
    if (!isStars && providerChargeId) {
      const { data: existing } = await supabase
        .from("purchases")
        .select("id, status")
        .eq("yukassa_payment_id", providerChargeId)
        .maybeSingle();

      if (existing) {
        logger.info(
          { telegramUserId, providerChargeId, existingId: existing.id },
          "YooKassa payment already processed (idempotent)"
        );
        return;
      }
    }

    if (isStars) {
      const { data: existingStars } = await supabase
        .from("purchases")
        .select("id, status")
        .eq("metadata->>telegram_payment_charge_id", telegramChargeId)
        .maybeSingle();

      if (existingStars) {
        logger.info(
          { telegramUserId, telegramChargeId, existingId: existingStars.id },
          "Stars payment already processed (idempotent)"
        );
        return;
      }
    }
  } catch (error) {
    logger.error(
      { error, telegramUserId },
      "Idempotency check failed — proceeding cautiously"
    );
    // Continue: it's safer to attempt the grant once than to silently
    // swallow a real payment. The unique index on yukassa_payment_id will
    // catch a real duplicate for YooKassa.
  }

  // -----------------------------------------------------------------------
  // Resolve unified user and (optionally) auth_id for purchases.user_id.
  // -----------------------------------------------------------------------
  let unifiedUserId = payload.user_id;
  let authId: string | null = null;
  try {
    const { data: unifiedUser } = await supabase
      .from("unified_users")
      .select("id, auth_id")
      .eq("id", unifiedUserId)
      .maybeSingle();
    if (unifiedUser?.id) {
      unifiedUserId = unifiedUser.id;
      authId = unifiedUser.auth_id ?? null;
    } else {
      // Fall back to lookup by telegram_id
      const { data: byTg } = await supabase
        .from("unified_users")
        .select("id, auth_id")
        .eq("telegram_id", telegramUserId)
        .maybeSingle();
      if (byTg?.id) {
        unifiedUserId = byTg.id;
        authId = byTg.auth_id ?? null;
      }
    }
  } catch (error) {
    logger.error(
      { error, telegramUserId, unifiedUserId },
      "Failed to resolve unified_users row — keeping payload value"
    );
  }

  // -----------------------------------------------------------------------
  // Insert purchase row (only if we have an auth_id — `user_id` is NOT NULL
  // and FKs to auth.users).
  // -----------------------------------------------------------------------
  const metadata: Record<string, unknown> = {
    payment_method: isStars ? "telegram_stars" : "yookassa",
    telegram_payment_charge_id: telegramChargeId,
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    currency: payment.currency,
    total_amount: payment.total_amount,
  };
  if (isStars) {
    metadata.stars_amount = payment.total_amount;
  }

  if (authId) {
    const purchaseRow = {
      user_id: authId,
      unified_user_id: unifiedUserId,
      product_type: payload.product_type,
      amount_rub: tariff.price,
      yukassa_payment_id: isStars ? null : providerChargeId,
      status: "succeeded" as const,
      credits_granted: tariff.credits,
      paid_at: new Date().toISOString(),
      metadata,
    };

    const { error: insertError } = await supabase
      .from("purchases")
      .insert(purchaseRow);

    if (insertError) {
      // Duplicate? log and continue to credit grant; idempotency check
      // above usually catches this.
      logger.error(
        {
          error: insertError,
          telegramUserId,
          providerChargeId,
          telegramChargeId,
        },
        "Failed to insert purchases row (continuing to grant credits)"
      );
    } else {
      logger.info(
        { telegramUserId, product: payload.product_type, authId },
        "Inserted purchases row"
      );
    }
  } else {
    logger.warn(
      {
        telegramUserId,
        unifiedUserId,
        product: payload.product_type,
        method: metadata.payment_method,
      },
      "Skipping purchases row insert (no auth_id linked) — credits granted via admin_adjust_credits"
    );
  }

  // -----------------------------------------------------------------------
  // Grant credits via admin_adjust_credits (unified credits, telegram path).
  // -----------------------------------------------------------------------
  const basicDelta =
    payload.product_type === "basic" || payload.product_type === "pack5"
      ? tariff.credits
      : 0;
  const proDelta = payload.product_type === "pro" ? tariff.credits : 0;
  const cassandraDelta =
    payload.product_type === "cassandra" ? tariff.credits : 0;
  const reason =
    `telegram_payment:${isStars ? "stars" : "yookassa"}:${payload.product_type}`;

  const { error: grantError } = await supabase.rpc("admin_adjust_credits", {
    p_unified_user_id: unifiedUserId,
    p_basic_delta: basicDelta,
    p_pro_delta: proDelta,
    p_cassandra_delta: cassandraDelta,
    p_reason: reason,
  });

  if (grantError) {
    logger.error(
      {
        error: grantError,
        telegramUserId,
        unifiedUserId,
        product: payload.product_type,
        basicDelta,
        proDelta,
        cassandraDelta,
        reason,
      },
      "CRITICAL: admin_adjust_credits failed after successful payment"
    );
    await ctx.reply(
      "❌ Платёж получен, но при начислении кредитов произошла ошибка.\n" +
        "Напишите в поддержку: support@symancy.ru — мы всё исправим вручную."
    );
    return;
  }

  // -----------------------------------------------------------------------
  // User confirmation
  // -----------------------------------------------------------------------
  const suffix = isStars ? " (Telegram Stars)" : "";
  const creditWord = tariff.credits === 1 ? "кредит" : "кредитов";
  await ctx.reply(
    `✅ Оплата прошла успешно${suffix}!\n\n` +
      `Тариф: <b>${tariff.name}</b>\n` +
      `Начислено: <b>${tariff.credits}</b> ${creditWord}\n\n` +
      "Отправьте фото кофейной гущи, чтобы начать гадание ☕",
    { parse_mode: "HTML" }
  );

  logger.info(
    {
      telegramUserId,
      unifiedUserId,
      product: payload.product_type,
      credits: tariff.credits,
      method: metadata.payment_method,
    },
    "Payment processed and credits granted"
  );
}
