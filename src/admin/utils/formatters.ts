/**
 * Shared formatting utilities for admin panel
 * Extracted to avoid recreating formatters on every render
 */

// ============================================================================
// Currency and Number Formatters (created once, reused)
// ============================================================================

/**
 * Currency formatter for Russian Rubles (whole numbers)
 */
export const currencyFormatterRUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Currency formatter for USD (4 decimal places for cost tracking)
 */
export const currencyFormatterUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Number formatter for Russian locale
 */
export const numberFormatterRU = new Intl.NumberFormat('ru-RU');

/**
 * Number formatter for English locale
 */
export const numberFormatterEN = new Intl.NumberFormat('en-US');

// ============================================================================
// Date and Time Formatters
// ============================================================================

/**
 * Format a date string to relative time (e.g., "2 hours ago")
 * Includes validation for invalid dates and future dates
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return 'Invalid date';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates
  if (diffMs < 0) return 'In the future';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString('ru-RU');
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

/**
 * Format date to locale string with time
 */
export function formatDate(dateString: string | null, locale = 'ru-RU'): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return 'Invalid date';
  }

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date to short locale string (no time)
 */
export function formatDateShort(dateString: string | null, locale = 'ru-RU'): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return 'Invalid date';
  }

  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date to full locale string (for detail views)
 */
export function formatFullDate(dateString: string | null, locale = 'ru-RU'): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return 'Invalid date';
  }

  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Text Formatters
// ============================================================================

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ============================================================================
// Number Formatters (convenience wrappers)
// ============================================================================

/**
 * Format number with Russian locale
 */
export function formatNumber(num: number): string {
  return numberFormatterRU.format(num);
}

/**
 * Format number with English locale
 */
export function formatNumberEN(num: number): string {
  return numberFormatterEN.format(num);
}

/**
 * Format currency in RUB
 */
export function formatCurrencyRUB(amount: number): string {
  return currencyFormatterRUB.format(amount);
}

/**
 * Format currency in USD
 */
export function formatCurrencyUSD(amount: number): string {
  return currencyFormatterUSD.format(amount);
}

/**
 * Format milliseconds to human readable time
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
