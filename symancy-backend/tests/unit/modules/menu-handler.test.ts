/**
 * Unit tests for the main-menu reply-keyboard handler.
 *
 * What we cover here:
 *  - `matchMenuButton`:
 *      • each of the 8 actions × 3 locales (24 cases) → expected MenuAction
 *      • empty / unrelated text → null
 *      • whitespace tolerance
 *  - `handleMainMenuText`:
 *      • dispatches to the right command handler for each action
 *      • returns true on match, false on miss
 *      • compare-session conflict: warns instead of dispatching for most
 *        actions, lets `compare` and `help` through
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// grammy mock — must be declared BEFORE imports that pull from grammy.
// We give Keyboard / InlineKeyboard a tiny chainable surface area so that
// `createMainMenuKeyboard` and the buy-button fallback work without a real
// Telegram client.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("grammy", () => {
  class MockKeyboard {
    text() { return this; }
    webApp() { return this; }
    row() { return this; }
    resized() { return this; }
    persistent() { return this; }
    placeholder() { return this; }
  }
  class MockInlineKeyboard {
    text() { return this; }
    webApp() { return this; }
    url() { return this; }
    row() { return this; }
  }
  return { Keyboard: MockKeyboard, InlineKeyboard: MockInlineKeyboard };
});

// All module-level mock state must be created inside `vi.hoisted` because
// `vi.mock` factories are hoisted to the top of the file and would otherwise
// see uninitialised TDZ bindings.
const hoisted = vi.hoisted(() => {
  return {
    env: { WEBAPP_URL: undefined as string | undefined },
    compareActive: { value: false },
    handlers: {
      help: vi.fn(),
      credits: vi.fn(),
      history: vi.fn(),
      cassandra: vi.fn(),
      compare: vi.fn(),
      mood: vi.fn(),
    },
    supabase: { from: vi.fn() },
  };
});

vi.mock("../../../src/config/env.js", () => ({
  getEnv: vi.fn(() => hoisted.env),
}));

vi.mock("../../../src/core/database.js", () => ({
  getSupabase: vi.fn(() => hoisted.supabase),
}));

vi.mock("../../../src/modules/router/commands.js", () => ({
  handleHelpCommand: hoisted.handlers.help,
  handleCreditsCommand: hoisted.handlers.credits,
  handleHistoryCommand: hoisted.handlers.history,
  handleCassandraCommand: hoisted.handlers.cassandra,
  handleCompareCommand: hoisted.handlers.compare,
}));
vi.mock("../../../src/modules/mood/handler.js", () => ({
  handleMoodCommand: hoisted.handlers.mood,
}));

vi.mock("../../../src/modules/compare/handler.js", () => ({
  isCompareSessionActive: vi.fn(async () => hoisted.compareActive.value),
}));

// Convenience aliases for the readability of the assertions below.
const mockHandleHelp = hoisted.handlers.help;
const mockHandleCredits = hoisted.handlers.credits;
const mockHandleHistory = hoisted.handlers.history;
const mockHandleCassandra = hoisted.handlers.cassandra;
const mockHandleCompare = hoisted.handlers.compare;
const mockHandleMood = hoisted.handlers.mood;
const mockEnv = hoisted.env;

// Imports come AFTER all vi.mock() declarations.
import {
  handleMainMenuText,
  matchMenuButton,
  _resetMenuLabelIndex,
} from "../../../src/modules/menu/handler.js";
import type { MenuAction } from "../../../src/modules/menu/keyboards.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test data: button label → expected action per locale.
// Keep these literal strings in lockstep with services/i18n/bot-messages.ts.
// If the i18n table changes, these expectations must change too — that's the
// point: a localization regression breaks the menu silently otherwise.
// ─────────────────────────────────────────────────────────────────────────────
const LOCALIZED_LABELS: Record<
  "ru" | "en" | "zh",
  Record<MenuAction, string>
> = {
  ru: {
    predict: "📷 Гадание",
    compare: "⚖️ Сравнить",
    cassandra: "🔮 Кассандра",
    history: "📜 История",
    credits: "💰 Баланс",
    buy: "🎁 Купить",
    mood: "🌙 Настроение",
    help: "ℹ️ Помощь",
  },
  en: {
    predict: "📷 Reading",
    compare: "⚖️ Compare",
    cassandra: "🔮 Cassandra",
    history: "📜 History",
    credits: "💰 Balance",
    buy: "🎁 Buy",
    mood: "🌙 Mood",
    help: "ℹ️ Help",
  },
  zh: {
    predict: "📷 占卜",
    compare: "⚖️ 比较",
    cassandra: "🔮 卡桑德拉",
    history: "📜 历史",
    credits: "💰 余额",
    buy: "🎁 购买",
    mood: "🌙 心情",
    help: "ℹ️ 帮助",
  },
};

// Helper: build a minimal BotContext stub the handler can read.
function makeCtx(text: string | undefined, telegramUserId: number = 42) {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    reply,
    message: text === undefined ? undefined : { text },
    from: { id: telegramUserId, language_code: "ru" },
    profile: { language_code: "ru" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock behaviours need to be re-attached after clearAllMocks
  // (which also clears `mockReturnValue`).
  for (const fn of Object.values(hoisted.handlers)) {
    fn.mockResolvedValue(undefined);
  }
  hoisted.compareActive.value = false;
  mockEnv.WEBAPP_URL = undefined;
  _resetMenuLabelIndex();
});

// ─────────────────────────────────────────────────────────────────────────────
// matchMenuButton — 8 actions × 3 locales = 24 cases.
// ─────────────────────────────────────────────────────────────────────────────
describe("matchMenuButton", () => {
  describe("recognised labels", () => {
    for (const lang of ["ru", "en", "zh"] as const) {
      for (const action of Object.keys(LOCALIZED_LABELS[lang]) as MenuAction[]) {
        const label = LOCALIZED_LABELS[lang][action];
        it(`matches "${label}" (${lang}) → ${action}`, () => {
          expect(matchMenuButton(label)).toBe(action);
        });
      }
    }
  });

  describe("unrelated input returns null", () => {
    it("empty string → null", () => {
      expect(matchMenuButton("")).toBeNull();
    });

    it("random text → null", () => {
      expect(matchMenuButton("hello world")).toBeNull();
    });

    it("partial button label → null", () => {
      // We require exact match — partial substrings must not trigger the menu.
      expect(matchMenuButton("Гадание")).toBeNull();
    });

    it("emoji-only → null", () => {
      expect(matchMenuButton("📷")).toBeNull();
    });
  });

  describe("whitespace tolerance", () => {
    it("leading whitespace is trimmed", () => {
      expect(matchMenuButton("   📷 Гадание")).toBe("predict");
    });
    it("trailing whitespace is trimmed", () => {
      expect(matchMenuButton("ℹ️ Помощь   ")).toBe("help");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleMainMenuText — dispatch table & return value.
// ─────────────────────────────────────────────────────────────────────────────
describe("handleMainMenuText", () => {
  it("returns false for non-text update", async () => {
    const ctx = makeCtx(undefined);
    expect(await handleMainMenuText(ctx)).toBe(false);
  });

  it("returns false for unrelated text", async () => {
    const ctx = makeCtx("какой-то обычный текст");
    expect(await handleMainMenuText(ctx)).toBe(false);
    expect(mockHandleHelp).not.toHaveBeenCalled();
    expect(mockHandleCredits).not.toHaveBeenCalled();
  });

  it("dispatches 'predict' → ctx.reply with prompt", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.predict);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [msg] = ctx.reply.mock.calls[0];
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("dispatches 'compare' → handleCompareCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.en.compare);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleCompare).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'cassandra' → handleCassandraCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.zh.cassandra);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleCassandra).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'history' → handleHistoryCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.history);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleHistory).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'credits' → handleCreditsCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.en.credits);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleCredits).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'mood' → handleMoodCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.zh.mood);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleMood).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'help' → handleHelpCommand", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.help);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleHelp).toHaveBeenCalledWith(ctx);
  });

  it("dispatches 'buy' (no WEBAPP_URL) → ctx.reply with inline URL keyboard", async () => {
    // WEBAPP_URL stays unset → buildPricingUrl returns the public fallback URL.
    const ctx = makeCtx(LOCALIZED_LABELS.ru.buy);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [msg, options] = ctx.reply.mock.calls[0];
    expect(typeof msg).toBe("string");
    expect(options).toBeDefined();
    expect(options.reply_markup).toBeDefined();
  });

  it("dispatches 'buy' (with WEBAPP_URL) → ctx.reply with inline web_app keyboard", async () => {
    mockEnv.WEBAPP_URL = "https://app.example.com";
    const ctx = makeCtx(LOCALIZED_LABELS.en.buy);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [, options] = ctx.reply.mock.calls[0];
    expect(options.reply_markup).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compare-session conflict resolution.
// ─────────────────────────────────────────────────────────────────────────────
describe("handleMainMenuText (active compare session)", () => {
  beforeEach(() => {
    hoisted.compareActive.value = true;
  });

  it("'predict' is blocked with a warning, NOT dispatched", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.predict);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    // We expect ONE reply — the warning — and no command dispatch.
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(mockHandleCompare).not.toHaveBeenCalled();
  });

  it("'cassandra' is blocked", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.en.cassandra);
    await handleMainMenuText(ctx);
    expect(mockHandleCassandra).not.toHaveBeenCalled();
  });

  it("'history' is blocked", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.zh.history);
    await handleMainMenuText(ctx);
    expect(mockHandleHistory).not.toHaveBeenCalled();
  });

  it("'credits' is blocked", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.credits);
    await handleMainMenuText(ctx);
    expect(mockHandleCredits).not.toHaveBeenCalled();
  });

  it("'mood' is blocked", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.en.mood);
    await handleMainMenuText(ctx);
    expect(mockHandleMood).not.toHaveBeenCalled();
  });

  it("'buy' is blocked", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.zh.buy);
    await handleMainMenuText(ctx);
    // No InlineKeyboard reply with a URL — just the warning.
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it("'compare' still works (whitelisted as safe)", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.ru.compare);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleCompare).toHaveBeenCalledWith(ctx);
  });

  it("'help' still works (whitelisted as safe)", async () => {
    const ctx = makeCtx(LOCALIZED_LABELS.en.help);
    const consumed = await handleMainMenuText(ctx);
    expect(consumed).toBe(true);
    expect(mockHandleHelp).toHaveBeenCalledWith(ctx);
  });
});
