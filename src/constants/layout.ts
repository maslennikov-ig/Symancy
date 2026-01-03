/**
 * Layout Constants
 *
 * Shared constants for consistent layout across the application.
 *
 * @module constants/layout
 */

/**
 * Height of the bottom navigation bar in pixels
 * Compact size for better screen utilization
 */
export const BOTTOM_NAV_HEIGHT = 56;

/**
 * Total space needed for bottom nav + safe area padding
 * Used for bottom padding in scrollable content areas
 */
export const BOTTOM_NAV_TOTAL_SPACE = 72;

/**
 * Default safe area fallback values
 */
export const SAFE_AREA_FALLBACKS = {
  top: '0px',
  bottom: '0px',
  left: '0px',
  right: '0px',
} as const;

/**
 * CSS variable names for Telegram safe areas
 */
export const TG_SAFE_AREA_VARS = {
  top: '--tg-safe-area-inset-top',
  bottom: '--tg-safe-area-inset-bottom',
  left: '--tg-safe-area-inset-left',
  right: '--tg-safe-area-inset-right',
} as const;

/**
 * CSS variable names for Telegram content safe areas
 */
export const TG_CONTENT_SAFE_AREA_VARS = {
  top: '--tg-content-safe-area-inset-top',
  bottom: '--tg-content-safe-area-inset-bottom',
  left: '--tg-content-safe-area-inset-left',
  right: '--tg-content-safe-area-inset-right',
} as const;

/**
 * Z-index levels for layering
 */
export const Z_INDEX = {
  bottomNav: 1000,
  modal: 1100,
  dropdown: 1050,
  tooltip: 1200,
} as const;
