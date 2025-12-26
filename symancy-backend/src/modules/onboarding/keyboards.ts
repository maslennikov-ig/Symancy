/**
 * Inline keyboards for onboarding flow
 * Provides multi-select goals keyboard and timezone selection
 */
import { InlineKeyboard } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";

/**
 * Available user goals with labels and emojis
 */
export const GOAL_OPTIONS = [
  { key: "career", label: "Карьера", emoji: "🎯" },
  { key: "relationships", label: "Отношения", emoji: "❤️" },
  { key: "health", label: "Здоровье", emoji: "🏥" },
  { key: "finances", label: "Финансы", emoji: "💰" },
  { key: "spiritual", label: "Духовный рост", emoji: "🌟" },
] as const;

/**
 * Available timezone options for Russian regions
 */
export const TIMEZONE_OPTIONS = [
  { key: "Europe/Moscow", label: "Москва", utc: "UTC+3" },
  { key: "Europe/Samara", label: "Самара", utc: "UTC+4" },
  { key: "Asia/Yekaterinburg", label: "Екатеринбург", utc: "UTC+5" },
  { key: "Asia/Novosibirsk", label: "Новосибирск", utc: "UTC+7" },
  { key: "Asia/Vladivostok", label: "Владивосток", utc: "UTC+10" },
] as const;

/**
 * Onboarding messages for use in nodes
 */
export const ONBOARDING_MESSAGES = {
  selectGoals: "Какие сферы жизни вас интересуют? Выберите одну или несколько:",
  selectTimezone: "В каком часовом поясе вы находитесь?",
  goalsUpdated: "Отлично! Вы выбрали: {{goals}}",
  timezoneSet: "Часовой пояс установлен: {{timezone}}",
} as const;

/**
 * Get goal label with selection indicator
 *
 * @param goal - Goal key (career, relationships, etc.)
 * @param selected - Whether the goal is currently selected
 * @returns Formatted label with emoji and checkmark if selected
 */
export function getGoalLabel(goal: string, selected: boolean): string {
  const option = GOAL_OPTIONS.find((opt) => opt.key === goal);

  if (!option) {
    return goal;
  }

  const checkmark = selected ? "✓ " : "";
  return `${checkmark}${option.emoji} ${option.label}`;
}

/**
 * Create goals selection keyboard with toggle state
 * Each goal is a button that can be toggled on/off
 * Selected goals show a checkmark
 *
 * @param selectedGoals - Array of currently selected goal keys
 * @returns InlineKeyboardMarkup for grammY bot
 */
export function createGoalsKeyboard(
  selectedGoals: string[] = []
): InlineKeyboardMarkup {
  const keyboard = new InlineKeyboard();

  // Add each goal as a toggleable button
  for (const option of GOAL_OPTIONS) {
    const isSelected = selectedGoals.includes(option.key);
    const label = getGoalLabel(option.key, isSelected);

    keyboard.text(label, `onboarding:goal:${option.key}`);
    keyboard.row(); // Each goal on its own row for better readability
  }

  // Add confirm button only if at least one goal is selected
  if (selectedGoals.length > 0) {
    keyboard.text("✅ Готово", "onboarding:goals:confirm");
  }

  return keyboard;
}

/**
 * Create timezone selection keyboard
 * Includes main Russian timezones and a skip option
 *
 * @returns InlineKeyboardMarkup for grammY bot
 */
export function createTimezoneKeyboard(): InlineKeyboardMarkup {
  const keyboard = new InlineKeyboard();

  // Add each timezone option
  for (const tz of TIMEZONE_OPTIONS) {
    keyboard.text(
      `${tz.label} (${tz.utc})`,
      `onboarding:tz:${tz.key}`
    );
    keyboard.row();
  }

  // Add skip option (defaults to Moscow time)
  keyboard.text("⏭ Пропустить", "onboarding:tz:skip");

  return keyboard;
}

/**
 * Parse onboarding callback data
 * Format: onboarding:{type}:{value}
 *
 * Examples:
 * - "onboarding:goal:career" → { type: "goal", value: "career" }
 * - "onboarding:goals:confirm" → { type: "goals", value: "confirm" }
 * - "onboarding:tz:Europe/Moscow" → { type: "tz", value: "Europe/Moscow" }
 * - "onboarding:tz:skip" → { type: "tz", value: "skip" }
 *
 * @param data - Callback data string from Telegram
 * @returns Parsed object with type and value, or null if invalid
 */
export function parseOnboardingCallback(data: string): {
  type: "goal" | "goals" | "tz";
  value: string;
} | null {
  // Validate format
  if (!data.startsWith("onboarding:")) {
    return null;
  }

  // Split and extract parts
  const parts = data.split(":");

  if (parts.length < 3) {
    return null;
  }

  const type = parts[1];
  const value = parts.slice(2).join(":"); // Rejoin in case of colons in timezone (e.g., Europe/Moscow)

  // Validate type
  if (type !== "goal" && type !== "goals" && type !== "tz") {
    return null;
  }

  return { type, value };
}
