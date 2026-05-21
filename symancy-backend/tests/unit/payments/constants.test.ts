/**
 * Unit tests for payments/constants.ts
 *
 * Verifies:
 *  - isProductType type guard (positive and negative cases)
 *  - isPaymentMethod type guard (positive and negative cases)
 *  - TARIFFS shape and sanity-check values
 *  - STARS_PRICES shape and sanity-check values
 */
import { describe, it, expect } from "vitest";
import {
  PRODUCT_TYPES,
  TARIFFS,
  STARS_PRICES,
  isProductType,
  isPaymentMethod,
} from "../../../src/modules/payments/constants.js";

// ============================================================================
// isProductType
// ============================================================================
describe("isProductType", () => {
  it("returns true for 'basic'", () => {
    expect(isProductType("basic")).toBe(true);
  });

  it("returns true for 'pack5'", () => {
    expect(isProductType("pack5")).toBe(true);
  });

  it("returns true for 'pro'", () => {
    expect(isProductType("pro")).toBe(true);
  });

  it("returns true for 'cassandra'", () => {
    expect(isProductType("cassandra")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isProductType("xyz")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isProductType("")).toBe(false);
  });

  it("returns false for a near-match string", () => {
    expect(isProductType("basic2")).toBe(false);
  });
});

// ============================================================================
// isPaymentMethod
// ============================================================================
describe("isPaymentMethod", () => {
  it("returns true for 'yookassa'", () => {
    expect(isPaymentMethod("yookassa")).toBe(true);
  });

  it("returns true for 'stars'", () => {
    expect(isPaymentMethod("stars")).toBe(true);
  });

  it("returns false for 'crypto'", () => {
    expect(isPaymentMethod("crypto")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isPaymentMethod("")).toBe(false);
  });

  it("returns false for a near-match string", () => {
    expect(isPaymentMethod("yookassa2")).toBe(false);
  });
});

// ============================================================================
// TARIFFS shape
// ============================================================================
describe("TARIFFS", () => {
  it("contains exactly the 4 PRODUCT_TYPES as keys", () => {
    const keys = Object.keys(TARIFFS).sort();
    const expected = [...PRODUCT_TYPES].sort();
    expect(keys).toEqual(expected);
  });

  it("TARIFFS.basic.price equals 100", () => {
    expect(TARIFFS.basic.price).toBe(100);
  });

  it("TARIFFS.cassandra.price equals 1000", () => {
    expect(TARIFFS.cassandra.price).toBe(1000);
  });

  it("TARIFFS.pack5.credits equals 5 (unique multi-credit tariff)", () => {
    expect(TARIFFS.pack5.credits).toBe(5);
  });

  it("each tariff has required fields", () => {
    for (const product of PRODUCT_TYPES) {
      const t = TARIFFS[product];
      expect(typeof t.price).toBe("number");
      expect(typeof t.credits).toBe("number");
      expect(typeof t.creditType).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
    }
  });
});

// ============================================================================
// STARS_PRICES shape
// ============================================================================
describe("STARS_PRICES", () => {
  it("contains exactly the 4 PRODUCT_TYPES as keys", () => {
    const keys = Object.keys(STARS_PRICES).sort();
    const expected = [...PRODUCT_TYPES].sort();
    expect(keys).toEqual(expected);
  });

  it("STARS_PRICES.basic equals 75", () => {
    expect(STARS_PRICES.basic).toBe(75);
  });

  it("each stars price is a positive integer", () => {
    for (const product of PRODUCT_TYPES) {
      const price = STARS_PRICES[product];
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
    }
  });
});
