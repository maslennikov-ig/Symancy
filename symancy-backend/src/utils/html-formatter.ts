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

/**
 * Sanitize HTML for Telegram compatibility
 *
 * Telegram only supports: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>,
 * <tg-spoiler>, <a>, <tg-emoji>, <code>, <pre>, <blockquote>
 *
 * This function replaces unsupported tags with safe equivalents:
 * - <br>, <br/>, <br /> → newline
 * - <p>...</p> → content + double newline
 * - <div>...</div> → content + newline
 * - <h1>-<h6> → <b>content</b> + newline
 * - Other unsupported tags → stripped (content preserved)
 *
 * @param html - HTML text potentially containing unsupported tags
 * @returns Telegram-safe HTML
 */
export function sanitizeTelegramHtml(html: string): string {
  let result = html;

  // Replace <br>, <br/>, <br /> with newline
  result = result.replace(/<br\s*\/?>/gi, "\n");

  // Replace <p>...</p> with content + double newline
  result = result.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

  // Replace <div>...</div> with content + newline
  result = result.replace(/<div\b[^>]*>([\s\S]*?)<\/div>/gi, "$1\n");

  // Replace <h1>-<h6> with bold + newline
  result = result.replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, "<b>$1</b>\n");

  // Strip remaining unsupported tags but keep content
  // Preserve: b, strong, i, em, u, ins, s, strike, del, tg-spoiler, a, tg-emoji, code, pre, blockquote
  const supportedTags = "b|strong|i|em|u|ins|s|strike|del|tg-spoiler|a|tg-emoji|code|pre|blockquote";
  const unsupportedTagRegex = new RegExp(
    `<\/?(?!(?:${supportedTags})\\b)[a-z][a-z0-9]*\\b[^>]*>`,
    "gi"
  );
  result = result.replace(unsupportedTagRegex, "");

  // Clean up excessive newlines (3+ → 2)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
