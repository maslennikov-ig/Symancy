/**
 * Sanitizes user display names to prevent UI manipulation attacks
 * - Removes control characters and zero-width chars
 * - Limits length to prevent UI overflow
 * - Provides fallback for empty names
 */
export function sanitizeDisplayName(name: string | null, fallback: string = 'No name'): string {
  if (!name || !name.trim()) return fallback;

  // Remove control characters, zero-width chars, and RTL override chars
  const sanitized = name
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
    .replace(/[\u200B-\u200D\u2028\u2029\uFEFF]/g, '') // Zero-width chars
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '') // RTL/LTR override chars
    .trim();

  // Limit length
  if (sanitized.length > 100) {
    return sanitized.slice(0, 97) + '...';
  }

  return sanitized || fallback;
}
