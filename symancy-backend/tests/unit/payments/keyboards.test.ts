/**
 * Unit tests for payments/keyboards.ts
 *
 * Verifies:
 *  - parsePaymentCallback: all accepted formats + rejection cases
 *  - createTariffPickerKeyboard: returns inline_keyboard with 4 buttons
 *  - createPaymentMethodKeyboard: returns 3 buttons with correct callback_data
 */
import { describe, it, expect } from "vitest";
import {
  parsePaymentCallback,
  createTariffPickerKeyboard,
  createPaymentMethodKeyboard,
} from "../../../src/modules/payments/keyboards.js";
import {
  PRODUCT_TYPES,
  TARIFFS,
  STARS_PRICES,
} from "../../../src/modules/payments/constants.js";

// ============================================================================
// parsePaymentCallback
// ============================================================================
describe("parsePaymentCallback", () => {
  // ---- buy: tariff cases ---------------------------------------------------
  it("parses 'buy:basic' → tariff basic", () => {
    expect(parsePaymentCallback("buy:basic")).toEqual({
      kind: "tariff",
      product: "basic",
    });
  });

  it("parses 'buy:pack5' → tariff pack5", () => {
    expect(parsePaymentCallback("buy:pack5")).toEqual({
      kind: "tariff",
      product: "pack5",
    });
  });

  it("parses 'buy:pro' → tariff pro", () => {
    expect(parsePaymentCallback("buy:pro")).toEqual({
      kind: "tariff",
      product: "pro",
    });
  });

  it("parses 'buy:cassandra' → tariff cassandra", () => {
    expect(parsePaymentCallback("buy:cassandra")).toEqual({
      kind: "tariff",
      product: "cassandra",
    });
  });

  // ---- buy: back -----------------------------------------------------------
  it("parses 'buy:back' → back", () => {
    expect(parsePaymentCallback("buy:back")).toEqual({ kind: "back" });
  });

  // ---- buy: rejection cases ------------------------------------------------
  it("returns null for 'buy:nonexistent'", () => {
    expect(parsePaymentCallback("buy:nonexistent")).toBeNull();
  });

  it("returns null for 'buy:basic:extra' (3 parts)", () => {
    expect(parsePaymentCallback("buy:basic:extra")).toBeNull();
  });

  it("returns null for 'buy:' (empty product)", () => {
    expect(parsePaymentCallback("buy:")).toBeNull();
  });

  // ---- pay: accepted cases -------------------------------------------------
  it("parses 'pay:stars:basic' → pay stars basic", () => {
    expect(parsePaymentCallback("pay:stars:basic")).toEqual({
      kind: "pay",
      method: "stars",
      product: "basic",
    });
  });

  it("parses 'pay:yookassa:cassandra' → pay yookassa cassandra", () => {
    expect(parsePaymentCallback("pay:yookassa:cassandra")).toEqual({
      kind: "pay",
      method: "yookassa",
      product: "cassandra",
    });
  });

  it("parses 'pay:stars:pack5' → pay stars pack5", () => {
    expect(parsePaymentCallback("pay:stars:pack5")).toEqual({
      kind: "pay",
      method: "stars",
      product: "pack5",
    });
  });

  it("parses 'pay:yookassa:pro' → pay yookassa pro", () => {
    expect(parsePaymentCallback("pay:yookassa:pro")).toEqual({
      kind: "pay",
      method: "yookassa",
      product: "pro",
    });
  });

  // ---- pay: rejection cases ------------------------------------------------
  it("returns null for 'pay:unknown:basic' (unknown method)", () => {
    expect(parsePaymentCallback("pay:unknown:basic")).toBeNull();
  });

  it("returns null for 'pay:stars:unknown' (unknown product)", () => {
    expect(parsePaymentCallback("pay:stars:unknown")).toBeNull();
  });

  it("returns null for 'pay:stars' (only 2 parts)", () => {
    expect(parsePaymentCallback("pay:stars")).toBeNull();
  });

  it("returns null for 'pay:yookassa' (only 2 parts)", () => {
    expect(parsePaymentCallback("pay:yookassa")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parsePaymentCallback("")).toBeNull();
  });

  it("returns null for 'random:data'", () => {
    expect(parsePaymentCallback("random:data")).toBeNull();
  });

  it("returns null for a string with no colon", () => {
    expect(parsePaymentCallback("buysomething")).toBeNull();
  });

  it("returns null for 'pay:stars:basic:extra' (4 parts)", () => {
    expect(parsePaymentCallback("pay:stars:basic:extra")).toBeNull();
  });
});

// ============================================================================
// createTariffPickerKeyboard
// ============================================================================
describe("createTariffPickerKeyboard", () => {
  it("returns an object with inline_keyboard property", () => {
    const kb = createTariffPickerKeyboard();
    expect(kb).toHaveProperty("inline_keyboard");
  });

  it("has exactly 4 buttons (one per product type)", () => {
    const kb = createTariffPickerKeyboard();
    // Each row is an array of buttons; collect all buttons across rows.
    const allButtons = kb.inline_keyboard.flat();
    expect(allButtons).toHaveLength(PRODUCT_TYPES.length);
  });

  it("each button has callback_data matching 'buy:<product>'", () => {
    const kb = createTariffPickerKeyboard();
    const allButtons = kb.inline_keyboard.flat();
    const callbackDatas = allButtons.map((btn) => btn.callback_data);

    for (const product of PRODUCT_TYPES) {
      expect(callbackDatas).toContain(`buy:${product}`);
    }
  });

  it("each button has non-empty text", () => {
    const kb = createTariffPickerKeyboard();
    const allButtons = kb.inline_keyboard.flat();
    for (const btn of allButtons) {
      expect(btn.text.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// createPaymentMethodKeyboard
// ============================================================================
describe("createPaymentMethodKeyboard", () => {
  for (const product of PRODUCT_TYPES) {
    describe(`product='${product}'`, () => {
      it("returns inline_keyboard with exactly 3 buttons", () => {
        const kb = createPaymentMethodKeyboard(product);
        const allButtons = kb.inline_keyboard.flat();
        expect(allButtons).toHaveLength(3);
      });

      it("has 'pay:yookassa:<product>' callback", () => {
        const kb = createPaymentMethodKeyboard(product);
        const allButtons = kb.inline_keyboard.flat();
        const callbackDatas = allButtons.map((b) => b.callback_data);
        expect(callbackDatas).toContain(`pay:yookassa:${product}`);
      });

      it("has 'pay:stars:<product>' callback", () => {
        const kb = createPaymentMethodKeyboard(product);
        const allButtons = kb.inline_keyboard.flat();
        const callbackDatas = allButtons.map((b) => b.callback_data);
        expect(callbackDatas).toContain(`pay:stars:${product}`);
      });

      it("has 'buy:back' callback", () => {
        const kb = createPaymentMethodKeyboard(product);
        const allButtons = kb.inline_keyboard.flat();
        const callbackDatas = allButtons.map((b) => b.callback_data);
        expect(callbackDatas).toContain("buy:back");
      });

      it("yookassa button text contains the RUB price", () => {
        const kb = createPaymentMethodKeyboard(product);
        const yookassaBtn = kb.inline_keyboard
          .flat()
          .find((b) => b.callback_data === `pay:yookassa:${product}`);
        expect(yookassaBtn).toBeDefined();
        expect(yookassaBtn!.text).toContain(String(TARIFFS[product].price));
      });

      it("stars button text contains the star count", () => {
        const kb = createPaymentMethodKeyboard(product);
        const starsBtn = kb.inline_keyboard
          .flat()
          .find((b) => b.callback_data === `pay:stars:${product}`);
        expect(starsBtn).toBeDefined();
        expect(starsBtn!.text).toContain(String(STARS_PRICES[product]));
      });
    });
  }
});
