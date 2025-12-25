/**
 * Grammy middleware for authentication, state loading, and access control
 * Extends bot context with user profile and state from database
 */
import type { Context, NextFunction } from "grammy";
import { getSupabase } from "../../core/database.js";
import { getLogger } from "../../core/logger.js";
import type { Profile, UserState } from "../../types/database.js";

const logger = getLogger().child({ module: "middleware" });

/**
 * Extended context with profile and state
 * Augments base Grammy context with Symancy user data
 */
export interface BotContext extends Context {
  profile?: Profile;
  userState?: UserState;
}

/**
 * Middleware to load user profile from database
 * Creates new profile if user is first-time
 * @param ctx - Extended bot context
 * @param next - Next middleware function
 */
export async function loadProfile(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    logger.warn("No user ID in context");
    return next();
  }

  const supabase = getSupabase();

  try {
    // Try to get existing profile
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .single();

    // Handle fetch error (database down, connection issues)
    if (fetchError && fetchError.code !== "PGRST116") {
      logger.error(
        { error: fetchError, telegramUserId },
        "Failed to fetch profile from database"
      );
      // Continue with undefined profile - bot shouldn't crash
      ctx.profile = undefined;
      return next();
    }

    // Create profile if doesn't exist (PGRST116 = not found)
    if (!profile || fetchError?.code === "PGRST116") {
      try {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            telegram_user_id: telegramUserId,
            name: ctx.from.username || ctx.from.first_name || null,
            language_code: ctx.from.language_code || "ru",
          })
          .select()
          .single();

        if (insertError) {
          logger.error({ error: insertError, telegramUserId }, "Failed to create profile");
          ctx.profile = undefined;
        } else {
          ctx.profile = newProfile as Profile;
          logger.info({ telegramUserId }, "Created new profile");
        }
      } catch (insertException) {
        logger.error(
          { error: insertException, telegramUserId },
          "Exception while creating profile"
        );
        ctx.profile = undefined;
      }
    } else {
      ctx.profile = profile as Profile;
    }
  } catch (exception) {
    logger.error(
      { error: exception, telegramUserId },
      "Exception in loadProfile middleware"
    );
    ctx.profile = undefined;
  }

  // Always call next() - never freeze the bot
  return next();
}

/**
 * Middleware to load user state from database
 * Initializes state if not present
 * @param ctx - Extended bot context
 * @param next - Next middleware function
 */
export async function loadUserState(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  const supabase = getSupabase();

  try {
    // Get or create user state
    const { data: userState, error: fetchError } = await supabase
      .from("user_states")
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .single();

    // Handle fetch error (database down, connection issues)
    if (fetchError && fetchError.code !== "PGRST116") {
      logger.error(
        { error: fetchError, telegramUserId },
        "Failed to fetch user state from database"
      );
      // Continue with undefined state - bot shouldn't crash
      ctx.userState = undefined;
      return next();
    }

    // Create state if doesn't exist (PGRST116 = not found)
    if (!userState || fetchError?.code === "PGRST116") {
      try {
        const { data: newState, error: insertError } = await supabase
          .from("user_states")
          .insert({ telegram_user_id: telegramUserId })
          .select()
          .single();

        if (insertError) {
          logger.error({ error: insertError, telegramUserId }, "Failed to create user state");
          ctx.userState = undefined;
        } else {
          ctx.userState = newState as UserState;
        }
      } catch (insertException) {
        logger.error(
          { error: insertException, telegramUserId },
          "Exception while creating user state"
        );
        ctx.userState = undefined;
      }
    } else {
      ctx.userState = userState as UserState;
    }
  } catch (exception) {
    logger.error(
      { error: exception, telegramUserId },
      "Exception in loadUserState middleware"
    );
    ctx.userState = undefined;
  }

  // Always call next() - never freeze the bot
  return next();
}

/**
 * Middleware to check if user is banned
 * Blocks message processing for banned users
 * @param ctx - Extended bot context
 * @param next - Next middleware function
 */
export async function checkBanned(ctx: BotContext, next: NextFunction): Promise<void> {
  if (ctx.profile?.is_banned) {
    logger.warn({ telegramUserId: ctx.from?.id }, "Banned user attempted access");
    return; // Don't process message
  }

  return next();
}
