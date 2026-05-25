/**
 * Gamification Module
 *
 * User engagement mechanics built on top of the omnichannel user model.
 *
 * Currently exports:
 * - Streak service: consecutive-day usage tracking (sym-tb3)
 */

export {
  recordStreakActivity,
  recordStreakActivityForTelegramUser,
  type StreakState,
} from "./streak.service.js";
