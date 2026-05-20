/**
 * Inline keyboards for the compare-photos flow.
 *
 * Exposes:
 *  - "Cancel comparison" button (under intro / first-received messages)
 *  - Mode-selection menu for the unified `/compare` command
 *  - "Compare with a new cup" CTA shown under regular analysis results
 *  - Parsers for every compare callback variant (cmp:* family)
 *
 * Callback formats:
 *  - cmp:cancel                                  — cancel active compare session
 *  - cmp:mode:{dynamics|compatibility}           — mode picked from /compare menu
 *  - cmp:start_from:{analysisId}                 — user clicked the compare CTA
 *                                                  under an existing analysis
 *  - cmp:start_from_mode:{analysisId}:{mode}     — user picked a mode for the
 *                                                  "compare from analysis" flow
 *
 * All callback_data strings stay well within Telegram's 64-byte limit:
 *   "cmp:start_from_mode:" (20) + UUID (36) + ":" (1) + "compatibility" (13) = 70
 * UUIDs are exactly 36 chars, "compatibility" is the longest mode. Total = 70.
 * Telegram allows up to 64 bytes UTF-8, so we MUST shorten one side. We use a
 * compact mode token (d/c) to fit inside the limit. The parser maps it back.
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import type { CompareMode } from "../../types/job-schemas.js";
import { getBotMessage } from "../../services/i18n/index.js";

/**
 * Callback data for the cancel-compare button.
 * Kept short to stay well within Telegram's 64-byte callback_data limit.
 */
export const COMPARE_CANCEL_CALLBACK = "cmp:cancel";

/**
 * Prefix for the mode-selection callback from the unified `/compare` command.
 * Full form: `cmp:mode:{dynamics|compatibility}`.
 */
export const COMPARE_MODE_PREFIX = "cmp:mode:";

/**
 * Prefix for the "compare with a new cup" CTA shown under a finished analysis.
 * Full form: `cmp:start_from:{analysisId}`.
 */
export const COMPARE_START_FROM_PREFIX = "cmp:start_from:";

/**
 * Prefix for the mode-selection step of the "compare from analysis" flow.
 * Full form: `cmp:sfm:{analysisId}:{d|c}` — we use single-char mode tokens
 * (d=dynamics, c=compatibility) to fit Telegram's 64-byte callback_data
 * limit alongside a 36-char UUID.
 */
export const COMPARE_START_FROM_MODE_PREFIX = "cmp:sfm:";

/**
 * UUID v4 format regex for validating analysisId fragments.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map a short mode token (d/c) back to a CompareMode.
 */
function tokenToMode(token: string): CompareMode | null {
  if (token === "d") return "dynamics";
  if (token === "c") return "compatibility";
  return null;
}

/**
 * Map a CompareMode to its single-char callback token.
 */
function modeToToken(mode: CompareMode): "d" | "c" {
  return mode === "dynamics" ? "d" : "c";
}

/**
 * Build a keyboard with a single "Cancel comparison" inline button.
 *
 * @param language - User language code (ru, en, zh)
 */
export function createCancelCompareKeyboard(language: string = "ru"): InlineKeyboardMarkup {
  const label = getBotMessage("compare.cancelButton", language);
  return new InlineKeyboard().text(label, COMPARE_CANCEL_CALLBACK);
}

/**
 * Build the mode-selection keyboard for the unified `/compare` command.
 * Two buttons, stacked: dynamics + compatibility.
 *
 * @param language - User language code (ru, en, zh)
 */
export function createCompareModeKeyboard(
  language: string = "ru",
): InlineKeyboardMarkup {
  const dynamicsLabel = getBotMessage("compare.button.dynamics", language);
  const compatibilityLabel = getBotMessage("compare.button.compatibility", language);
  return new InlineKeyboard()
    .text(dynamicsLabel, `${COMPARE_MODE_PREFIX}dynamics`)
    .row()
    .text(compatibilityLabel, `${COMPARE_MODE_PREFIX}compatibility`);
}

/**
 * Build a single-row "Compare with a new cup" CTA shown under a finished
 * analysis. Clicking it opens the mode-selection menu via
 * createCompareFromAnalysisModeKeyboard.
 *
 * @param analysisId - UUID of the analysis_history row the CTA is attached to
 * @param language   - User language code
 */
export function createCompareFromAnalysisButton(
  analysisId: string,
  language: string = "ru",
): InlineKeyboardMarkup {
  const label = getBotMessage("compare.fromAnalysis.cta", language);
  return new InlineKeyboard().text(
    label,
    `${COMPARE_START_FROM_PREFIX}${analysisId}`,
  );
}

/**
 * Build the mini-menu that appears after the user clicks the
 * "Compare with a new cup" CTA. Two rows: dynamics / compatibility.
 *
 * @param analysisId - UUID of the analysis we are comparing FROM
 * @param language   - User language code
 */
export function createCompareFromAnalysisModeKeyboard(
  analysisId: string,
  language: string = "ru",
): InlineKeyboardMarkup {
  const dynamicsLabel = getBotMessage("compare.button.dynamics", language);
  const compatibilityLabel = getBotMessage("compare.button.compatibility", language);
  return new InlineKeyboard()
    .text(
      dynamicsLabel,
      `${COMPARE_START_FROM_MODE_PREFIX}${analysisId}:${modeToToken("dynamics")}`,
    )
    .row()
    .text(
      compatibilityLabel,
      `${COMPARE_START_FROM_MODE_PREFIX}${analysisId}:${modeToToken("compatibility")}`,
    );
}

/**
 * Check whether a callback_data string belongs to the compare module.
 */
export function isCompareCallback(data: string): boolean {
  return data.startsWith("cmp:");
}

/**
 * Parse a `cmp:mode:{mode}` callback emitted by the unified `/compare` menu.
 * Returns the chosen mode or null if the payload is malformed.
 */
export function parseCompareModeCallback(data: string): CompareMode | null {
  if (!data.startsWith(COMPARE_MODE_PREFIX)) return null;
  const value = data.slice(COMPARE_MODE_PREFIX.length);
  if (value === "dynamics" || value === "compatibility") {
    return value;
  }
  return null;
}

/**
 * Parse a `cmp:start_from:{analysisId}` callback emitted by the
 * "Compare with a new cup" CTA under a finished analysis.
 * Returns the validated analysisId or null on malformed payload.
 */
export function parseCompareStartFromCallback(data: string): string | null {
  if (!data.startsWith(COMPARE_START_FROM_PREFIX)) return null;
  const analysisId = data.slice(COMPARE_START_FROM_PREFIX.length);
  if (!analysisId || !UUID_REGEX.test(analysisId)) {
    return null;
  }
  return analysisId;
}

/**
 * Parse a `cmp:sfm:{analysisId}:{d|c}` callback emitted by the
 * "compare from analysis" mode picker. Returns the analysisId + mode or null.
 */
export function parseCompareStartFromModeCallback(data: string): {
  analysisId: string;
  mode: CompareMode;
} | null {
  if (!data.startsWith(COMPARE_START_FROM_MODE_PREFIX)) return null;

  const tail = data.slice(COMPARE_START_FROM_MODE_PREFIX.length);
  // Expected shape: "{UUID}:{token}" — UUIDs contain dashes but no colons.
  const lastColon = tail.lastIndexOf(":");
  if (lastColon <= 0) return null;

  const analysisId = tail.slice(0, lastColon);
  const token = tail.slice(lastColon + 1);

  if (!UUID_REGEX.test(analysisId)) return null;

  const mode = tokenToMode(token);
  if (!mode) return null;

  return { analysisId, mode };
}
