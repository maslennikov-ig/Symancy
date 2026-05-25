/**
 * Streak-at-Risk Trigger (Gamification, sym-tb3)
 *
 * Finds users who have an active streak (>= 2 consecutive days) but have NOT
 * been active yet today, so their streak is at risk of resetting at midnight.
 * Sends a motivating nudge encouraging them to do a reading and keep the streak.
 *
 * Mirrors the structure of triggers/inactive.ts:
 * - A finder that returns proactive-eligible users
 * - An AI-backed message generator with a safe localized fallback
 *
 * Scheduled for the evening (see scheduler.ts) so the reminder lands while the
 * user still has time to act before the day rolls over.
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";
import { createModel } from "../../../core/langchain/models.js";
import { MODEL_ARINA_BASIC } from "../../../config/constants.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { ProactiveEligibleUser } from "../../../services/proactive/index.js";

const logger = getLogger().child({ module: "engagement-streak-at-risk" });

/** Minimum current streak (in days) before we consider it worth protecting. */
const MIN_STREAK_TO_PROTECT = 2;

/** Localized fallback messages used when AI generation fails. */
const FALLBACK_MESSAGES: Record<string, (name: string, streak: number) => string> = {
  ru: (name, streak) =>
    `🔥 ${name}, ваша серия — ${streak} ${pluralizeDaysRu(streak)} подряд!\n\nНе теряйте её сегодня. Сделайте расклад на кофейной гуще и продлите серию ✨`,
  en: (name, streak) =>
    `🔥 ${name}, you're on a ${streak}-day streak!\n\nDon't break it today — send a photo of your coffee grounds and keep the fire going ✨`,
  zh: (name, streak) =>
    `🔥 ${name}，您已连续 ${streak} 天！\n\n别让连续记录在今天中断 — 发送咖啡渣照片，延续您的火焰吧 ✨`,
};

/**
 * Minimal Russian pluralization for "день/дня/дней".
 */
function pluralizeDaysRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

/**
 * Embedded unified_users shape from the join.
 */
interface RawUnifiedUser {
  id: string;
  telegram_id: number | null;
  display_name: string | null;
  language_code: string | null;
  last_active_at: string | null;
  is_telegram_linked: boolean | null;
  is_banned: boolean | null;
  onboarding_completed: boolean | null;
  notification_settings: { enabled?: boolean; reminders_enabled?: boolean } | null;
}

/**
 * Raw joined row from user_streaks + unified_users.
 *
 * supabase-js types embedded relations as arrays even for a to-one FK, so we
 * normalize via `firstUser()` before use.
 */
interface RawStreakAtRiskRow {
  current_streak: number;
  unified_users: RawUnifiedUser | RawUnifiedUser[] | null;
}

/**
 * Normalize the embedded relation (array or object) to a single user or null.
 */
function firstUser(rel: RawStreakAtRiskRow["unified_users"]): RawUnifiedUser | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/**
 * A streak-at-risk user paired with their current streak length, so the
 * message generator can mention the exact number of days at stake.
 */
export interface StreakAtRiskUser {
  user: ProactiveEligibleUser;
  currentStreak: number;
}

/**
 * Find users whose streak is at risk of resetting today.
 *
 * Criteria:
 * - current_streak >= MIN_STREAK_TO_PROTECT
 * - last_activity_date < today (no streak-counting activity yet today)
 * - linked Telegram, not banned, onboarding completed
 * - notifications not explicitly disabled
 * - not already nudged today (engagement_log)
 *
 * @returns Array of streak-at-risk users (eligible user + current streak)
 */
export async function findStreakAtRiskUsers(): Promise<StreakAtRiskUser[]> {
  const supabase = getSupabase();
  logger.debug("Finding users with streaks at risk");

  const today = new Date().toISOString().split("T")[0]!;

  // Join unified_users to get delivery + eligibility info in one query.
  const { data: rows, error } = await supabase
    .from("user_streaks")
    .select(
      `current_streak,
       unified_users:unified_user_id (
         id, telegram_id, display_name, language_code, last_active_at,
         is_telegram_linked, is_banned, onboarding_completed, notification_settings
       )`
    )
    .gte("current_streak", MIN_STREAK_TO_PROTECT)
    .lt("last_activity_date", today);

  if (error) {
    logger.error({ error }, "Failed to find streak-at-risk users");
    throw new Error(`Failed to find streak-at-risk users: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    logger.info("No streak-at-risk users found");
    return [];
  }

  // Normalize embedded relation + filter on eligibility flags and notification
  // settings (JSONB null = enabled), keeping the streak count alongside each user.
  const eligible = (rows as unknown as RawStreakAtRiskRow[])
    .map((row) => ({ currentStreak: row.current_streak, user: firstUser(row.unified_users) }))
    .filter(
      (entry): entry is { currentStreak: number; user: RawUnifiedUser } => {
        const u = entry.user;
        return (
          !!u &&
          u.telegram_id != null &&
          u.is_telegram_linked === true &&
          u.is_banned !== true &&
          u.onboarding_completed === true &&
          u.notification_settings?.enabled !== false &&
          u.notification_settings?.reminders_enabled !== false
        );
      }
    );

  if (eligible.length === 0) {
    logger.info("No eligible streak-at-risk users after filtering");
    return [];
  }

  // Exclude users already nudged today.
  const { data: sentToday, error: logError } = await supabase
    .from("engagement_log")
    .select("telegram_id")
    .eq("message_type", "streak-at-risk")
    .gte("sent_at", `${today}T00:00:00Z`);

  if (logError) {
    logger.warn({ error: logError }, "Failed to check engagement log, continuing");
  }

  const sentTodayIds = new Set(sentToday?.map((log) => log.telegram_id) ?? []);

  const result: StreakAtRiskUser[] = eligible
    .filter((entry) => !sentTodayIds.has(entry.user.telegram_id))
    .map((entry) => {
      const u = entry.user;
      return {
        currentStreak: entry.currentStreak,
        user: {
          id: u.id,
          telegramId: u.telegram_id as number,
          displayName: u.display_name,
          languageCode: u.language_code ?? "ru",
          lastActiveAt: u.last_active_at ? new Date(u.last_active_at) : new Date(),
        },
      };
    });

  logger.info({ count: result.length }, "Found streak-at-risk users");
  return result;
}

/**
 * Create a streak-at-risk nudge message.
 *
 * @param userName - User's display name (or null)
 * @param currentStreak - Current consecutive-day streak
 * @param languageCode - User language ("ru" | "en" | "zh"), defaults to "ru"
 * @returns Localized motivating message
 */
export async function createStreakAtRiskMessage(
  userName: string | null,
  currentStreak: number,
  languageCode = "ru"
): Promise<string> {
  const lang = ["ru", "en", "zh"].includes(languageCode) ? languageCode : "ru";
  const name = userName || (lang === "ru" ? "друг" : lang === "zh" ? "朋友" : "friend");
  const fallback = (FALLBACK_MESSAGES[lang] ?? FALLBACK_MESSAGES.ru!)(name, currentStreak);

  // Only generate AI variants for Russian (primary audience); keep cost low.
  if (lang !== "ru") {
    return fallback;
  }

  try {
    const model = createModel(MODEL_ARINA_BASIC, { temperature: 0.9, maxTokens: 150 });
    const response = await model.invoke([
      new SystemMessage(
        "Ты — дружелюбная и слегка загадочная гадалка на кофейной гуще. Напиши короткое, тёплое " +
          "и мотивирующее сообщение пользователю, у которого есть серия ежедневных раскладов, и сегодня " +
          "он ещё не делал расклад — серия может прерваться. Обязательно упомяни длину серии (число дней) " +
          "и имя (если есть), подбодри и предложи сделать расклад прямо сейчас, чтобы сохранить серию. " +
          "Используй эмодзи 🔥 и ✨. Не более 3 предложений."
      ),
      new HumanMessage(
        `Имя пользователя: ${name}. Текущая серия: ${currentStreak} ${pluralizeDaysRu(currentStreak)} подряд.`
      ),
    ]);

    const text = (response.content as string).trim();
    return text.length > 0 ? text : fallback;
  } catch (error) {
    logger.error({ error }, "Failed to generate AI streak-at-risk message, using fallback");
    return fallback;
  }
}
