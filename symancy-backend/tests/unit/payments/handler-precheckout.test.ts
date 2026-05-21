/**
 * Unit tests for payments/handler.ts — handlePreCheckoutQuery
 *
 * Verifies:
 *  - Valid YooKassa and Stars payloads are approved
 *  - Currency mismatches are rejected
 *  - Amount mismatches are rejected
 *  - Invalid / garbage payloads are rejected
 *  - All 4 tariffs × 2 currencies (parameterized)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env BEFORE importing the handler
vi.mock("../../../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    TELEGRAM_PAYMENT_PROVIDER_TOKEN: "test_provider_token",
    WEBHOOK_BASE_URL: "https://symancy.ru",
    ADMIN_CHAT_ID: 123,
    TELEGRAM_BOT_TOKEN: "1:abc",
  })),
}));

// Mock Supabase — handlePreCheckoutQuery doesn't hit the DB, but the module
// initialises getSupabase() at import time, so we stub it to avoid errors.
vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}));

// Mock UnifiedUserService
vi.mock("../../../src/services/user/UnifiedUserService.js", () => ({
  findOrCreateByTelegramId: vi.fn(),
}));

import { handlePreCheckoutQuery } from "../../../src/modules/payments/handler.js";
import {
  PRODUCT_TYPES,
  TARIFFS,
  STARS_PRICES,
  type ProductType,
} from "../../../src/modules/payments/constants.js";
import type { Context } from "grammy";

// ============================================================================
// Helper — build a mock grammy Context for pre_checkout_query
// ============================================================================
function buildValidPayload(
  product: ProductType,
  method: "yookassa" | "stars"
): string {
  return JSON.stringify({
    user_id: "uuid-test-user",
    product_type: product,
    telegram_user_id: 100000,
    chat_id: 200000,
    payment_method: method,
  });
}

function buildPreCheckoutCtx(
  overrides: Partial<{
    invoice_payload: string;
    currency: string;
    total_amount: number;
  }> = {}
): Context {
  const query = {
    id: "query_123",
    from: { id: 100000, is_bot: false, first_name: "Test" },
    currency: overrides.currency ?? "RUB",
    total_amount: overrides.total_amount ?? TARIFFS.basic.price * 100,
    invoice_payload:
      overrides.invoice_payload ?? buildValidPayload("basic", "yookassa"),
  };

  const answerPreCheckoutQuery = vi.fn().mockResolvedValue(undefined);

  return {
    preCheckoutQuery: query,
    answerPreCheckoutQuery,
  } as unknown as Context;
}

// ============================================================================
// Tests
// ============================================================================
describe("handlePreCheckoutQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Happy paths
  // --------------------------------------------------------------------------
  it("approves a valid YooKassa payment for 'basic'", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "yookassa"),
      currency: "RUB",
      total_amount: TARIFFS.basic.price * 100,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(true);
  });

  it("approves a valid Stars payment for 'basic'", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "stars"),
      currency: "XTR",
      total_amount: STARS_PRICES.basic,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(true);
  });

  // --------------------------------------------------------------------------
  // Currency mismatch
  // --------------------------------------------------------------------------
  it("rejects YooKassa payment with currency=XTR", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "yookassa"),
      currency: "XTR",
      total_amount: TARIFFS.basic.price * 100,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Несоответствие валюты"
    );
  });

  it("rejects Stars payment with currency=RUB", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "stars"),
      currency: "RUB",
      total_amount: STARS_PRICES.basic,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Несоответствие валюты"
    );
  });

  // --------------------------------------------------------------------------
  // Amount mismatch
  // --------------------------------------------------------------------------
  it("rejects YooKassa payment with wrong amount (one kopeck short)", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "yookassa"),
      currency: "RUB",
      total_amount: TARIFFS.basic.price * 100 - 1,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Неверная сумма"
    );
  });

  it("rejects Stars payment with wrong star count (one star short)", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: buildValidPayload("basic", "stars"),
      currency: "XTR",
      total_amount: STARS_PRICES.basic - 1,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Неверная сумма"
    );
  });

  // --------------------------------------------------------------------------
  // Invalid payload
  // --------------------------------------------------------------------------
  it("rejects when invoice_payload is not valid JSON", async () => {
    const ctx = buildPreCheckoutCtx({
      invoice_payload: "garbage_not_json",
      currency: "RUB",
      total_amount: TARIFFS.basic.price * 100,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Неверный формат счёта"
    );
  });

  it("rejects when invoice_payload has an invalid product_type", async () => {
    const payload = JSON.stringify({
      user_id: "uuid-test-user",
      product_type: "unknown_tariff",
      telegram_user_id: 100000,
      chat_id: 200000,
      payment_method: "yookassa",
    });
    const ctx = buildPreCheckoutCtx({
      invoice_payload: payload,
      currency: "RUB",
      total_amount: 10000,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Неверный формат счёта"
    );
  });

  it("rejects when invoice_payload is missing required fields", async () => {
    const payload = JSON.stringify({ product_type: "basic" }); // no user_id etc.
    const ctx = buildPreCheckoutCtx({
      invoice_payload: payload,
      currency: "RUB",
      total_amount: TARIFFS.basic.price * 100,
    });

    await handlePreCheckoutQuery(ctx);

    expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
      false,
      "Неверный формат счёта"
    );
  });

  it("does nothing when preCheckoutQuery is absent", async () => {
    const answerPreCheckoutQuery = vi.fn();
    const ctx = {
      preCheckoutQuery: undefined,
      answerPreCheckoutQuery,
    } as unknown as Context;

    await handlePreCheckoutQuery(ctx);

    expect(answerPreCheckoutQuery).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Parameterized: all 4 tariffs × 2 payment methods
  // --------------------------------------------------------------------------
  describe.each(
    PRODUCT_TYPES.flatMap((product) => [
      { product, method: "yookassa" as const },
      { product, method: "stars" as const },
    ])
  )("$product / $method", ({ product, method }) => {
    it("approves correct currency and amount", async () => {
      const currency = method === "yookassa" ? "RUB" : "XTR";
      const amount =
        method === "yookassa" ? TARIFFS[product].price * 100 : STARS_PRICES[product];

      const ctx = buildPreCheckoutCtx({
        invoice_payload: buildValidPayload(product, method),
        currency,
        total_amount: amount,
      });

      await handlePreCheckoutQuery(ctx);

      expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(true);
    });

    it("rejects mismatched currency", async () => {
      // Swap currency to the opposite method's currency
      const wrongCurrency = method === "yookassa" ? "XTR" : "RUB";
      const amount =
        method === "yookassa" ? TARIFFS[product].price * 100 : STARS_PRICES[product];

      const ctx = buildPreCheckoutCtx({
        invoice_payload: buildValidPayload(product, method),
        currency: wrongCurrency,
        total_amount: amount,
      });

      await handlePreCheckoutQuery(ctx);

      expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
        false,
        "Несоответствие валюты"
      );
    });

    it("rejects wrong amount (amount + 1)", async () => {
      const currency = method === "yookassa" ? "RUB" : "XTR";
      const correctAmount =
        method === "yookassa" ? TARIFFS[product].price * 100 : STARS_PRICES[product];

      const ctx = buildPreCheckoutCtx({
        invoice_payload: buildValidPayload(product, method),
        currency,
        total_amount: correctAmount + 1,
      });

      await handlePreCheckoutQuery(ctx);

      expect(ctx.answerPreCheckoutQuery).toHaveBeenCalledWith(
        false,
        "Неверная сумма"
      );
    });
  });
});
