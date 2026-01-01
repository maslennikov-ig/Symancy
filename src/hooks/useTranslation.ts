/**
 * Translation Hook
 *
 * Provides type-safe translation function with consistent typing across components.
 *
 * @module hooks/useTranslation
 */
import { useMemo } from 'react';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

/**
 * Type for translation keys
 */
export type TranslationKey = keyof typeof translations.en;

/**
 * Type-safe translation function
 */
export type TranslationFunction = (key: TranslationKey) => string;

/**
 * Return type for useTranslation hook
 */
export interface UseTranslationReturn {
  /** Type-safe translation function */
  t: TranslationFunction;
  /** Current language */
  language: Lang;
}

/**
 * Hook for type-safe translations
 *
 * @param language - Current language code
 * @returns Translation function and language
 *
 * @example
 * ```tsx
 * function MyComponent({ language }: { language: Lang }) {
 *   const { t } = useTranslation(language);
 *
 *   return <h1>{t('nav.home')}</h1>;
 * }
 * ```
 */
export function useTranslation(language: Lang): UseTranslationReturn {
  const t = useMemo<TranslationFunction>(
    () => (key: TranslationKey) => i18n_t(key, language),
    [language]
  );

  return { t, language };
}

/**
 * Re-export types from i18n for convenience
 */
export type { Lang } from '../lib/i18n';
