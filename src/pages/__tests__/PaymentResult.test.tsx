/**
 * Unit tests for PaymentResult component
 *
 * Tests the cancellation message logic in the PaymentResult component,
 * focusing on the getCancellationMessage() function behavior with different
 * cancellation reasons and loading states.
 *
 * @module pages/__tests__/PaymentResult.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { CancellationReason } from '@/types/payment';

// Create mock functions inside the factory to avoid hoisting issues
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

// Mock supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Import after mock is set up
const { default: PaymentResult } = await import('../PaymentResult');

// Helper to render component with URL params
const renderWithParams = (params: Record<string, string>) => {
  const searchParams = new URLSearchParams(params).toString();
  const initialEntry = `/payment-result?${searchParams}`;

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PaymentResult language="en" t={(key) => key as string} />
    </MemoryRouter>
  );
};

describe('PaymentResult - Cancellation Message Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCancellationMessage - Loading State', () => {
    it('should show "..." while loading cancellation reason from database', async () => {
      // Mock slow database response
      mockSingle.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: { cancellation_reason: 'insufficient_funds' } }), 100);
          })
      );

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      // Should show loading indicator initially
      expect(screen.getByText('...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('...')).not.toBeInTheDocument();
      });
    });
  });

  describe('getCancellationMessage - No Reason Provided', () => {
    it('should fallback to "payment.result.canceled.subtitle" when cancellation_reason is null', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: null } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
      });
    });

    it('should fallback to "payment.result.canceled.subtitle" when database returns no data', async () => {
      mockSingle.mockResolvedValue({ data: null });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
      });
    });

    it('should fallback to "payment.result.canceled.subtitle" when no purchase_id in URL', () => {
      renderWithParams({ status: 'canceled' });

      // Should immediately show fallback (no database call)
      expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('getCancellationMessage - Valid Cancellation Reasons', () => {
    it('should return correct i18n key for "insufficient_funds"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'insufficient_funds' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.insufficient_funds')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "card_expired"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'card_expired' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.card_expired')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "fraud_suspected"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'fraud_suspected' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.fraud_suspected')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "3d_secure_failed"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: '3d_secure_failed' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.3d_secure_failed')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "general_decline"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'general_decline' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.general_decline')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "invalid_card_number"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'invalid_card_number' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.invalid_card_number')).toBeInTheDocument();
      });
    });

    it('should return correct i18n key for "processing_error"', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'processing_error' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.processing_error')).toBeInTheDocument();
      });
    });
  });

  describe('getCancellationMessage - Unknown Cancellation Reasons', () => {
    it('should fallback to "payment.cancel.unknown" for unknown reason', async () => {
      // Mock database returning an unknown reason
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'unknown_reason_xyz' as CancellationReason } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        expect(screen.getByText('payment.cancel.unknown')).toBeInTheDocument();
      });
    });

    it('should fallback to "payment.result.canceled.subtitle" for empty string reason', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: '' } });

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        // Empty string is falsy, so should use default subtitle
        expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
      });
    });
  });

  describe('getCancellationMessage - Database Error Handling', () => {
    it('should handle database errors gracefully and show fallback message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSingle.mockRejectedValue(new Error('Database connection failed'));

      renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

      await waitFor(() => {
        // Should show fallback after error
        expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching cancellation reason:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Database Query - Supabase Integration', () => {
    it('should call supabase with correct purchase_id', async () => {
      mockSingle.mockResolvedValue({ data: { cancellation_reason: 'insufficient_funds' } });

      renderWithParams({ status: 'canceled', purchase_id: 'purchase_abc123' });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('purchases');
        expect(mockSelect).toHaveBeenCalledWith('cancellation_reason');
        expect(mockEq).toHaveBeenCalledWith('id', 'purchase_abc123');
        expect(mockSingle).toHaveBeenCalled();
      });
    });

    it('should not call supabase when status is not "canceled"', () => {
      renderWithParams({ status: 'success', purchase_id: 'test_purchase_123' });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should not call supabase when purchase_id is missing', () => {
      renderWithParams({ status: 'canceled' });

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('All CancellationReason Values Coverage', () => {
    const allReasons: CancellationReason[] = [
      // Card issues
      'insufficient_funds',
      'card_expired',
      'invalid_card_number',
      'invalid_csc',
      'invalid_expiry_month',
      'invalid_expiry_year',
      // Security & fraud
      'fraud_suspected',
      '3d_secure_failed',
      // Generic
      'general_decline',
      'processing_error',
      // Merchant/permission
      'canceled_by_merchant',
      'permission_revoked',
    ];

    allReasons.forEach((reason) => {
      it(`should handle "${reason}" cancellation reason correctly`, async () => {
        mockSingle.mockResolvedValue({ data: { cancellation_reason: reason } });

        renderWithParams({ status: 'canceled', purchase_id: 'test_purchase_123' });

        await waitFor(() => {
          // Should show the specific i18n key for this reason
          expect(screen.getByText(`payment.cancel.${reason}`)).toBeInTheDocument();
        });
      });
    });
  });
});

describe('PaymentResult - Success Status', () => {
  it('should not fetch cancellation reason for successful payments', () => {
    renderWithParams({ status: 'success', purchase_id: 'test_purchase_123' });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(screen.getByText('payment.result.success.subtitle')).toBeInTheDocument();
  });
});

describe('PaymentResult - Unknown Status', () => {
  it('should not fetch cancellation reason for unknown payment status', () => {
    renderWithParams({ status: 'unknown' });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(screen.getByText('payment.result.unknown.subtitle')).toBeInTheDocument();
  });
});

describe('PaymentResult - Component Rendering States', () => {
  it('should show canceled title for canceled status', () => {
    renderWithParams({ status: 'canceled' });

    expect(screen.getByText('payment.result.canceled.title')).toBeInTheDocument();
  });

  it('should show success title for success status', () => {
    renderWithParams({ status: 'success' });

    expect(screen.getByText('payment.result.success.title')).toBeInTheDocument();
  });

  it('should show appropriate icon for canceled status', () => {
    renderWithParams({ status: 'canceled' });

    const icon = screen.getByRole('img');
    expect(icon).toHaveTextContent('❌');
  });
});

describe('PaymentResult - Auto-detect Status from DB (no status param)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show pending state initially when only purchase_id is provided', () => {
    mockSingle.mockResolvedValue({ data: { status: 'pending', cancellation_reason: null } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    expect(screen.getByText('payment.result.pending.title')).toBeInTheDocument();
    expect(screen.getByText('payment.result.pending.subtitle')).toBeInTheDocument();
  });

  it('should fetch purchase status from DB when no status param', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'succeeded', cancellation_reason: null } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('purchases');
      expect(mockSelect).toHaveBeenCalledWith('status, cancellation_reason');
      expect(mockEq).toHaveBeenCalledWith('id', 'test_purchase_456');
    });
  });

  it('should show success when DB returns succeeded status', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'succeeded', cancellation_reason: null } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(screen.getByText('payment.result.success.title')).toBeInTheDocument();
    });
  });

  it('should show canceled with cancellation reason when DB returns canceled', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'canceled', cancellation_reason: 'fraud_suspected' } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(screen.getByText('payment.result.canceled.title')).toBeInTheDocument();
      expect(screen.getByText('payment.cancel.fraud_suspected')).toBeInTheDocument();
    });
  });

  it('should show canceled with general_decline reason from DB', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'canceled', cancellation_reason: 'general_decline' } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(screen.getByText('payment.result.canceled.title')).toBeInTheDocument();
      expect(screen.getByText('payment.cancel.general_decline')).toBeInTheDocument();
    });
  });

  it('should show canceled with fallback subtitle when reason is null', async () => {
    mockSingle.mockResolvedValue({ data: { status: 'canceled', cancellation_reason: null } });

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(screen.getByText('payment.result.canceled.title')).toBeInTheDocument();
      expect(screen.getByText('payment.result.canceled.subtitle')).toBeInTheDocument();
    });
  });

  it('should not call supabase when neither status nor purchase_id provided', () => {
    renderWithParams({});

    expect(mockFrom).not.toHaveBeenCalled();
    expect(screen.getByText('payment.result.unknown.title')).toBeInTheDocument();
  });

  it('should handle DB error gracefully during auto-detection', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSingle.mockRejectedValue(new Error('DB error'));

    renderWithParams({ purchase_id: 'test_purchase_456' });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});

