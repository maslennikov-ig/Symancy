/**
 * Unit tests for payment constants
 *
 * Tests the CANCELLATION_REASON_I18N_MAP to ensure all CancellationReason values
 * have corresponding i18n keys and follow the correct naming pattern.
 *
 * @module constants/__tests__/payment.test
 */
import { describe, it, expect } from 'vitest';
import {
  CANCELLATION_REASON_I18N_MAP,
  CANCELLATION_UNKNOWN_I18N_KEY,
  getCancellationI18nKey,
  CANCELLATION_PARTY_LABELS
} from '../payment';
import type { CancellationReason } from '@/types/payment';

describe('CANCELLATION_REASON_I18N_MAP', () => {
  it('should have entries for all CancellationReason values', () => {
    // All CancellationReason values from types/payment.ts
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
      expect(CANCELLATION_REASON_I18N_MAP[reason]).toBeDefined();
      expect(CANCELLATION_REASON_I18N_MAP[reason]).toContain('payment.cancel.');
    });
  });

  it('should have exactly 12 entries matching CancellationReason count', () => {
    const entries = Object.keys(CANCELLATION_REASON_I18N_MAP);
    expect(entries).toHaveLength(12);
  });

  it('should follow i18n key pattern "payment.cancel.*"', () => {
    Object.values(CANCELLATION_REASON_I18N_MAP).forEach((i18nKey) => {
      expect(i18nKey).toMatch(/^payment\.cancel\./);
    });
  });

  describe('Card issues', () => {
    it('should map insufficient_funds correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.insufficient_funds).toBe('payment.cancel.insufficient_funds');
    });

    it('should map card_expired correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.card_expired).toBe('payment.cancel.card_expired');
    });

    it('should map invalid_card_number correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.invalid_card_number).toBe('payment.cancel.invalid_card_number');
    });

    it('should map invalid_csc correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.invalid_csc).toBe('payment.cancel.invalid_csc');
    });

    it('should map invalid_expiry_month correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.invalid_expiry_month).toBe('payment.cancel.invalid_expiry_month');
    });

    it('should map invalid_expiry_year correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.invalid_expiry_year).toBe('payment.cancel.invalid_expiry_year');
    });
  });

  describe('Security & fraud', () => {
    it('should map fraud_suspected correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.fraud_suspected).toBe('payment.cancel.fraud_suspected');
    });

    it('should map 3d_secure_failed correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP['3d_secure_failed']).toBe('payment.cancel.3d_secure_failed');
    });
  });

  describe('Generic reasons', () => {
    it('should map general_decline correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.general_decline).toBe('payment.cancel.general_decline');
    });

    it('should map processing_error correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.processing_error).toBe('payment.cancel.processing_error');
    });
  });

  describe('Merchant/permission', () => {
    it('should map canceled_by_merchant correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.canceled_by_merchant).toBe('payment.cancel.canceled_by_merchant');
    });

    it('should map permission_revoked correctly', () => {
      expect(CANCELLATION_REASON_I18N_MAP.permission_revoked).toBe('payment.cancel.permission_revoked');
    });
  });
});

describe('CANCELLATION_UNKNOWN_I18N_KEY', () => {
  it('should be defined with correct value', () => {
    expect(CANCELLATION_UNKNOWN_I18N_KEY).toBe('payment.cancel.unknown');
  });

  it('should follow i18n key pattern "payment.cancel.*"', () => {
    expect(CANCELLATION_UNKNOWN_I18N_KEY).toMatch(/^payment\.cancel\./);
  });
});

describe('getCancellationI18nKey', () => {
  it('should return correct i18n key for valid cancellation reason', () => {
    expect(getCancellationI18nKey('insufficient_funds')).toBe('payment.cancel.insufficient_funds');
    expect(getCancellationI18nKey('card_expired')).toBe('payment.cancel.card_expired');
    expect(getCancellationI18nKey('fraud_suspected')).toBe('payment.cancel.fraud_suspected');
    expect(getCancellationI18nKey('3d_secure_failed')).toBe('payment.cancel.3d_secure_failed');
  });

  it('should return unknown key for null reason', () => {
    expect(getCancellationI18nKey(null)).toBe('payment.cancel.unknown');
  });

  it('should return unknown key for undefined reason', () => {
    expect(getCancellationI18nKey(undefined as any)).toBe('payment.cancel.unknown');
  });

  it('should return unknown key for empty string reason', () => {
    expect(getCancellationI18nKey('')).toBe('payment.cancel.unknown');
  });

  it('should return unknown key for invalid reason', () => {
    expect(getCancellationI18nKey('invalid_reason_xyz')).toBe('payment.cancel.unknown');
    expect(getCancellationI18nKey('random_string')).toBe('payment.cancel.unknown');
  });

  it('should handle all valid CancellationReason values', () => {
    const validReasons: CancellationReason[] = [
      'insufficient_funds',
      'card_expired',
      'invalid_card_number',
      'invalid_csc',
      'invalid_expiry_month',
      'invalid_expiry_year',
      'fraud_suspected',
      '3d_secure_failed',
      'general_decline',
      'processing_error',
      'canceled_by_merchant',
      'permission_revoked',
    ];

    validReasons.forEach((reason) => {
      const i18nKey = getCancellationI18nKey(reason);
      expect(i18nKey).toMatch(/^payment\.cancel\./);
      expect(i18nKey).not.toBe('payment.cancel.unknown');
    });
  });
});

describe('CANCELLATION_PARTY_LABELS', () => {
  it('should have labels for all cancellation parties', () => {
    expect(CANCELLATION_PARTY_LABELS.yoo_money).toBe('YooKassa');
    expect(CANCELLATION_PARTY_LABELS.payment_network).toBe('Bank/Payment Network');
    expect(CANCELLATION_PARTY_LABELS.merchant).toBe('Merchant');
  });

  it('should have exactly 3 entries', () => {
    const entries = Object.keys(CANCELLATION_PARTY_LABELS);
    expect(entries).toHaveLength(3);
  });
});

describe('Integration - CANCELLATION_REASON_I18N_MAP with i18n system', () => {
  it('should only use i18n keys that match the naming convention', () => {
    // Verify all keys follow pattern: payment.cancel.{reason}
    Object.entries(CANCELLATION_REASON_I18N_MAP).forEach(([reason, i18nKey]) => {
      // Keys should be in format: payment.cancel.{snake_case}
      expect(i18nKey).toMatch(/^payment\.cancel\.[a-z0-9_]+$/);

      // Key suffix should relate to the reason (for most cases)
      // Exception: '3d_secure_failed' has special character handling
      if (reason !== '3d_secure_failed') {
        expect(i18nKey).toContain(reason);
      }
    });
  });

  it('should have unique i18n keys for all reasons', () => {
    const i18nKeys = Object.values(CANCELLATION_REASON_I18N_MAP);
    const uniqueKeys = new Set(i18nKeys);

    expect(uniqueKeys.size).toBe(i18nKeys.length);
  });
});
