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
 * @param dateString - ISO date string
 * @param t - Optional translation function for i18n support
 */
export function formatRelativeTime(
  dateString: string | null,
  t?: (key: string) => string
): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return t?.('time.invalidDate') || 'Invalid';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates
  if (diffMs < 0) return t?.('time.future') || 'Future';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString('ru-RU');
  }
  if (diffDays > 0) {
    const template = t?.('time.daysAgo') || '{n}d ago';
    return template.replace('{n}', String(diffDays));
  }
  if (diffHours > 0) {
    const template = t?.('time.hoursAgo') || '{n}h ago';
    return template.replace('{n}', String(diffHours));
  }
  if (diffMins > 0) {
    const template = t?.('time.minutesAgo') || '{n}m ago';
    return template.replace('{n}', String(diffMins));
  }
  return t?.('time.justNow') || 'Just now';
}

/**
 * Format date to locale string with time
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (default: 'ru-RU')
 * @param t - Optional translation function for error messages
 */
export function formatDate(
  dateString: string | null,
  locale = 'ru-RU',
  t?: (key: string) => string
): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return t?.('time.invalidDate') || 'Invalid';
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
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (default: 'ru-RU')
 * @param t - Optional translation function for error messages
 */
export function formatDateShort(
  dateString: string | null,
  locale = 'ru-RU',
  t?: (key: string) => string
): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return t?.('time.invalidDate') || 'Invalid';
  }

  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date to full locale string (for detail views)
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (default: 'ru-RU')
 * @param t - Optional translation function for error messages
 */
export function formatFullDate(
  dateString: string | null,
  locale = 'ru-RU',
  t?: (key: string) => string
): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`);
    return t?.('time.invalidDate') || 'Invalid';
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
