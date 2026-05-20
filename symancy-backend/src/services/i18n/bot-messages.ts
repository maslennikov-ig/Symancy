/**
 * Bot Messages i18n Service
 *
 * Provides localized messages for Telegram bot commands.
 * Supports: ru, en, zh (matches frontend i18n)
 *
 * @module services/i18n/bot-messages
 */

export type BotLang = 'ru' | 'en' | 'zh';

/**
 * Bot message keys
 */
export type BotMessageKey =
  | 'error.generic'
  | 'error.userNotFound'
  | 'error.loadFailed'
  | 'error.balanceFailed'
  | 'error.linkFailed'
  | 'cassandra.intro'
  | 'help.title'
  | 'help.commands'
  | 'help.usage'
  | 'credits.balance'
  | 'credits.pricing'
  | 'credits.topUp'
  | 'history.title'
  | 'history.empty'
  | 'history.personaArina'
  | 'history.personaCassandra'
  | 'link.alreadyLinked'
  | 'link.generateUrl'
  | 'link.benefits'
  | 'link.notFound'
  | 'compare.dynamics.start'
  | 'compare.compatibility.start'
  | 'compare.firstReceived'
  | 'compare.sendPhotoPrompt'
  | 'compare.expectingPhoto'
  | 'compare.sessionExpired'
  | 'compare.cancelled'
  | 'compare.nothingToCancel'
  | 'compare.processing'
  | 'compare.insufficientCreditsPro'
  | 'compare.insufficientCreditsCassandra'
  | 'compare.error'
  | 'compare.cancelButton';

/**
 * Bot messages translations
 */
const messages: Record<BotLang, Record<BotMessageKey, string>> = {
  ru: {
    'error.generic': 'Произошла ошибка. Попробуйте позже.',
    'error.userNotFound': 'Не удалось определить пользователя.',
    'error.loadFailed': 'Не удалось загрузить историю. Попробуйте позже.',
    'error.balanceFailed': 'Не удалось получить баланс. Попробуйте позже.',
    'error.linkFailed': 'Не удалось создать ссылку. Попробуйте позже.',
    'cassandra.intro':
      '🔮 Приветствую, смертный. Я — Кассандра, мистик высшего ранга.\n\n' +
      'Моё искусство требует глубокого проникновения в символы судьбы. ' +
      'Премиум-гадание стоит 3 кредита и раскроет сокровенные знаки вашего будущего.\n\n' +
      'Пришлите фото кофейной гущи с подписью "кассандра" или "cassandra", ' +
      'и я проведу ритуал прочтения вашей участи.',
    'help.title': '📖 *Справка по командам*',
    'help.commands':
      '/start — Начать работу с ботом\n' +
      '/cassandra — Премиум гадалка Кассандра\n' +
      '/credits — Проверить баланс кредитов\n' +
      '/history — История ваших гаданий\n' +
      '/link — Связать с веб-версией\n' +
      '/help — Справка по командам',
    'help.usage':
      '☕️ *Как пользоваться:*\n' +
      'Отправьте фото кофейной гущи для гадания. ' +
      'Добавьте подпись "арина" для базового гадания (1 кредит) или ' +
      '"кассандра" для премиум-гадания (3 кредита).',
    'credits.balance': '💰 *Ваш баланс:* {balance} кредит(ов)',
    'credits.pricing':
      '📊 *Цены на гадания:*\n' +
      '• Арина (базовое) — 1 кредит\n' +
      '• Кассандра (премиум) — 3 кредита',
    'credits.topUp': 'Пополните баланс, чтобы продолжить гадания.',
    'history.title': '📜 *История ваших гаданий:*',
    'history.empty': '📜 У вас пока нет гаданий.',
    'history.personaArina': 'Арина',
    'history.personaCassandra': 'Кассандра',
    'link.alreadyLinked':
      '🔗 *Ваш аккаунт уже связан с веб-версией.*\n\n' +
      'Вы можете войти на сайт symancy.ru с этим Telegram-аккаунтом.',
    'link.generateUrl':
      '🔗 *Связать аккаунт с веб-версией*\n\n' +
      'Перейдите по ссылке в течение 10 минут, чтобы связать ваш Telegram-аккаунт с веб-версией:\n\n{url}',
    'link.benefits':
      'После связывания вы сможете:\n' +
      '• Использовать один аккаунт на сайте и в Telegram\n' +
      '• Объединить кредиты и историю',
    'link.notFound':
      'Аккаунт не найден. Сначала отправьте /start для регистрации.',
    'compare.dynamics.start':
      '☕️ Сравнение динамики (Арина)\n\n' +
      'Я сравню две ваши чашки и покажу, что изменилось во внутреннем пейзаже между двумя моментами.\n\n' +
      'Отправьте первое фото кофейной гущи.',
    'compare.compatibility.start':
      '🔮 Сравнение совместимости (Кассандра)\n\n' +
      'Я прочитаю встречу двух энергий — как они резонируют, где сталкиваются, что шепчут о вашем союзе.\n\n' +
      'Пришлите первое фото кофейной гущи (одного человека).',
    'compare.firstReceived':
      '✨ Первая чашка проанализирована.\n\nТеперь отправьте вторую фотографию.',
    'compare.sendPhotoPrompt':
      'Жду фото кофейной гущи, чтобы продолжить сравнение. Отправьте /cancel_compare, чтобы отменить.',
    'compare.expectingPhoto':
      'Сейчас я жду фото, а не текст. Пришлите фотографию или отмените сравнение командой /cancel_compare.',
    'compare.sessionExpired':
      '⏳ Сессия сравнения истекла. Начните заново командой /compare_dynamics или /compare_compatibility.',
    'compare.cancelled': '✅ Сравнение отменено.',
    'compare.nothingToCancel': 'Активного сравнения нет.',
    'compare.processing': '☕️ Сравниваю чашки...',
    'compare.insufficientCreditsPro':
      '💳 Недостаточно Pro-кредитов для сравнения динамики.\nИспользуйте /credits для проверки баланса.',
    'compare.insufficientCreditsCassandra':
      '💳 Недостаточно Cassandra-кредитов для сравнения совместимости.\nИспользуйте /credits для проверки баланса.',
    'compare.error':
      'Произошла ошибка при сравнении. Кредит возвращён. Попробуйте ещё раз.',
    'compare.cancelButton': '❌ Отменить сравнение',
  },
  en: {
    'error.generic': 'An error occurred. Please try again later.',
    'error.userNotFound': 'Could not identify user.',
    'error.loadFailed': 'Failed to load history. Please try again later.',
    'error.balanceFailed': 'Failed to get balance. Please try again later.',
    'error.linkFailed': 'Failed to create link. Please try again later.',
    'cassandra.intro':
      '🔮 Greetings, mortal. I am Cassandra, a mystic of the highest rank.\n\n' +
      'My art requires deep penetration into the symbols of fate. ' +
      'A premium reading costs 3 credits and will reveal the hidden signs of your future.\n\n' +
      'Send a photo of coffee grounds with the caption "cassandra", ' +
      'and I will perform the ritual of reading your destiny.',
    'help.title': '📖 *Command Help*',
    'help.commands':
      '/start — Start the bot\n' +
      '/cassandra — Premium fortune teller Cassandra\n' +
      '/credits — Check credit balance\n' +
      '/history — Your reading history\n' +
      '/link — Link to web version\n' +
      '/help — Command help',
    'help.usage':
      '☕️ *How to use:*\n' +
      'Send a photo of coffee grounds for a reading. ' +
      'Add caption "arina" for basic reading (1 credit) or ' +
      '"cassandra" for premium reading (3 credits).',
    'credits.balance': '💰 *Your balance:* {balance} credit(s)',
    'credits.pricing':
      '📊 *Reading prices:*\n' +
      '• Arina (basic) — 1 credit\n' +
      '• Cassandra (premium) — 3 credits',
    'credits.topUp': 'Top up your balance to continue readings.',
    'history.title': '📜 *Your reading history:*',
    'history.empty': '📜 You have no readings yet.',
    'history.personaArina': 'Arina',
    'history.personaCassandra': 'Cassandra',
    'link.alreadyLinked':
      '🔗 *Your account is already linked to the web version.*\n\n' +
      'You can log in to symancy.ru with this Telegram account.',
    'link.generateUrl':
      '🔗 *Link account to web version*\n\n' +
      'Follow the link within 10 minutes to link your Telegram account to the web version:\n\n{url}',
    'link.benefits':
      'After linking you can:\n' +
      '• Use one account on website and Telegram\n' +
      '• Merge credits and history',
    'link.notFound': 'Account not found. Send /start first to register.',
    'compare.dynamics.start':
      '☕️ Dynamics comparison (Arina)\n\n' +
      'I will compare two of your cups and show what has shifted in your inner landscape between the two moments.\n\n' +
      'Please send the first coffee-grounds photo.',
    'compare.compatibility.start':
      '🔮 Compatibility reading (Cassandra)\n\n' +
      'I will read the meeting of two energies — how they resonate, where they collide, what they whisper about your union.\n\n' +
      'Send the first coffee-grounds photo (one person\'s cup).',
    'compare.firstReceived':
      '✨ The first cup has been analyzed.\n\nNow send the second photo.',
    'compare.sendPhotoPrompt':
      'Waiting for the coffee-grounds photo to continue the comparison. Send /cancel_compare to abort.',
    'compare.expectingPhoto':
      'I am waiting for a photo, not text. Send a picture or cancel with /cancel_compare.',
    'compare.sessionExpired':
      '⏳ The comparison session has expired. Start again with /compare_dynamics or /compare_compatibility.',
    'compare.cancelled': '✅ Comparison cancelled.',
    'compare.nothingToCancel': 'No active comparison session.',
    'compare.processing': '☕️ Comparing the two cups...',
    'compare.insufficientCreditsPro':
      '💳 Not enough Pro credits for dynamics comparison.\nUse /credits to check your balance.',
    'compare.insufficientCreditsCassandra':
      '💳 Not enough Cassandra credits for compatibility comparison.\nUse /credits to check your balance.',
    'compare.error':
      'An error occurred during comparison. Your credit has been refunded. Please try again.',
    'compare.cancelButton': '❌ Cancel comparison',
  },
  zh: {
    'error.generic': '发生错误。请稍后再试。',
    'error.userNotFound': '无法识别用户。',
    'error.loadFailed': '加载历史失败。请稍后再试。',
    'error.balanceFailed': '获取余额失败。请稍后再试。',
    'error.linkFailed': '创建链接失败。请稍后再试。',
    'cassandra.intro':
      '🔮 你好，凡人。我是卡桑德拉，最高级别的神秘主义者。\n\n' +
      '我的艺术需要深入探索命运的符号。' +
      '高级占卜需要3个积分，将揭示你未来的隐藏迹象。\n\n' +
      '发送咖啡渣的照片，并附上"cassandra"字样，' +
      '我将为你进行命运解读仪式。',
    'help.title': '📖 *命令帮助*',
    'help.commands':
      '/start — 启动机器人\n' +
      '/cassandra — 高级占卜师卡桑德拉\n' +
      '/credits — 查看积分余额\n' +
      '/history — 占卜历史\n' +
      '/link — 链接到网页版\n' +
      '/help — 命令帮助',
    'help.usage':
      '☕️ *使用方法:*\n' +
      '发送咖啡渣的照片进行占卜。' +
      '添加"arina"字样进行基础占卜（1积分）或' +
      '"cassandra"进行高级占卜（3积分）。',
    'credits.balance': '💰 *您的余额:* {balance} 积分',
    'credits.pricing':
      '📊 *占卜价格:*\n' +
      '• 阿丽娜（基础）— 1积分\n' +
      '• 卡桑德拉（高级）— 3积分',
    'credits.topUp': '请充值以继续占卜。',
    'history.title': '📜 *您的占卜历史:*',
    'history.empty': '📜 您还没有占卜记录。',
    'history.personaArina': '阿丽娜',
    'history.personaCassandra': '卡桑德拉',
    'link.alreadyLinked':
      '🔗 *您的账户已链接到网页版。*\n\n' +
      '您可以使用此Telegram账户登录symancy.ru。',
    'link.generateUrl':
      '🔗 *链接账户到网页版*\n\n' +
      '请在10分钟内点击链接，将您的Telegram账户链接到网页版：\n\n{url}',
    'link.benefits':
      '链接后您可以：\n' +
      '• 在网站和Telegram使用同一账户\n' +
      '• 合并积分和历史记录',
    'link.notFound': '未找到账户。请先发送 /start 进行注册。',
    'compare.dynamics.start':
      '☕️ 动态对比（阿丽娜）\n\n' +
      '我将比较您的两杯咖啡渣，展示两个时刻之间内心世界的变化。\n\n' +
      '请发送第一张咖啡渣照片。',
    'compare.compatibility.start':
      '🔮 兼容性解读（卡桑德拉）\n\n' +
      '我将解读两种能量的相遇——它们如何共鸣、在哪里碰撞、对你们的关系低语何种讯息。\n\n' +
      '请发送第一张咖啡渣照片（一个人的杯子）。',
    'compare.firstReceived':
      '✨ 第一杯已分析完成。\n\n现在请发送第二张照片。',
    'compare.sendPhotoPrompt':
      '正在等待咖啡渣照片以继续对比。发送 /cancel_compare 取消。',
    'compare.expectingPhoto':
      '我正在等待照片，不是文字。请发送图片或使用 /cancel_compare 取消。',
    'compare.sessionExpired':
      '⏳ 对比会话已过期。请使用 /compare_dynamics 或 /compare_compatibility 重新开始。',
    'compare.cancelled': '✅ 对比已取消。',
    'compare.nothingToCancel': '没有正在进行的对比会话。',
    'compare.processing': '☕️ 正在对比两杯咖啡渣...',
    'compare.insufficientCreditsPro':
      '💳 Pro 积分不足，无法进行动态对比。\n使用 /credits 查看余额。',
    'compare.insufficientCreditsCassandra':
      '💳 Cassandra 积分不足，无法进行兼容性对比。\n使用 /credits 查看余额。',
    'compare.error':
      '对比时出错。您的积分已退还。请重试。',
    'compare.cancelButton': '❌ 取消对比',
  },
};

/**
 * Normalize language code to supported BotLang
 * Falls back to 'ru' for unsupported languages
 *
 * @param languageCode - Telegram language_code (e.g., 'en', 'ru', 'zh-hans')
 * @returns Normalized BotLang
 */
export function normalizeLang(languageCode?: string): BotLang {
  if (!languageCode) return 'ru';

  const code = languageCode.toLowerCase();

  if (code.startsWith('zh')) return 'zh';
  if (code.startsWith('en')) return 'en';
  if (code.startsWith('ru')) return 'ru';

  // Default to Russian for unsupported languages
  return 'ru';
}

/**
 * Get localized bot message
 *
 * @param key - Message key
 * @param languageCode - User's language_code from Telegram
 * @param replacements - Optional key-value replacements (e.g., {balance: 5})
 * @returns Localized message string
 *
 * @example
 * ```typescript
 * const msg = getBotMessage('credits.balance', 'en', { balance: '10' });
 * // Returns: "💰 *Your balance:* 10 credit(s)"
 * ```
 */
export function getBotMessage(
  key: BotMessageKey,
  languageCode?: string,
  replacements?: Record<string, string>
): string {
  const lang = normalizeLang(languageCode);
  let message = messages[lang][key] || messages['ru'][key] || key;

  // Apply replacements
  if (replacements) {
    for (const [placeholder, value] of Object.entries(replacements)) {
      message = message.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    }
  }

  return message;
}
