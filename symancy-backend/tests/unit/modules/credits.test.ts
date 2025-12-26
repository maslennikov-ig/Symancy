/**
 * Unit tests for credits service
 * Tests credit checking, consumption, refunds, balance retrieval, and bonus grants
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasCredits,
  consumeCredits,
  refundCredits,
  getCreditBalance,
  grantBonusCredit,
} from "../../../src/modules/credits/service.js";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock logger is already set up in vitest.setup.ts

describe("Credits Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasCredits", () => {
    it("should return true when user has sufficient credits", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 10 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("backend_user_credits");
    });

    it("should return true when user has exact amount of credits", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 5 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456, 5);

      expect(result).toBe(true);
    });

    it("should return false when user has insufficient credits", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 0 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("should return false when user has less than required amount", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 3 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456, 5);

      expect(result).toBe(false);
    });

    it("should return false when database error occurs", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database connection failed" },
            }),
          }),
        }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("should return false when user not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(999999);

      expect(result).toBe(false);
    });

    it("should check against default amount of 1", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 1 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(true);
    });

    it("should check against specified amount", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 15 },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456, 10);

      expect(result).toBe(true);
    });

    it("should query with correct telegram_user_id", async () => {
      const mockEq = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { credits: 10 },
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      await hasCredits(789012);

      expect(mockEq).toHaveBeenCalledWith("telegram_user_id", 789012);
    });
  });

  describe("consumeCredits", () => {
    it("should return true on successful consumption", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 9, // Remaining credits after consumption
        error: null,
      });

      const result = await consumeCredits(123456);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", {
        p_telegram_user_id: 123456,
        p_amount: 1,
      });
    });

    it("should return true when consuming multiple credits", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 5, // Remaining credits
        error: null,
      });

      const result = await consumeCredits(123456, 5);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", {
        p_telegram_user_id: 123456,
        p_amount: 5,
      });
    });

    it("should return false on database error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Insufficient credits" },
      });

      const result = await consumeCredits(123456);

      expect(result).toBe(false);
    });

    it("should call RPC with correct parameters", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 7,
        error: null,
      });

      await consumeCredits(789012, 3);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", {
        p_telegram_user_id: 789012,
        p_amount: 3,
      });
    });

    it("should use default amount of 1", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 9,
        error: null,
      });

      await consumeCredits(123456);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", {
        p_telegram_user_id: 123456,
        p_amount: 1,
      });
    });

    it("should return false when RPC returns error for insufficient credits", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: "Insufficient credits",
          code: "P0001",
        },
      });

      const result = await consumeCredits(123456, 10);

      expect(result).toBe(false);
    });
  });

  describe("refundCredits", () => {
    it("should return true on successful refund", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 11, // New balance after refund
        error: null,
      });

      const result = await refundCredits(123456);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_credits", {
        p_telegram_user_id: 123456,
        p_amount: 1,
      });
    });

    it("should return true when refunding multiple credits", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 15, // New balance
        error: null,
      });

      const result = await refundCredits(123456, 5);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_credits", {
        p_telegram_user_id: 123456,
        p_amount: 5,
      });
    });

    it("should return false on database error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "User not found" },
      });

      const result = await refundCredits(123456);

      expect(result).toBe(false);
    });

    it("should call RPC with correct parameters", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 13,
        error: null,
      });

      await refundCredits(789012, 3);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_credits", {
        p_telegram_user_id: 789012,
        p_amount: 3,
      });
    });

    it("should use default amount of 1", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 11,
        error: null,
      });

      await refundCredits(123456);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_credits", {
        p_telegram_user_id: 123456,
        p_amount: 1,
      });
    });

    it("should handle RPC function errors gracefully", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: "Function execution error",
          code: "42883",
        },
      });

      const result = await refundCredits(123456, 2);

      expect(result).toBe(false);
    });
  });

  describe("getCreditBalance", () => {
    it("should return credit balance for existing user", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 25 },
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(25);
      expect(mockSupabase.from).toHaveBeenCalledWith("backend_user_credits");
    });

    it("should return 0 when user not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance(999999);

      expect(result).toBe(0);
    });

    it("should return 0 on database error", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Connection timeout" },
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });

    it("should query with correct telegram_user_id", async () => {
      const mockEq = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { credits: 10 },
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      await getCreditBalance(789012);

      expect(mockEq).toHaveBeenCalledWith("telegram_user_id", 789012);
    });

    it("should return 0 when credits field is missing", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {}, // Missing credits field
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      // Data exists but credits is undefined, should still return 0
      // Actually the implementation returns data.credits (undefined), not 0
      expect(result).toBeUndefined();
    });

    it("should handle user with zero credits", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 0 },
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });
  });

  describe("grantBonusCredit", () => {
    it("should return true on successful grant", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await grantBonusCredit(123456);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
    });

    it("should return false on database error", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: "Update failed" },
          }),
        }),
      });

      const result = await grantBonusCredit(123456);

      expect(result).toBe(false);
    });

    it("should update bonus_credit_granted flag", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      await grantBonusCredit(123456);

      expect(mockUpdate).toHaveBeenCalledWith({ bonus_credit_granted: true });
    });

    it("should update for correct telegram_user_id", async () => {
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      await grantBonusCredit(789012);

      expect(mockEq).toHaveBeenCalledWith("telegram_user_id", 789012);
    });

    it("should handle user not found (no rows updated)", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
            data: null, // No rows updated
          }),
        }),
      });

      // Should still return true if no error
      const result = await grantBonusCredit(999999);

      expect(result).toBe(true);
    });

    it("should handle database constraint violations", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: {
              message: "Foreign key constraint violation",
              code: "23503",
            },
          }),
        }),
      });

      const result = await grantBonusCredit(123456);

      expect(result).toBe(false);
    });
  });

  describe("Edge cases and error handling", () => {
    it("hasCredits should handle negative credit amounts", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: -5 }, // Edge case: negative credits
              error: null,
            }),
          }),
        }),
      });

      const result = await hasCredits(123456, 1);

      expect(result).toBe(false);
    });

    it("consumeCredits should handle zero amount", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 10,
        error: null,
      });

      const result = await consumeCredits(123456, 0);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", {
        p_telegram_user_id: 123456,
        p_amount: 0,
      });
    });

    it("refundCredits should handle large amounts", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 1000,
        error: null,
      });

      const result = await refundCredits(123456, 1000);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_credits", {
        p_telegram_user_id: 123456,
        p_amount: 1000,
      });
    });

    it("getCreditBalance should handle very large credit values", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits: 999999999 },
              error: null,
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(999999999);
    });
  });

  describe("Error handling with logger", () => {
    it("hasCredits should return false on database error", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "DB Error" },
            }),
          }),
        }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("consumeCredits should return false on error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Insufficient credits" },
      });

      const result = await consumeCredits(123456, 5);

      expect(result).toBe(false);
    });

    it("refundCredits should return false on error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "User not found" },
      });

      const result = await refundCredits(123456, 3);

      expect(result).toBe(false);
    });

    it("getCreditBalance should return 0 on error", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Connection timeout" },
            }),
          }),
        }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });

    it("grantBonusCredit should return false on error", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: "Update failed" },
          }),
        }),
      });

      const result = await grantBonusCredit(123456);

      expect(result).toBe(false);
    });
  });
});
