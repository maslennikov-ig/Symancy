/**
 * Telegram Bot Command Handlers
 *
 * Handles bot commands: /cassandra, /help, /credits, /history, /link
 */

import type { BotContext } from './middleware.js';
import { getLogger } from '../../core/logger.js';
import { getSupabase } from '../../core/database.js';
import { getCreditBalance } from '../credits/service.js';
import { generateLinkToken } from '../../services/auth/LinkTokenService.js';
import { getBotMessage } from '../../services/i18n/index.js';

const logger = getLogger().child({ module: 'router:commands' });

/**
 * Handle /cassandra command
 * Premium fortune teller introduction
 */
export async function handleCassandraCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.from?.language_code;

  try {
    const message = getBotMessage('cassandra.intro', lang);

    await ctx.reply(message);

    logger.info(
      {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        language: lang,
        command: 'cassandra',
      },
      'Cassandra command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Cassandra command failed');
    await ctx.reply(getBotMessage('error.generic', lang));
  }
}

/**
 * Handle /help command
 * Display bot commands and usage instructions
 */
export async function handleHelpCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.from?.language_code;

  try {
    const title = getBotMessage('help.title', lang);
    const commands = getBotMessage('help.commands', lang);
    const usage = getBotMessage('help.usage', lang);

    const message = `${title}\n\n${commands}\n\n${usage}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        language: lang,
        command: 'help',
      },
      'Help command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Help command failed');
    await ctx.reply(getBotMessage('error.generic', lang));
  }
}

/**
 * Handle /credits command
 * Display user's credit balance and pricing
 */
export async function handleCreditsCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.from?.language_code;

  try {
    if (!ctx.from) {
      await ctx.reply(getBotMessage('error.userNotFound', lang));
      logger.warn({ command: 'credits' }, 'Missing ctx.from');
      return;
    }

    const balance = await getCreditBalance(ctx.from.id);

    const balanceMsg = getBotMessage('credits.balance', lang, {
      balance: String(balance),
    });
    const pricingMsg = getBotMessage('credits.pricing', lang);
    const topUpMsg = getBotMessage('credits.topUp', lang);

    const message = `${balanceMsg}\n\n${pricingMsg}\n\n${topUpMsg}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from.id,
        username: ctx.from.username,
        balance,
        language: lang,
        command: 'credits',
      },
      'Credits command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Credits command failed');
    await ctx.reply(getBotMessage('error.balanceFailed', lang));
  }
}

/**
 * Handle /history command
 * Display user's last 5 fortune readings
 */
export async function handleHistoryCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.from?.language_code;

  try {
    if (!ctx.from) {
      await ctx.reply(getBotMessage('error.userNotFound', lang));
      logger.warn({ command: 'history' }, 'Missing ctx.from');
      return;
    }

    const supabase = getSupabase();

    const { data: readings, error } = await supabase
      .from('analysis_history')
      .select('created_at, persona, interpretation')
      .eq('telegram_user_id', ctx.from.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      logger.error(
        { error, userId: ctx.from.id },
        'Failed to fetch analysis history'
      );
      await ctx.reply(getBotMessage('error.loadFailed', lang));
      return;
    }

    if (!readings || readings.length === 0) {
      await ctx.reply(getBotMessage('history.empty', lang));
      logger.info(
        { userId: ctx.from.id, command: 'history' },
        'No readings found'
      );
      return;
    }

    const historyLines = readings.map((reading) => {
      const date = new Date(reading.created_at).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const personaName =
        reading.persona === 'cassandra'
          ? getBotMessage('history.personaCassandra', lang)
          : getBotMessage('history.personaArina', lang);

      const preview =
        reading.interpretation.length > 80
          ? reading.interpretation.substring(0, 80) + '...'
          : reading.interpretation;

      return `📅 ${date} | ${personaName}: ${preview}`;
    });

    const title = getBotMessage('history.title', lang);
    const message = `${title}\n\n${historyLines.join('\n\n')}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from.id,
        username: ctx.from.username,
        readingsCount: readings.length,
        language: lang,
        command: 'history',
      },
      'History command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'History command failed');
    await ctx.reply(getBotMessage('error.loadFailed', lang));
  }
}

/**
 * Handle /link command
 * Generate account linking token for connecting Telegram to web account
 */
export async function handleLinkCommand(ctx: BotContext): Promise<void> {
  const lang = ctx.from?.language_code;

  try {
    if (!ctx.from) {
      await ctx.reply(getBotMessage('error.userNotFound', lang));
      logger.warn({ command: 'link' }, 'Missing ctx.from');
      return;
    }

    const supabase = getSupabase();
    const telegramUserId = ctx.from.id;

    // Get unified user by telegram_id
    const { data: unifiedUser, error: fetchError } = await supabase
      .from('unified_users')
      .select('id, auth_id, telegram_id')
      .eq('telegram_id', telegramUserId)
      .single();

    if (fetchError) {
      logger.error(
        { error: fetchError, telegramUserId },
        'Failed to fetch unified user'
      );
      await ctx.reply(getBotMessage('error.generic', lang));
      return;
    }

    if (!unifiedUser) {
      logger.warn({ telegramUserId }, 'Unified user not found for link command');
      await ctx.reply(getBotMessage('link.notFound', lang));
      return;
    }

    // Check if already linked to web (has auth_id)
    if (unifiedUser.auth_id) {
      const message = getBotMessage('link.alreadyLinked', lang);

      await ctx.reply(message, { parse_mode: 'Markdown' });

      logger.info(
        { telegramUserId, unifiedUserId: unifiedUser.id, command: 'link' },
        'User already linked to web'
      );
      return;
    }

    // Generate link token
    const result = await generateLinkToken({
      unifiedUserId: unifiedUser.id,
      sourceChannel: 'telegram',
    });

    const linkMsg = getBotMessage('link.generateUrl', lang, {
      url: result.linkUrl,
    });
    const benefitsMsg = getBotMessage('link.benefits', lang);

    const message = `${linkMsg}\n\n${benefitsMsg}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        telegramUserId,
        unifiedUserId: unifiedUser.id,
        expiresAt: result.expiresAt,
        language: lang,
        command: 'link',
      },
      'Link token generated successfully'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Link command failed');
    await ctx.reply(getBotMessage('error.linkFailed', lang));
  }
}
