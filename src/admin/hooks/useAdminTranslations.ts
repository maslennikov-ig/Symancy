import { useState, useCallback, useEffect } from 'react';
import { translations, t as i18n_t, Lang, detectInitialLanguage } from '@/lib/i18n';

const ADMIN_LANGUAGE_KEY = 'admin-language';

/**
 * Hook for admin panel translations
 * Provides a translation function and language management
 */
export function useAdminTranslations() {
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);

  // Load persisted language on mount
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_LANGUAGE_KEY) as Lang | null;
    if (stored && ['en', 'ru', 'zh'].includes(stored)) {
      setLanguage(stored);
    }
  }, []);

  // Persist language preference when it changes
  useEffect(() => {
    localStorage.setItem(ADMIN_LANGUAGE_KEY, language);
  }, [language]);

  /**
   * Translate a key to the current language
   * @param key - Translation key (e.g., 'admin.dashboard.title')
   * @returns Translated string
   */
  const t = useCallback((key: string): string => {
    return i18n_t(key as keyof typeof translations.en, language);
  }, [language]);

  return { t, language, setLanguage };
}
