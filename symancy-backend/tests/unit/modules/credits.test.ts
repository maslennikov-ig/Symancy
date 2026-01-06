/**
 * Unit tests for credits service
 * Tests credit checking, consumption, refunds, balance retrieval, and bonus grants
 *
 * NOTE: Service now checks unified_users.auth_id to determine if account is linked.
 * For linked accounts, uses user_credits table. For unlinked, uses backend_user_credits.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasCredits,
  consumeCredits,
  refundCredits,
  getCreditBalance,
  grantInitialCredits,
  FREE_TIER,
  clearLinkStatusCache,
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

/**
 * Helper: Create mock for unlinked user (no auth_id in unified_users)
 * This simulates a Telegram-only user who hasn't linked to web account
 */
function mockUnlinkedUser() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null, // No auth_id = unlinked
          error: null,
        }),
      }),
    }),
  };
}

/**
 * Helper: Create mock for backend_user_credits table
 */
function mockBackendCredits(credits: number | null, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: credits !== null ? { credits } : null,
          error,
        }),
      }),
    }),
  };
}

/**
 * Helper: Create mock for linked user (has auth_id in unified_users)
 */
function mockLinkedUser(authId: string = "test-auth-id-123") {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { auth_id: authId },
          error: null,
        }),
      }),
    }),
  };
}

/**
 * Helper: Create mock for user_credits table (linked accounts)
 */
function mockUserCredits(basicCredits: number | null, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: basicCredits !== null ? { basic_credits: basicCredits } : null,
          error,
        }),
      }),
    }),
  };
}

/**
 * Setup mock to return different values based on table name
 */
function setupTableMock(tableMocks: Record<string, unknown>) {
  mockSupabase.from.mockImplementation((tableName: string) => {
    return tableMocks[tableName] || mockUnlinkedUser();
  });
}

describe("Credits Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLinkStatusCache(); // Clear cache between tests
  });

  describe("hasCredits", () => {
    it("should return true when unlinked user has sufficient credits", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(10),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("unified_users");
      expect(mockSupabase.from).toHaveBeenCalledWith("backend_user_credits");
    });

    it("should return true when unlinked user has exact amount of credits", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(5),
      });

      const result = await hasCredits(123456, 5);

      expect(result).toBe(true);
    });

    it("should return false when unlinked user has insufficient credits", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(0),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("should return false when unlinked user has less than required amount", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(3),
      });

      const result = await hasCredits(123456, 5);

      expect(result).toBe(false);
    });

    it("should return false when database error occurs", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null, { message: "Database connection failed" }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("should return false when user not found", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null),
      });

      const result = await hasCredits(999999);

      expect(result).toBe(false);
    });

    it("should check against default amount of 1", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(1),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(true);
    });

    it("should check against specified amount", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(15),
      });

      const result = await hasCredits(123456, 10);

      expect(result).toBe(true);
    });

    it("should query unified_users first to check link status", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(10),
      });

      await hasCredits(789012);

      // First call should be to unified_users
      expect(mockSupabase.from.mock.calls[0][0]).toBe("unified_users");
    });
  });

  describe("consumeCredits", () => {
    it("should return true on successful consumption for unlinked user", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Insufficient credits" },
      });

      const result = await consumeCredits(123456);

      expect(result).toBe(false);
    });

    it("should call RPC with correct parameters for unlinked user", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
    it("should return true on successful refund for unlinked user", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "User not found" },
      });

      const result = await refundCredits(123456);

      expect(result).toBe(false);
    });

    it("should call RPC with correct parameters for unlinked user", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
    it("should return credit balance for unlinked user", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(25),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(25);
      expect(mockSupabase.from).toHaveBeenCalledWith("unified_users");
      expect(mockSupabase.from).toHaveBeenCalledWith("backend_user_credits");
    });

    it("should return 0 when user not found", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null),
      });

      const result = await getCreditBalance(999999);

      expect(result).toBe(0);
    });

    it("should return 0 on database error", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null, { message: "Connection timeout" }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });

    it("should query unified_users first to check link status", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(10),
      });

      await getCreditBalance(789012);

      // First call should be to unified_users
      expect(mockSupabase.from.mock.calls[0][0]).toBe("unified_users");
    });

    it("should handle user with zero credits", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(0),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });
  });

  describe("Linked Account Operations", () => {
    describe("hasCredits - linked account", () => {
      it("should return true when linked user has sufficient credits", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
          user_credits: mockUserCredits(10),
        });

        const result = await hasCredits(123456);

        expect(result).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith("unified_users");
        expect(mockSupabase.from).toHaveBeenCalledWith("user_credits");
      });

      it("should return false when linked user has insufficient credits", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
          user_credits: mockUserCredits(0),
        });

        const result = await hasCredits(123456, 5);

        expect(result).toBe(false);
      });

      it("should return false when user_credits record not found", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
          user_credits: mockUserCredits(null),
        });

        const result = await hasCredits(123456);

        expect(result).toBe(false);
      });
    });

    describe("consumeCredits - linked account", () => {
      it("should consume from user_credits via RPC when account is linked", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 9, // Remaining credits
          error: null,
        });

        const result = await consumeCredits(123456, 1);

        expect(result).toBe(true);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_linked_credits", {
          p_user_id: "auth-123",
          p_amount: 1,
        });
      });

      it("should return false when RPC returns -1 (insufficient credits)", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
        });
        mockSupabase.rpc.mockResolvedValue({
          data: -1, // Insufficient credits
          error: null,
        });

        const result = await consumeCredits(123456, 10);

        expect(result).toBe(false);
      });

      it("should return false when RPC fails", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
        });
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        });

        const result = await consumeCredits(123456, 1);

        expect(result).toBe(false);
      });
    });

    describe("refundCredits - linked account", () => {
      it("should refund to user_credits via RPC when account is linked", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 11, // New balance after refund
          error: null,
        });

        const result = await refundCredits(123456, 1);

        expect(result).toBe(true);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("refund_linked_credits", {
          p_user_id: "auth-123",
          p_amount: 1,
        });
      });

      it("should return false when RPC fails", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
        });
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: "User not found" },
        });

        const result = await refundCredits(123456, 1);

        expect(result).toBe(false);
      });
    });

    describe("getCreditBalance - linked account", () => {
      it("should return balance from user_credits when account is linked", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
          user_credits: mockUserCredits(50),
        });

        const result = await getCreditBalance(123456);

        expect(result).toBe(50);
      });

      it("should return 0 when user_credits record not found", async () => {
        setupTableMock({
          unified_users: mockLinkedUser("auth-123"),
          user_credits: mockUserCredits(null),
        });

        const result = await getCreditBalance(123456);

        expect(result).toBe(0);
      });
    });
  });

  describe("Input Validation", () => {
    it("hasCredits should reject invalid telegramUserId", async () => {
      const result1 = await hasCredits(-1);
      const result2 = await hasCredits(0);
      const result3 = await hasCredits(1.5);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it("hasCredits should reject invalid amount", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(10),
      });

      const result1 = await hasCredits(123456, -1);
      const result2 = await hasCredits(123456, 0);
      const result3 = await hasCredits(123456, 1.5);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it("consumeCredits should reject invalid inputs", async () => {
      const result1 = await consumeCredits(-1);
      const result2 = await consumeCredits(123456, -5);
      const result3 = await consumeCredits(123456, 0);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it("refundCredits should reject invalid inputs", async () => {
      const result1 = await refundCredits(-1);
      const result2 = await refundCredits(123456, -5);
      const result3 = await refundCredits(123456, 0);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it("getCreditBalance should reject invalid telegramUserId", async () => {
      const result1 = await getCreditBalance(-1);
      const result2 = await getCreditBalance(0);

      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });
  });

  describe("getAccountLinkStatus error handling", () => {
    it("should treat PGRST116 (not found) as unlinked", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "Row not found" },
            }),
          }),
        }),
      });
      mockSupabase.rpc.mockResolvedValue({ data: 10, error: null });

      // Should proceed to backend_user_credits (unlinked path)
      const result = await consumeCredits(123456, 1);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", expect.any(Object));
    });

    it("should treat database errors as unlinked (graceful degradation)", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST500", message: "Database connection failed" },
            }),
          }),
        }),
      });
      mockSupabase.rpc.mockResolvedValue({ data: 10, error: null });

      // Should proceed to backend_user_credits (unlinked path as fallback)
      const result = await consumeCredits(123456, 1);

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("consume_credits", expect.any(Object));
    });
  });

  describe("Edge cases and error handling", () => {
    it("hasCredits should handle negative credit amounts", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(-5), // Edge case: negative credits
      });

      const result = await hasCredits(123456, 1);

      expect(result).toBe(false);
    });

    it("refundCredits should handle large amounts", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
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
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(999999999),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(999999999);
    });
  });

  describe("Error handling with logger", () => {
    it("hasCredits should return false on database error", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null, { message: "DB Error" }),
      });

      const result = await hasCredits(123456);

      expect(result).toBe(false);
    });

    it("consumeCredits should return false on error", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Insufficient credits" },
      });

      const result = await consumeCredits(123456, 5);

      expect(result).toBe(false);
    });

    it("refundCredits should return false on error", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
      });
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "User not found" },
      });

      const result = await refundCredits(123456, 3);

      expect(result).toBe(false);
    });

    it("getCreditBalance should return 0 on error", async () => {
      setupTableMock({
        unified_users: mockUnlinkedUser(),
        backend_user_credits: mockBackendCredits(null, { message: "Connection timeout" }),
      });

      const result = await getCreditBalance(123456);

      expect(result).toBe(0);
    });
  });

  describe("grantInitialCredits", () => {
    describe("successful grant", () => {
      it("should grant credits on first call", async () => {
        // Mock: no existing record
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null, // No existing record
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 1, // New balance
          error: null,
        });

        const result = await grantInitialCredits(123456);

        expect(result).toEqual({
          success: true,
          balance: 1,
          alreadyGranted: false,
        });
        expect(mockSupabase.rpc).toHaveBeenCalledWith("grant_initial_credits", {
          p_telegram_user_id: 123456,
          p_amount: 1,
        });
      });

      it("should grant custom amount", async () => {
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 5,
          error: null,
        });

        const result = await grantInitialCredits(123456, 5);

        expect(result.success).toBe(true);
        expect(result.balance).toBe(5);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("grant_initial_credits", {
          p_telegram_user_id: 123456,
          p_amount: 5,
        });
      });
    });

    describe("idempotency", () => {
      it("should return alreadyGranted=true on subsequent calls", async () => {
        // Mock: existing record with free_credit_granted=true
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { credits: 1, free_credit_granted: true },
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 1, // Same balance (idempotent)
          error: null,
        });

        const result = await grantInitialCredits(123456);

        expect(result).toEqual({
          success: true,
          balance: 1,
          alreadyGranted: true,
        });
      });
    });

    describe("input validation", () => {
      it("should reject invalid telegramUserId (negative)", async () => {
        const result = await grantInitialCredits(-1);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Invalid user ID",
        });
      });

      it("should reject invalid telegramUserId (zero)", async () => {
        const result = await grantInitialCredits(0);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Invalid user ID",
        });
      });

      it("should reject invalid telegramUserId (decimal)", async () => {
        const result = await grantInitialCredits(1.5);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Invalid user ID",
        });
      });

      it("should reject invalid amount (negative)", async () => {
        const result = await grantInitialCredits(123456, -1);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Invalid credit amount",
        });
      });

      it("should reject invalid amount (zero)", async () => {
        const result = await grantInitialCredits(123456, 0);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Invalid credit amount",
        });
      });

      it("should reject amount exceeding MAX_FREE_GRANT", async () => {
        const result = await grantInitialCredits(123456, 11);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: `Amount exceeds max free tier (${FREE_TIER.MAX_FREE_GRANT})`,
        });
      });

      it("should accept amount at MAX_FREE_GRANT limit", async () => {
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: 10,
          error: null,
        });

        const result = await grantInitialCredits(123456, 10);

        expect(result.success).toBe(true);
        expect(result.balance).toBe(10);
      });
    });

    describe("error handling", () => {
      it("should handle RPC error with 'Invalid' message", async () => {
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: "Invalid telegram_user_id: -1" },
        });

        const result = await grantInitialCredits(123456);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid");
      });

      it("should handle generic database error", async () => {
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: "Connection timeout" },
        });

        const result = await grantInitialCredits(123456);

        expect(result).toEqual({
          success: false,
          balance: 0,
          alreadyGranted: false,
          error: "Connection timeout",
        });
      });

      it("should preserve existing balance on error", async () => {
        setupTableMock({
          unified_users: mockUnlinkedUser(),
          backend_user_credits: {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { credits: 5, free_credit_granted: false },
                  error: null,
                }),
              }),
            }),
          },
        });
        mockSupabase.rpc.mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        });

        const result = await grantInitialCredits(123456);

        expect(result.success).toBe(false);
        expect(result.balance).toBe(5);
      });
    });

    describe("FREE_TIER constant", () => {
      it("should have correct ONBOARDING_BONUS value", () => {
        expect(FREE_TIER.ONBOARDING_BONUS).toBe(1);
      });

      it("should have correct MAX_FREE_GRANT value", () => {
        expect(FREE_TIER.MAX_FREE_GRANT).toBe(10);
      });
    });
  });
});
