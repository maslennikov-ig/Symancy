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

const logger = getLogger().child({ module: 'router:commands' });

/**
 * Handle /cassandra command
 * Premium fortune teller introduction
 */
export async function handleCassandraCommand(ctx: BotContext): Promise<void> {
  try {
    const message =
      '🔮 Приветствую, смертный. Я — Кассандра, мистик высшего ранга.\n\n' +
      'Моё искусство требует глубокого проникновения в символы судьбы. ' +
      'Премиум-гадание стоит 3 кредита и раскроет сокровенные знаки вашего будущего.\n\n' +
      'Пришлите фото кофейной гущи с подписью "кассандра" или "cassandra", ' +
      'и я проведу ритуал прочтения вашей участи.';

    await ctx.reply(message);

    logger.info(
      {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        command: 'cassandra',
      },
      'Cassandra command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Cassandra command failed');
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Handle /help command
 * Display bot commands and usage instructions
 */
export async function handleHelpCommand(ctx: BotContext): Promise<void> {
  try {
    const message =
      '📖 *Справка по командам*\n\n' +
      '/start — Начать работу с ботом\n' +
      '/cassandra — Премиум гадалка Кассандра\n' +
      '/credits — Проверить баланс кредитов\n' +
      '/history — История ваших гаданий\n' +
      '/help — Справка по командам\n\n' +
      '☕️ *Как пользоваться:*\n' +
      'Отправьте фото кофейной гущи для гадания. ' +
      'Добавьте подпись "арина" для базового гадания (1 кредит) или ' +
      '"кассандра" для премиум-гадания (3 кредита).';

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        command: 'help',
      },
      'Help command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Help command failed');
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

/**
 * Handle /credits command
 * Display user's credit balance and pricing
 */
export async function handleCreditsCommand(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.reply('Не удалось определить пользователя.');
      logger.warn({ command: 'credits' }, 'Missing ctx.from');
      return;
    }

    const balance = await getCreditBalance(ctx.from.id);

    const message =
      `💰 *Ваш баланс:* ${balance} кредит(ов)\n\n` +
      '📊 *Цены на гадания:*\n' +
      '• Арина (базовое) — 1 кредит\n' +
      '• Кассандра (премиум) — 3 кредита\n\n' +
      'Пополните баланс, чтобы продолжить гадания.';

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from.id,
        username: ctx.from.username,
        balance,
        command: 'credits',
      },
      'Credits command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Credits command failed');
    await ctx.reply('Не удалось получить баланс. Попробуйте позже.');
  }
}

/**
 * Handle /history command
 * Display user's last 5 fortune readings
 */
export async function handleHistoryCommand(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.reply('Не удалось определить пользователя.');
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
      await ctx.reply('Не удалось загрузить историю. Попробуйте позже.');
      return;
    }

    if (!readings || readings.length === 0) {
      await ctx.reply('📜 У вас пока нет гаданий.');
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
        reading.persona === 'cassandra' ? 'Кассандра' : 'Арина';

      const preview =
        reading.interpretation.length > 80
          ? reading.interpretation.substring(0, 80) + '...'
          : reading.interpretation;

      return `📅 ${date} | ${personaName}: ${preview}`;
    });

    const message = '📜 *История ваших гаданий:*\n\n' + historyLines.join('\n\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        userId: ctx.from.id,
        username: ctx.from.username,
        readingsCount: readings.length,
        command: 'history',
      },
      'History command executed'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'History command failed');
    await ctx.reply('Не удалось загрузить историю. Попробуйте позже.');
  }
}

/**
 * Handle /link command
 * Generate account linking token for connecting Telegram to web account
 */
export async function handleLinkCommand(ctx: BotContext): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.reply('Не удалось определить пользователя.');
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
      await ctx.reply('Не удалось проверить аккаунт. Попробуйте позже.');
      return;
    }

    if (!unifiedUser) {
      logger.warn({ telegramUserId }, 'Unified user not found for link command');
      await ctx.reply(
        'Аккаунт не найден. Сначала отправьте /start для регистрации.'
      );
      return;
    }

    // Check if already linked to web (has auth_id)
    if (unifiedUser.auth_id) {
      const message =
        '🔗 *Ваш аккаунт уже связан с веб-версией.*\n\n' +
        'Вы можете войти на сайт symancy.ru с этим Telegram-аккаунтом.';

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

    const message =
      '🔗 *Связать аккаунт с веб-версией*\n\n' +
      'Перейдите по ссылке в течение 10 минут, чтобы связать ваш Telegram-аккаунт с веб-версией:\n\n' +
      `${result.linkUrl}\n\n` +
      'После связывания вы сможете:\n' +
      '• Использовать один аккаунт на сайте и в Telegram\n' +
      '• Объединить кредиты и историю';

    await ctx.reply(message, { parse_mode: 'Markdown' });

    logger.info(
      {
        telegramUserId,
        unifiedUserId: unifiedUser.id,
        expiresAt: result.expiresAt,
        command: 'link',
      },
      'Link token generated successfully'
    );
  } catch (error) {
    logger.error({ error, userId: ctx.from?.id }, 'Link command failed');
    await ctx.reply('Не удалось создать ссылку. Попробуйте позже.');
  }
}
