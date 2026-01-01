/**
 * Daily Insight Service
 *
 * Generates personalized daily insights for users.
 * Insights are cached in CloudStorage for the day.
 *
 * @module services/dailyInsightService
 */

import type { Persona } from '../hooks/useCloudStorage';

// ============================================================================
// Types
// ============================================================================

/**
 * Daily insight data structure
 */
export interface DailyInsight {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Insight content text */
  content: string;
  /** AI persona that generated the insight */
  persona: Persona;
}

/**
 * Supported languages for insights
 */
export type InsightLanguage = 'ru' | 'en' | 'zh';

// ============================================================================
// Insight Pool
// ============================================================================

/**
 * Base insights pool organized by language and category
 * These get rotated based on the day of year
 */
const INSIGHT_POOL: Record<InsightLanguage, string[]> = {
  ru: [
    'Сегодня звезды благоприятствуют новым начинаниям. Если вы давно откладывали важное дело — настал подходящий момент действовать.',
    'Ваша интуиция сегодня особенно сильна. Прислушайтесь к внутреннему голосу при принятии решений.',
    'День благоприятен для общения. Неожиданная встреча может принести приятные сюрпризы.',
    'Сегодня стоит обратить внимание на детали. В мелочах может скрываться ответ на важный вопрос.',
    'Энергия дня способствует творчеству. Позвольте себе мечтать и воплощать идеи в жизнь.',
    'Хороший день для финансовых решений. Доверяйте своему чутью в денежных вопросах.',
    'Сегодня важно найти баланс между работой и отдыхом. Не забывайте о себе.',
    'День обещает интересные открытия. Будьте открыты новому опыту.',
    'Ваша харизма сегодня на высоте. Используйте это для важных переговоров.',
    'Звезды советуют проявить терпение. Не торопите события — всё придёт в своё время.',
    'Сегодня благоприятный день для укрепления отношений с близкими.',
    'Доверяйте своим снам — они могут нести важные послания.',
    'День подходит для завершения начатых дел. Закройте старые гештальты.',
    'Космическая энергия способствует самопознанию. Загляните внутрь себя.',
  ],
  en: [
    'Today the stars favor new beginnings. If you have been postponing something important — now is the right time to act.',
    'Your intuition is especially strong today. Listen to your inner voice when making decisions.',
    'The day is favorable for communication. An unexpected meeting may bring pleasant surprises.',
    'Pay attention to details today. The answer to an important question may be hidden in small things.',
    'The energy of the day promotes creativity. Allow yourself to dream and bring ideas to life.',
    'A good day for financial decisions. Trust your instincts in money matters.',
    'Today it is important to find balance between work and rest. Do not forget about yourself.',
    'The day promises interesting discoveries. Be open to new experiences.',
    'Your charisma is at its peak today. Use it for important negotiations.',
    'The stars advise patience. Do not rush things — everything will come in its own time.',
    'Today is a favorable day for strengthening relationships with loved ones.',
    'Trust your dreams — they may carry important messages.',
    'The day is suitable for completing what you have started. Close old chapters.',
    'Cosmic energy promotes self-discovery. Look within yourself.',
  ],
  zh: [
    '今天星象有利于新的开始。如果你一直在推迟某件重要的事情——现在是行动的好时机。',
    '今天你的直觉特别敏锐。在做决定时，请倾听内心的声音。',
    '今天适合社交。意外的相遇可能会带来惊喜。',
    '今天要注意细节。重要问题的答案可能隐藏在小事中。',
    '今天的能量有利于创造力。让自己去梦想，把想法变成现实。',
    '今天适合做财务决定。在金钱问题上相信自己的直觉。',
    '今天重要的是在工作和休息之间找到平衡。不要忘记照顾自己。',
    '今天会有有趣的发现。对新体验保持开放。',
    '今天你的魅力达到顶峰。把它用在重要的谈判上。',
    '星象建议要有耐心。不要急于求成——一切都会在适当的时候到来。',
    '今天是加强与亲人关系的好日子。',
    '相信你的梦——它们可能传递着重要的信息。',
    '今天适合完成已经开始的事情。关闭旧的篇章。',
    '宇宙能量促进自我发现。向内看看自己。',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the day of year (1-366)
 *
 * @param date - Date to calculate day of year for
 * @returns Day of year number
 */
function getDayOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 *
 * @returns ISO date string
 */
function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a daily insight based on the current date
 * Uses day of year to rotate through the pool deterministically
 *
 * @param language - Language for the insight (default: 'ru')
 * @param persona - AI persona (default: 'arina')
 * @returns DailyInsight with today's date, content, and persona
 *
 * @example
 * ```ts
 * const insight = generateDailyInsight('en', 'arina');
 * console.log(insight.content);
 * // "Today the stars favor new beginnings..."
 * ```
 */
export function generateDailyInsight(
  language: InsightLanguage = 'ru',
  persona: Persona = 'arina'
): DailyInsight {
  // Validate language
  const validLanguages: InsightLanguage[] = ['ru', 'en', 'zh'];
  if (!validLanguages.includes(language)) {
    console.warn(`[dailyInsightService] Invalid language '${language}', falling back to 'ru'`);
  }

  const today = new Date();
  const dayOfYear = getDayOfYear(today);

  const pool = INSIGHT_POOL[language] || INSIGHT_POOL.ru;
  const index = dayOfYear % pool.length;

  return {
    date: getTodayISODate(),
    content: pool[index],
    persona,
  };
}

/**
 * Check if a cached insight date is still valid (same as today)
 *
 * @param cachedDate - ISO date string from cache (YYYY-MM-DD)
 * @returns True if the cached date matches today
 *
 * @example
 * ```ts
 * const isValid = isCacheValid('2024-01-15');
 * if (!isValid) {
 *   const newInsight = generateDailyInsight('en');
 * }
 * ```
 */
export function isCacheValid(cachedDate: string): boolean {
  const today = getTodayISODate();
  return cachedDate === today;
}

/**
 * Get an insight for a specific language, using cache if valid
 * This is a convenience function that combines cache checking and generation
 *
 * @param language - Language for the insight
 * @param persona - AI persona
 * @param cachedInsight - Existing cached insight (optional)
 * @returns Content string from valid cache or newly generated insight
 */
export function getInsightContent(
  language: InsightLanguage,
  persona: Persona,
  cachedInsight?: { date: string; content: string } | null
): string {
  // Use cache if valid
  if (cachedInsight && isCacheValid(cachedInsight.date)) {
    return cachedInsight.content;
  }

  // Generate new insight
  const insight = generateDailyInsight(language, persona);
  return insight.content;
}
