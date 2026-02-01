/**
 * Payment-related constants
 * Centralized mapping for YooKassa cancellation reasons to i18n keys
 */
import type { CancellationReason } from '../types/payment';

/**
 * Mapping of YooKassa cancellation reasons to i18n translation keys
 * Used in PaymentResult.tsx and potentially other payment-related components
 */
export const CANCELLATION_REASON_I18N_MAP: Record<CancellationReason, string> = {
  // Card issues
  insufficient_funds: 'payment.cancel.insufficient_funds',
  card_expired: 'payment.cancel.card_expired',
  invalid_card_number: 'payment.cancel.invalid_card_number',
  invalid_csc: 'payment.cancel.invalid_csc',
  invalid_expiry_month: 'payment.cancel.invalid_expiry_month',
  invalid_expiry_year: 'payment.cancel.invalid_expiry_year',
  // Security & fraud
  fraud_suspected: 'payment.cancel.fraud_suspected',
  '3d_secure_failed': 'payment.cancel.3d_secure_failed',
  // Generic
  general_decline: 'payment.cancel.general_decline',
  processing_error: 'payment.cancel.processing_error',
  // Merchant/permission
  canceled_by_merchant: 'payment.cancel.canceled_by_merchant',
  permission_revoked: 'payment.cancel.permission_revoked',
} as const;

/**
 * Default i18n key for unknown cancellation reasons
 */
export const CANCELLATION_UNKNOWN_I18N_KEY = 'payment.cancel.unknown';

/**
 * Get i18n key for a cancellation reason
 * Returns unknown key if reason is not in the map
 */
export function getCancellationI18nKey(reason: string | null): string {
  if (!reason) {
    return CANCELLATION_UNKNOWN_I18N_KEY;
  }
  return CANCELLATION_REASON_I18N_MAP[reason as CancellationReason] || CANCELLATION_UNKNOWN_I18N_KEY;
}

/**
 * All possible cancellation parties from YooKassa
 */
export type CancellationParty = 'yoo_money' | 'payment_network' | 'merchant';

/**
 * Human-readable labels for cancellation parties
 */
export const CANCELLATION_PARTY_LABELS: Record<CancellationParty, string> = {
  yoo_money: 'YooKassa',
  payment_network: 'Bank/Payment Network',
  merchant: 'Merchant',
} as const;
