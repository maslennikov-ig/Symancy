/**
 * Unit tests for referral deep-link payload parsing
 */
import { describe, it, expect } from "vitest";
import { parseRefPayload } from "../../../src/modules/referrals/parse.js";

describe("parseRefPayload", () => {
  it("extracts a valid code after ref_ prefix", () => {
    expect(parseRefPayload("ref_ABC123")).toBe("ABC123");
  });

  it("extracts an 8-char uppercase code (typical generated format)", () => {
    expect(parseRefPayload("ref_A1B2C3D4")).toBe("A1B2C3D4");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseRefPayload("  ref_ABC123  ")).toBe("ABC123");
  });

  it("returns null for undefined", () => {
    expect(parseRefPayload(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseRefPayload(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRefPayload("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseRefPayload("   ")).toBeNull();
  });

  it("returns null for unrelated payload without ref_ prefix", () => {
    expect(parseRefPayload("garbage")).toBeNull();
  });

  it("returns null for a bare ref_ prefix with no code", () => {
    expect(parseRefPayload("ref_")).toBeNull();
  });

  it("returns null when code contains invalid characters", () => {
    // Strict validation: invalid chars reject the whole payload (no cleaning)
    expect(parseRefPayload("ref_abc!@#")).toBeNull();
  });

  it("returns null for lowercase-only code (codes are uppercase)", () => {
    expect(parseRefPayload("ref_abcdef")).toBeNull();
  });

  it("returns null when code exceeds 32 chars", () => {
    const tooLong = "A".repeat(33);
    expect(parseRefPayload(`ref_${tooLong}`)).toBeNull();
  });

  it("accepts a code at the 32-char boundary", () => {
    const maxLen = "A".repeat(32);
    expect(parseRefPayload(`ref_${maxLen}`)).toBe(maxLen);
  });

  it("does not treat a payload merely containing ref_ as a referral", () => {
    expect(parseRefPayload("xref_ABC123")).toBeNull();
  });
});
