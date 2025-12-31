/**
 * Telegram WebApp Theme Utilities
 *
 * Shared utilities for binding Telegram theme parameters to CSS variables.
 * Used by both main.tsx (early initialization) and useTelegramWebApp hook.
 *
 * Fixes applied:
 * - HIGH-PERF-1: Batch CSS updates using cssText for single DOM write
 * - MEDIUM-QUALITY-1: Extracted shared logic to eliminate duplication
 *
 * @module utils/telegramTheme
 */

/**
 * Telegram WebApp theme parameters
 * @see https://core.telegram.org/bots/webapps#themeparams
 */
export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  // Bot API 8.0 additions
  bottom_bar_bg_color?: string;
  section_separator_color?: string;
}

/**
 * Safe area inset type (Bot API 8.0+)
 */
export interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Map of theme param keys to CSS variable names
 */
const THEME_CSS_MAPPING: Record<keyof ThemeParams, string> = {
  bg_color: '--tg-bg-color',
  text_color: '--tg-text-color',
  hint_color: '--tg-hint-color',
  link_color: '--tg-link-color',
  button_color: '--tg-button-color',
  button_text_color: '--tg-button-text-color',
  secondary_bg_color: '--tg-secondary-bg-color',
  header_bg_color: '--tg-header-bg-color',
  accent_text_color: '--tg-accent-text-color',
  section_bg_color: '--tg-section-bg-color',
  section_header_text_color: '--tg-section-header-text-color',
  subtitle_text_color: '--tg-subtitle-text-color',
  destructive_text_color: '--tg-destructive-text-color',
  bottom_bar_bg_color: '--tg-bottom-bar-bg-color',
  section_separator_color: '--tg-section-separator-color',
};

/**
 * Bind Telegram ThemeParams to CSS variables
 *
 * HIGH-PERF-1 FIX: Uses batched CSS updates via cssText to minimize DOM reflows.
 * Only updates changed values when previousTheme is provided.
 *
 * @param themeParams - Theme parameters from Telegram WebApp
 * @param previousTheme - Previous theme params for comparison (optional)
 * @returns The current theme params for future comparison
 *
 * @example
 * ```ts
 * // Initial binding
 * const theme = bindTelegramTheme(tg.themeParams);
 *
 * // Update with change detection
 * previousThemeRef.current = bindTelegramTheme(tg.themeParams, previousThemeRef.current);
 * ```
 */
export function bindTelegramTheme(
  themeParams: ThemeParams,
  previousTheme?: ThemeParams
): ThemeParams {
  const root = document.documentElement;
  const prev = previousTheme || {};

  // Collect all changes first (HIGH-PERF-1: avoid multiple DOM writes)
  const updates: string[] = [];

  (Object.keys(THEME_CSS_MAPPING) as Array<keyof ThemeParams>).forEach((key) => {
    const value = themeParams[key];
    const prevValue = prev[key];
    if (value && value !== prevValue) {
      updates.push(`${THEME_CSS_MAPPING[key]}: ${value}`);
    }
  });

  // HIGH-PERF-1 FIX: Single batch update using cssText
  if (updates.length > 0) {
    // Append to existing cssText to preserve other inline styles
    const currentCssText = root.style.cssText;
    const separator = currentCssText && !currentCssText.endsWith(';') ? '; ' : ' ';
    root.style.cssText = currentCssText + separator + updates.join('; ');
  }

  return { ...themeParams };
}

/**
 * Bind safe area insets to CSS variables
 * Creates --tg-safe-area-* CSS variables for iOS safe area handling
 *
 * LOW-2 FIX: More explicit default object pattern for clarity
 *
 * @param safeAreaInset - Safe area inset from Telegram WebApp (Bot API 8.0+)
 */
export function bindSafeAreaToCss(safeAreaInset: SafeAreaInset | undefined): void {
  const root = document.documentElement;
  const inset: SafeAreaInset = safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };

  // Use individual setProperty calls for safe area (only 4 values, minimal impact)
  root.style.setProperty('--tg-safe-area-top', `${inset.top}px`);
  root.style.setProperty('--tg-safe-area-bottom', `${inset.bottom}px`);
  root.style.setProperty('--tg-safe-area-left', `${inset.left}px`);
  root.style.setProperty('--tg-safe-area-right', `${inset.right}px`);
}

/**
 * Bind viewport dimensions to CSS variables
 *
 * @param viewportHeight - Current viewport height
 * @param viewportStableHeight - Stable viewport height (excludes keyboard)
 */
export function bindViewportToCss(viewportHeight: number, viewportStableHeight: number): void {
  const root = document.documentElement;
  root.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
  root.style.setProperty('--tg-viewport-stable-height', `${viewportStableHeight}px`);
}

/**
 * Initialize all Telegram CSS variables at once
 * Used for early initialization before React mounts
 *
 * @param tg - Telegram WebApp object
 */
export function initTelegramCssVariables(tg: {
  themeParams: ThemeParams;
  safeAreaInset?: SafeAreaInset;
  viewportHeight: number;
  viewportStableHeight: number;
}): void {
  bindTelegramTheme(tg.themeParams);
  bindSafeAreaToCss(tg.safeAreaInset);
  bindViewportToCss(tg.viewportHeight, tg.viewportStableHeight);
}
