/**
 * Telegram WebApp Theme Utilities
 *
 * Shared utilities for binding Telegram theme parameters to CSS variables.
 * Used by both main.tsx (early initialization) and useTelegramWebApp hook.
 *
 * Fixes applied:
 * - HIGH-PERF-1: Batch CSS updates using cssText for single DOM write
 * - MEDIUM-QUALITY-1: Extracted shared logic to eliminate duplication
 * - QUALITY-TELEGRAM-SDK: Uses official Telegram SDK to bind CSS vars in sync with WebApp rules
 *
 * @module utils/telegramTheme
 */
import {
  bindThemeParamsCssVars,
  init as initTelegramSdk,
  isThemeParamsCssVarsBound,
  isThemeParamsMounted,
  mountThemeParamsSync,
} from '@telegram-apps/sdk';

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

// NOTE: previously this file contained a TAILWIND_COLOR_MAPPING that overwrote
// our --foreground / --background / --primary / --border / etc. with Telegram's
// themeParams converted to HSL, written inline on <html>. Inline style always
// beats :root{} and .dark{}, so if Telegram sent a text_color that was close in
// lightness to bg_color (Telegram does NOT guarantee contrast, see
// https://core.telegram.org/bots/webapps — ThemeParams spec), headings became
// unreadable (sym-mod). We now rely exclusively on our own HSL palette driven
// by the .dark / .light class on <html>. Only raw --tg-* vars are exposed for
// components that want to explicitly match Telegram chrome.

const hslCache = new Map<string, string>();

let sdkInitialized = false;
let themeCssVarsCleanup: VoidFunction | null = null;

function ensureTelegramSdkInitialized(): void {
  if (sdkInitialized) return;
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) return;

  // Only try to init SDK if we have valid launch params (initData present)
  // SDK throws LaunchParamsRetrieveError if opened outside Telegram or without initData
  const webApp = window.Telegram.WebApp;
  if (!webApp.initData || webApp.initData.length === 0) {
    // Skip SDK init - we're in Telegram but without initData (e.g., direct link)
    // This is expected and not an error
    return;
  }

  try {
    initTelegramSdk();
    sdkInitialized = true;
  } catch (error) {
    // Silently ignore LaunchParamsRetrieveError - expected when initData is empty/invalid
    // Only log unexpected errors
    if (error instanceof Error && !error.message.includes('LaunchParams')) {
      console.warn('[Telegram SDK] init failed:', error);
    }
  }
}

function ensureOfficialThemeBinding(): void {
  if (!sdkInitialized) return;

  try {
    if (mountThemeParamsSync.isAvailable() && !isThemeParamsMounted()) {
      mountThemeParamsSync();
    }

    if (
      !themeCssVarsCleanup &&
      bindThemeParamsCssVars.isAvailable() &&
      !isThemeParamsCssVarsBound()
    ) {
      themeCssVarsCleanup = bindThemeParamsCssVars();
    }
  } catch (error) {
    console.warn('[Telegram SDK] theme binding failed:', error);
  }
}

function normalizeHexColor(hexColor?: string): string | null {
  if (!hexColor) return null;
  const trimmed = hexColor.trim();
  if (!trimmed) return null;

  let value = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (!/^[\da-fA-F]{6}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Number(value.toFixed(2));
  return `${rounded}`;
}

function formatPercent(value: number): string {
  const clamped = Math.min(Math.max(value, 0), 1);
  return `${formatNumber(clamped * 100)}%`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;

  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / delta) % 6;
      break;
    case gNorm:
      h = (bNorm - rNorm) / delta + 2;
      break;
    default:
      h = (rNorm - gNorm) / delta + 4;
      break;
  }

  h *= 60;
  if (h < 0) {
    h += 360;
  }

  return { h, s, l };
}

function hexToHslComponents(hexColor?: string): string | null {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return null;

  const cached = hslCache.get(normalized);
  if (cached) return cached;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const { h, s, l } = rgbToHsl(r, g, b);

  const result = `${formatNumber((h + 360) % 360)} ${formatPercent(s)} ${formatPercent(l)}`;
  hslCache.set(normalized, result);
  return result;
}

function pickThemeColor(theme: ThemeParams, sources: Array<keyof ThemeParams>): string | null {
  for (const key of sources) {
    const value = theme[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

/**
 * Detect whether a hex color represents a "dark" surface (lightness < 0.5).
 * Used as a fallback for Telegram Mini App theme detection when `colorScheme`
 * is unreliable: some clients report `light` while actually sending a dark
 * `bg_color` via themeParams (sym-mod).
 *
 * Returns `null` if the input is not a valid hex color.
 */
export function isDarkColor(hexColor: string | undefined): boolean | null {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const { l } = rgbToHsl(r, g, b);
  return l < 0.5;
}

/**
 * Resolve the effective color scheme ('light' | 'dark') for a Telegram WebApp.
 *
 * Priority:
 *   1. If `themeParams.bg_color` is set, use its lightness (most reliable —
 *      it's the actual painted background).
 *   2. Otherwise fall back to `colorScheme` if explicit 'dark' or 'light'.
 *   3. Otherwise system preference via `matchMedia`.
 *   4. Last resort: 'light'.
 */
export function resolveColorScheme(tg: {
  colorScheme?: string;
  themeParams?: ThemeParams;
} | null | undefined): 'light' | 'dark' {
  const bgDark = isDarkColor(tg?.themeParams?.bg_color);
  if (bgDark !== null) return bgDark ? 'dark' : 'light';

  const scheme = tg?.colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme;

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

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
  ensureTelegramSdkInitialized();
  ensureOfficialThemeBinding();

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

  // sym-mod: removed TAILWIND_COLOR_MAPPING loop that overwrote our palette
  // inline. Our --background / --foreground / etc. stay strictly controlled by
  // .dark / .light class + :root rules in index.css.

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
  ensureTelegramSdkInitialized();
  ensureOfficialThemeBinding();

  bindTelegramTheme(tg.themeParams);
  bindSafeAreaToCss(tg.safeAreaInset);
  bindViewportToCss(tg.viewportHeight, tg.viewportStableHeight);
}
