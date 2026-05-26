/**
 * Trial-Nudge Trigger (Trial follow-up, sym-6ga / sym-9gy — approach B)
 *
 * "Trial" = the one-time WELCOME_GIFT credits (granted once via
 * `unified_user_credits.free_credit_granted`). When those welcome credits run
 * low or run out there is no proactive follow-up nudging the user to buy. This
 * scheduled finder reads `unified_user_credits` (the single source of truth,
 * independent of which channel — Telegram or web Edge functions — drained the
 * balance) and surfaces users whose welcome balance has crossed to:
 *   - `low`  → total welcome balance === 1
 *   - `zero` → total welcome balance === 0
 *
 * Mirrors the structure of triggers/streak-at-risk.ts:
 * - A finder that returns proactive-eligible users (+ their stage)
 * - An AI-backed message generator with a safe localized fallback
 *
 * KEY DIFFERENCE vs streak-at-risk: dedup is ALL-TIME (no date filter). Each
 * stage (`trial-low`, `trial-zero`) fires at most once per user, ever — so the
 * finder checks `engagement_log` for any prior row of that `message_type`.
 *
 * Scheduled hourly (see scheduler.ts) for full-channel coverage with bounded
 * (~1h) latency.
 */
import { getSupabase } from "../../../core/database.js";
import { getLogger } from "../../../core/logger.js";
import { createModel } from "../../../core/langchain/models.js";
import { MODEL_ARINA_BASIC } from "../../../config/constants.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { ProactiveEligibleUser } from "../../../services/proactive/index.js";

const logger = getLogger().child({ module: "engagement-trial-nudge" });

/** Trial nudge stages, keyed off the remaining welcome-credit total. */
export type TrialNudgeStage = "low" | "zero";

/**
 * A trial-nudge user paired with the stage they qualify for, so the message
 * generator and `engagement_log` dedup can use the correct `trial-<stage>` key.
 */
export interface TrialNudgeUser {
  user: ProactiveEligibleUser;
  stage: TrialNudgeStage;
}

/**
 * Embedded unified_users shape from the join.
 */
interface RawUnifiedUser {
  id: string;
  telegram_id: number | null;
  display_name: string | null;
  language_code: string | null;
  is_telegram_linked: boolean | null;
  is_banned: boolean | null;
  onboarding_completed: boolean | null;
  notification_settings: { enabled?: boolean } | null;
}

/**
 * Raw joined row from unified_user_credits + unified_users.
 *
 * supabase-js types embedded relations as arrays even for a to-one FK, so we
 * normalize via `firstUser()` before use.
 */
interface RawTrialCreditRow {
  credits_basic: number | null;
  credits_pro: number | null;
  credits_cassandra: number | null;
  unified_user_id: string;
  unified_users: RawUnifiedUser | RawUnifiedUser[] | null;
}

/**
 * Normalize the embedded relation (array or object) to a single user or null.
 */
function firstUser(rel: RawTrialCreditRow["unified_users"]): RawUnifiedUser | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/**
 * Derive the trial stage from the remaining welcome-credit total.
 * Only total 0 or 1 are actionable; anything else is skipped.
 */
function deriveStage(total: number): TrialNudgeStage | null {
  if (total === 0) return "zero";
  if (total === 1) return "low";
  return null;
}

/**
 * Find users whose welcome (trial) credits have run low or out.
 *
 * Criteria:
 * - `free_credit_granted = true` (they actually received the trial)
 * - remaining welcome total (basic + pro + cassandra) is 0 (`zero`) or 1 (`low`)
 * - linked Telegram, not banned, onboarding completed
 * - notifications not explicitly disabled
 * - NOT already purchased (no `credit_transactions` purchase row)
 * - NOT already nudged at that stage, ever (all-time `engagement_log` dedup)
 *
 * @returns Array of trial-nudge users (eligible user + derived stage)
 */
export async function findTrialNudgeUsers(): Promise<TrialNudgeUser[]> {
  const supabase = getSupabase();
  logger.debug("Finding trial-nudge users");

  // Join unified_users to get delivery + eligibility info in one query.
  const { data: rows, error } = await supabase
    .from("unified_user_credits")
    .select(
      `credits_basic, credits_pro, credits_cassandra, unified_user_id,
       unified_users:unified_user_id (
         id, telegram_id, display_name, language_code,
         is_telegram_linked, is_banned, onboarding_completed, notification_settings
       )`
    )
    .eq("free_credit_granted", true);

  if (error) {
    logger.error({ error }, "Failed to find trial-nudge users");
    throw new Error(`Failed to find trial-nudge users: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    logger.info("No trial-nudge candidate rows found");
    return [];
  }

  // Normalize embedded relation + derive stage + filter eligibility flags.
  // notification_settings JSONB null = enabled.
  const eligible = (rows as unknown as RawTrialCreditRow[])
    .map((row) => {
      const total =
        (row.credits_basic ?? 0) + (row.credits_pro ?? 0) + (row.credits_cassandra ?? 0);
      return {
        unifiedUserId: row.unified_user_id,
        stage: deriveStage(total),
        user: firstUser(row.unified_users),
      };
    })
    .filter(
      (
        entry
      ): entry is {
        unifiedUserId: string;
        stage: TrialNudgeStage;
        user: RawUnifiedUser;
      } => {
        const u = entry.user;
        return (
          entry.stage !== null &&
          !!u &&
          u.telegram_id != null &&
          u.is_telegram_linked === true &&
          u.is_banned !== true &&
          u.onboarding_completed === true &&
          u.notification_settings?.enabled !== false
        );
      }
    );

  if (eligible.length === 0) {
    logger.info("No eligible trial-nudge users after filtering");
    return [];
  }

  // Exclude users who have ever purchased (point-of-action reactive message
  // covers them). Source of truth = credit_transactions purchase rows.
  const candidateIds = eligible.map((e) => e.unifiedUserId);
  const { data: purchases, error: purchaseError } = await supabase
    .from("credit_transactions")
    .select("unified_user_id")
    .eq("transaction_type", "purchase")
    .in("unified_user_id", candidateIds);

  if (purchaseError) {
    logger.warn({ error: purchaseError }, "Failed to check purchases, continuing");
  }

  const purchasedIds = new Set(
    (purchases as { unified_user_id: string }[] | null)?.map((p) => p.unified_user_id) ?? []
  );

  // All-time dedup: any prior trial-low / trial-zero row excludes that stage
  // for that user, forever. NO date filter (differs from streak-at-risk).
  const { data: sentRows, error: logError } = await supabase
    .from("engagement_log")
    .select("telegram_id, message_type")
    .in("message_type", ["trial-low", "trial-zero"]);

  if (logError) {
    logger.warn({ error: logError }, "Failed to check engagement log, continuing");
  }

  const sentKeys = new Set(
    (sentRows as { telegram_id: number; message_type: string }[] | null)?.map(
      (log) => `${log.telegram_id}:${log.message_type}`
    ) ?? []
  );

  const result: TrialNudgeUser[] = eligible
    .filter((entry) => !purchasedIds.has(entry.unifiedUserId))
    .filter((entry) => {
      const u = entry.user;
      const key = `${u.telegram_id}:trial-${entry.stage}`;
      return !sentKeys.has(key);
    })
    .map((entry) => {
      const u = entry.user;
      return {
        stage: entry.stage,
        user: {
          id: u.id,
          telegramId: u.telegram_id as number,
          displayName: u.display_name,
          languageCode: u.language_code ?? "ru",
          lastActiveAt: new Date(),
        },
      };
    });

  logger.info({ count: result.length }, "Found trial-nudge users");
  return result;
}

/**
 * Localized fallback messages used when AI generation fails or is skipped.
 * Two tones per locale:
 *   - low  → gentle "running low" warm-up + invitation to continue
 *   - zero → clear "welcome credits used up — buy to continue" offer
 */
const FALLBACK_MESSAGES: Record<TrialNudgeStage, Record<string, (name: string) => string>> = {
  low: {
    ru: (name) =>
      `☕ ${name}, твои приветственные кредиты почти закончились ✨\n\n` +
      `Остался последний расклад — давай заглянем в гущу вместе? А если захочешь продолжить, ` +
      `всегда можно пополнить кредиты 🎁`,
    en: (name) =>
      `☕ ${name}, your welcome credits are almost gone ✨\n\n` +
      `You've got one last reading left — shall we look into the grounds together? ` +
      `When you're ready to continue, you can always top up 🎁`,
    zh: (name) =>
      `☕ ${name}，您的欢迎赠送即将用完 ✨\n\n` +
      `还剩最后一次解读——要不要一起看看咖啡渣？想继续时，随时都可以补充次数 🎁`,
  },
  zero: {
    ru: (name) =>
      `☕ ${name}, приветственные кредиты закончились 🌙\n\n` +
      `Мне будет не хватать наших гаданий! Чтобы продолжить заглядывать в кофейную гущу, ` +
      `пополни кредиты — и мы снова раскроем, что тебя ждёт ✨`,
    en: (name) =>
      `☕ ${name}, your welcome credits are used up 🌙\n\n` +
      `I'll miss our readings! To keep peering into the coffee grounds, top up your credits — ` +
      `and we'll uncover what's ahead together ✨`,
    zh: (name) =>
      `☕ ${name}，您的欢迎赠送已用完 🌙\n\n` +
      `我会想念我们的占卜！想继续解读咖啡渣，请补充次数——让我们一起揭开未来 ✨`,
  },
};

/** AI prompt per stage (ru only). */
const AI_SYSTEM_PROMPT: Record<TrialNudgeStage, string> = {
  low:
    "Ты — дружелюбная и слегка загадочная гадалка на кофейной гуще по имени Арина. " +
    "У пользователя почти закончились приветственные (бесплатные) кредиты — остался один. " +
    "Напиши короткое, тёплое сообщение: упомяни имя (если есть), мягко скажи, что кредиты " +
    "заканчиваются, разогрей интерес к последнему раскладу и мягко предложи пополнить кредиты, " +
    "чтобы продолжить гадания. Используй уместные эмодзи (☕ ✨ 🎁). Не более 3 предложений. " +
    "Без markdown; допустима только базовая Telegram HTML-разметка.",
  zero:
    "Ты — дружелюбная и слегка загадочная гадалка на кофейной гуще по имени Арина. " +
    "У пользователя закончились приветственные (бесплатные) кредиты. " +
    "Напиши короткое, тёплое сообщение: упомяни имя (если есть), скажи, что приветственные " +
    "кредиты закончились, и сделай ЯВНОЕ, но деликатное предложение пополнить кредиты, чтобы " +
    "продолжить гадания на кофейной гуще. Используй уместные эмодзи (☕ ✨ 🎁). " +
    "Не более 3 предложений. Без markdown; допустима только базовая Telegram HTML-разметка.",
};

/**
 * Create a trial-nudge message for the given stage.
 *
 * AI generation runs for Russian only (primary audience, cost control); other
 * languages return the localized fallback. AI failures fall back gracefully.
 *
 * @param stage - "low" (1 credit left) or "zero" (0 credits left)
 * @param userName - User's display name (or null)
 * @param languageCode - User language ("ru" | "en" | "zh"), defaults to "ru"
 * @returns Localized nudge message
 */
export async function createTrialNudgeMessage(
  stage: TrialNudgeStage,
  userName: string | null,
  languageCode = "ru"
): Promise<string> {
  const lang = ["ru", "en", "zh"].includes(languageCode) ? languageCode : "ru";
  const name = userName || (lang === "ru" ? "друг" : lang === "zh" ? "朋友" : "friend");

  const stageFallbacks = FALLBACK_MESSAGES[stage];
  const fallback = (stageFallbacks[lang] ?? stageFallbacks.ru!)(name);

  // Only generate AI variants for Russian (primary audience); keep cost low.
  if (lang !== "ru") {
    return fallback;
  }

  try {
    const model = createModel(MODEL_ARINA_BASIC, { temperature: 0.85, maxTokens: 150 });
    const response = await model.invoke([
      new SystemMessage(AI_SYSTEM_PROMPT[stage]),
      new HumanMessage(`Имя пользователя: ${name}.`),
    ]);

    const text = (response.content as string).trim();
    return text.length > 0 ? text : fallback;
  } catch (error) {
    logger.error({ error }, "Failed to generate AI trial-nudge message, using fallback");
    return fallback;
  }
}
