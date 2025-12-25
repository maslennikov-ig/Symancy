/**
 * HTML Formatter for Telegram
 *
 * Safe HTML escaping and formatting for Telegram messages
 * Per TZ: Telegram supports HTML formatting (bold, italic, code, pre, links)
 */

/**
 * Escape HTML special characters for Telegram
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format text as bold
 *
 * @param text - Text to format
 * @returns Bold HTML tag
 */
export function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`;
}

/**
 * Format text as italic
 *
 * @param text - Text to format
 * @returns Italic HTML tag
 */
export function italic(text: string): string {
  return `<i>${escapeHtml(text)}</i>`;
}

/**
 * Format text as code
 *
 * @param text - Text to format
 * @returns Code HTML tag
 */
export function code(text: string): string {
  return `<code>${escapeHtml(text)}</code>`;
}

/**
 * Format text as preformatted block
 *
 * @param text - Text to format
 * @param language - Optional language for syntax highlighting
 * @returns Pre HTML tag
 */
export function pre(text: string, language?: string): string {
  if (language) {
    return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
  }
  return `<pre>${escapeHtml(text)}</pre>`;
}

/**
 * Create a link
 *
 * @param text - Link text to display
 * @param url - URL to link to
 * @returns Anchor HTML tag
 */
export function link(text: string, url: string): string {
  return `<a href="${url}">${escapeHtml(text)}</a>`;
}
