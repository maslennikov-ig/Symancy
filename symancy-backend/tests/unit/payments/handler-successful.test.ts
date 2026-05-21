/**
 * Unit tests for payments/handler.ts — handleSuccessfulPayment
 *
 * Verifies:
 *  - Idempotency: YooKassa duplicate → early return (no RPC, no insert)
 *  - Idempotency: Stars duplicate → early return (no RPC, no insert)
 *  - Fresh YooKassa payment: correct insert + correct credit deltas + confirmation
 *  - Fresh Stars payment: insert with method='telegram_stars' + confirmation with Stars suffix
 *  - Unlinked user (auth_id=null): skips insert but still calls RPC
 *  - RPC failure: ctx.reply contains support email, NOT success message
 *  - Invalid payload: ctx.reply contains 'поддержкой', no RPC
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env
vi.mock("../../../src/config/env.js", () => ({
  getEnv: vi.fn(() => ({
    TELEGRAM_PAYMENT_PROVIDER_TOKEN: "test_provider_token",
    WEBHOOK_BASE_URL: "https://symancy.ru",
    ADMIN_CHAT_ID: 123,
    TELEGRAM_BOT_TOKEN: "1:abc",
  })),
}));

// Mock UnifiedUserService
vi.mock("../../../src/services/user/UnifiedUserService.js", () => ({
  findOrCreateByTelegramId: vi.fn().mockResolvedValue({
    id: "unified-user-uuid",
    auth_id: null,
  }),
}));

// ============================================================================
// Supabase mock — we set up via vi.hoisted so we can control it per-test
// ============================================================================
const {
  mockFrom,
  mockRpc,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockInsert,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  // Default chain: from → select → eq → maybeSingle
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  // Default chain: from → insert
  mockInsert.mockResolvedValue({ data: null, error: null });

  // from() returns different objects based on the table name
  mockFrom.mockImplementation((table: string) => {
    if (table === "purchases") {
      return {
        select: mockSelect,
        insert: mockInsert,
      };
    }
    if (table === "unified_users") {
      return { select: mockSelect };
    }
    return { select: mockSelect, insert: mockInsert };
  });

  // Default RPC success
  mockRpc.mockResolvedValue({ data: null, error: null });

  return { mockFrom, mockRpc, mockSelect, mockEq, mockMaybeSingle, mockInsert };
});

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { handleSuccessfulPayment } from "../../../src/modules/payments/handler.js";
import { TARIFFS, STARS_PRICES, type ProductType } from "../../../src/modules/payments/constants.js";
import type { BotContext } from "../../../src/modules/router/middleware.js";

// ============================================================================
// Helpers
// ============================================================================

function buildPayload(
  product: ProductType,
  method: "yookassa" | "stars"
): string {
  return JSON.stringify({
    user_id: "unified-user-uuid",
    product_type: product,
    telegram_user_id: 100001,
    chat_id: 200001,
    payment_method: method,
  });
}

interface SuccessfulPaymentOverrides {
  currency?: string;
  total_amount?: number;
  provider_payment_charge_id?: string;
  telegram_payment_charge_id?: string;
  invoice_payload?: string;
}

function buildSuccessCtx(overrides: SuccessfulPaymentOverrides = {}): BotContext {
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    from: { id: 100001, is_bot: false, first_name: "Test" },
    chat: { id: 200001 },
    message: {
      successful_payment: {
        currency: overrides.currency ?? "RUB",
        total_amount: overrides.total_amount ?? TARIFFS.basic.price * 100,
        provider_payment_charge_id:
          overrides.provider_payment_charge_id ?? "yookassa_charge_001",
        telegram_payment_charge_id:
          overrides.telegram_payment_charge_id ?? "tg_charge_001",
        invoice_payload:
          overrides.invoice_payload ?? buildPayload("basic", "yookassa"),
      },
    },
    reply,
    profile: undefined,
    userState: undefined,
  } as unknown as BotContext;
}

/**
 * Reset Supabase mock chains to their defaults before each test.
 * Per-test overrides are applied after calling this.
 */
function resetSupabaseMocks() {
  vi.clearAllMocks();

  // Re-wire chains after clearAllMocks wipes the implementations
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockInsert.mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "purchases") {
      return { select: mockSelect, insert: mockInsert };
    }
    if (table === "unified_users") {
      return { select: mockSelect };
    }
    return { select: mockSelect, insert: mockInsert };
  });

  mockRpc.mockResolvedValue({ data: null, error: null });
}

// ============================================================================
// Tests
// ============================================================================
describe("handleSuccessfulPayment", () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  // --------------------------------------------------------------------------
  // Idempotency — YooKassa
  // --------------------------------------------------------------------------
  describe("idempotency — YooKassa", () => {
    it("does nothing when the purchase already exists by yukassa_payment_id", async () => {
      // Simulate existing row returned by idempotency check
      mockMaybeSingle.mockResolvedValue({
        data: { id: "existing-purchase-uuid", status: "succeeded" },
        error: null,
      });

      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_charge_dup",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      // No credit grant
      expect(mockRpc).not.toHaveBeenCalled();
      // No insert
      expect(mockInsert).not.toHaveBeenCalled();
      // No confirmation reply
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Idempotency — Stars
  // --------------------------------------------------------------------------
  describe("idempotency — Stars", () => {
    it("does nothing when the purchase already exists by telegram_payment_charge_id", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: "existing-stars-uuid", status: "succeeded" },
        error: null,
      });

      const ctx = buildSuccessCtx({
        currency: "XTR",
        total_amount: STARS_PRICES.basic,
        provider_payment_charge_id: "",
        telegram_payment_charge_id: "tg_charge_dup",
        invoice_payload: buildPayload("basic", "stars"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Fresh YooKassa payment with linked user (auth_id present)
  // --------------------------------------------------------------------------
  describe("fresh YooKassa payment — linked user", () => {
    beforeEach(() => {
      // idempotency check → no existing row
      // unified_users lookup → user with auth_id
      let callCount = 0;
      mockMaybeSingle.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // purchases idempotency check
          return Promise.resolve({ data: null, error: null });
        }
        // unified_users lookup
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: "auth-uuid-123" },
          error: null,
        });
      });
    });

    it("inserts into purchases with yukassa_payment_id", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_charge_fresh",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          yukassa_payment_id: "yookassa_charge_fresh",
          product_type: "basic",
          status: "succeeded",
        })
      );
    });

    it("calls admin_adjust_credits with basicDelta=1 for 'basic'", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_charge_basic",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).toHaveBeenCalledWith(
        "admin_adjust_credits",
        expect.objectContaining({
          p_unified_user_id: "unified-user-uuid",
          p_basic_delta: 1,
          p_pro_delta: 0,
          p_cassandra_delta: 0,
        })
      );
    });

    it("calls admin_adjust_credits with basicDelta=5 for 'pack5'", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.pack5.price * 100,
        provider_payment_charge_id: "yookassa_charge_pack5",
        invoice_payload: buildPayload("pack5", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).toHaveBeenCalledWith(
        "admin_adjust_credits",
        expect.objectContaining({
          p_basic_delta: 5,
          p_pro_delta: 0,
          p_cassandra_delta: 0,
        })
      );
    });

    it("calls admin_adjust_credits with proDelta=1 for 'pro'", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.pro.price * 100,
        provider_payment_charge_id: "yookassa_charge_pro",
        invoice_payload: buildPayload("pro", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).toHaveBeenCalledWith(
        "admin_adjust_credits",
        expect.objectContaining({
          p_basic_delta: 0,
          p_pro_delta: 1,
          p_cassandra_delta: 0,
        })
      );
    });

    it("calls admin_adjust_credits with cassandraDelta=1 for 'cassandra'", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.cassandra.price * 100,
        provider_payment_charge_id: "yookassa_charge_cassandra",
        invoice_payload: buildPayload("cassandra", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).toHaveBeenCalledWith(
        "admin_adjust_credits",
        expect.objectContaining({
          p_basic_delta: 0,
          p_pro_delta: 0,
          p_cassandra_delta: 1,
        })
      );
    });

    it("sends confirmation reply containing '✅ Оплата прошла успешно'", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_charge_confirm",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("✅ Оплата прошла успешно"),
        expect.anything()
      );
    });

    it("confirmation does NOT mention Telegram Stars for YooKassa", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_no_stars",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      const replyText = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(replyText).not.toContain("Telegram Stars");
    });
  });

  // --------------------------------------------------------------------------
  // Fresh Stars payment with linked user
  // --------------------------------------------------------------------------
  describe("fresh Stars payment — linked user", () => {
    beforeEach(() => {
      let callCount = 0;
      mockMaybeSingle.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Stars idempotency check (no existing row)
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: "auth-uuid-456" },
          error: null,
        });
      });
    });

    it("inserts into purchases with yukassa_payment_id=null", async () => {
      const ctx = buildSuccessCtx({
        currency: "XTR",
        total_amount: STARS_PRICES.basic,
        provider_payment_charge_id: "",
        telegram_payment_charge_id: "tg_charge_stars",
        invoice_payload: buildPayload("basic", "stars"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          yukassa_payment_id: null,
          product_type: "basic",
          status: "succeeded",
        })
      );
    });

    it("metadata.payment_method is 'telegram_stars' for Stars payment", async () => {
      const ctx = buildSuccessCtx({
        currency: "XTR",
        total_amount: STARS_PRICES.basic,
        provider_payment_charge_id: "",
        telegram_payment_charge_id: "tg_charge_stars_meta",
        invoice_payload: buildPayload("basic", "stars"),
      });

      await handleSuccessfulPayment(ctx);

      const insertArg = (mockInsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg).toBeDefined();
      const metadata = insertArg.metadata as Record<string, unknown>;
      expect(metadata.payment_method).toBe("telegram_stars");
    });

    it("confirmation reply contains '(Telegram Stars)' suffix", async () => {
      const ctx = buildSuccessCtx({
        currency: "XTR",
        total_amount: STARS_PRICES.basic,
        provider_payment_charge_id: "",
        telegram_payment_charge_id: "tg_charge_stars_conf",
        invoice_payload: buildPayload("basic", "stars"),
      });

      await handleSuccessfulPayment(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("(Telegram Stars)"),
        expect.anything()
      );
    });

    it("calls admin_adjust_credits with correct deltas for Stars 'basic'", async () => {
      const ctx = buildSuccessCtx({
        currency: "XTR",
        total_amount: STARS_PRICES.basic,
        provider_payment_charge_id: "",
        telegram_payment_charge_id: "tg_charge_delta",
        invoice_payload: buildPayload("basic", "stars"),
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).toHaveBeenCalledWith(
        "admin_adjust_credits",
        expect.objectContaining({
          p_basic_delta: 1,
          p_pro_delta: 0,
          p_cassandra_delta: 0,
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Unlinked user (auth_id is null)
  // --------------------------------------------------------------------------
  describe("unlinked user — no auth_id", () => {
    beforeEach(() => {
      // Both idempotency and user lookups return no existing row / no auth_id
      mockMaybeSingle.mockResolvedValue({
        data: { id: "unified-user-uuid", auth_id: null },
        error: null,
      });
    });

    it("skips purchases insert but still calls admin_adjust_credits", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_unlinked",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      // Idempotency check must return no existing purchase
      let maybeSingleCall = 0;
      mockMaybeSingle.mockImplementation(() => {
        maybeSingleCall++;
        // First call: purchases idempotency check → null
        if (maybeSingleCall === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        // Subsequent: unified_users lookup → auth_id=null
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: null },
          error: null,
        });
      });

      await handleSuccessfulPayment(ctx);

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("admin_adjust_credits", expect.any(Object));
    });

    it("still sends confirmation reply to user", async () => {
      let maybeSingleCall = 0;
      mockMaybeSingle.mockImplementation(() => {
        maybeSingleCall++;
        if (maybeSingleCall === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: null },
          error: null,
        });
      });

      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_unlinked_reply",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("✅ Оплата прошла успешно"),
        expect.anything()
      );
    });
  });

  // --------------------------------------------------------------------------
  // RPC failure
  // --------------------------------------------------------------------------
  describe("RPC failure", () => {
    it("sends error reply with support email when admin_adjust_credits fails", async () => {
      // Idempotency check → no existing row
      let maybeSingleCall = 0;
      mockMaybeSingle.mockImplementation(() => {
        maybeSingleCall++;
        if (maybeSingleCall === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: "auth-uuid-789" },
          error: null,
        });
      });

      // RPC returns an error
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "DB constraint violation" },
      });

      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_rpc_fail",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("support@symancy.ru")
      );
    });

    it("does NOT send success confirmation when RPC fails", async () => {
      let maybeSingleCall = 0;
      mockMaybeSingle.mockImplementation(() => {
        maybeSingleCall++;
        if (maybeSingleCall === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: { id: "unified-user-uuid", auth_id: "auth-uuid-789" },
          error: null,
        });
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "timeout" },
      });

      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: TARIFFS.basic.price * 100,
        provider_payment_charge_id: "yookassa_no_success_msg",
        invoice_payload: buildPayload("basic", "yookassa"),
      });

      await handleSuccessfulPayment(ctx);

      const allReplyCalls = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls;
      const replyTexts = allReplyCalls.map((call) => call[0] as string);
      const hasSuccessMessage = replyTexts.some((text) =>
        text.includes("✅ Оплата прошла успешно")
      );
      expect(hasSuccessMessage).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Invalid payload
  // --------------------------------------------------------------------------
  describe("invalid invoice payload", () => {
    it("replies with support link and does not call RPC", async () => {
      const ctx = buildSuccessCtx({
        currency: "RUB",
        total_amount: 10000,
        invoice_payload: "not_valid_json_garbage",
      });

      await handleSuccessfulPayment(ctx);

      expect(mockRpc).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("поддержкой")
      );
    });
  });

  // --------------------------------------------------------------------------
  // Early exit — missing required fields on ctx
  // --------------------------------------------------------------------------
  describe("early exit conditions", () => {
    it("does nothing when message.successful_payment is absent", async () => {
      const reply = vi.fn();
      const ctx = {
        from: { id: 100001 },
        chat: { id: 200001 },
        message: {},
        reply,
      } as unknown as BotContext;

      await handleSuccessfulPayment(ctx);

      expect(reply).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("does nothing when chat is absent", async () => {
      const reply = vi.fn();
      const ctx = {
        from: { id: 100001 },
        chat: undefined,
        message: {
          successful_payment: {
            currency: "RUB",
            total_amount: 10000,
            provider_payment_charge_id: "x",
            telegram_payment_charge_id: "y",
            invoice_payload: buildPayload("basic", "yookassa"),
          },
        },
        reply,
      } as unknown as BotContext;

      await handleSuccessfulPayment(ctx);

      expect(reply).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
