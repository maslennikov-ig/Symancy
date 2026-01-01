/**
 * Language Step - Onboarding Step 2
 *
 * Second step of the onboarding flow for language selection.
 * Shows 3 language options with flag emojis.
 *
 * @module pages/Onboarding/Language
 */
import React, { useCallback, useEffect } from 'react';
import { translations, Lang } from '../../lib/i18n';
import { type Language } from '../../hooks/useCloudStorage';
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp';
import { useMainButton } from '../../hooks/useMainButton';

/**
 * LanguageStepProps - Props for LanguageStep component
 */
interface LanguageStepProps {
  /** Current language */
  language: Lang;
  /** Translation function */
  t: (key: keyof typeof translations.en) => string;
  /** Callback when user selects a language */
  onLanguageSelect: (lang: Language) => void;
  /** Currently selected language */
  currentLanguage: Language;
}

/**
 * Language option configuration
 */
interface LanguageOption {
  code: Language;
  flag: string;
  name: string;
  nativeName: string;
}

/**
 * Available language options
 */
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'ru', flag: '🇷🇺', name: 'Russian', nativeName: 'Русский' },
  { code: 'en', flag: '🇬🇧', name: 'English', nativeName: 'English' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese', nativeName: '中文' },
];

/**
 * LanguageStep - Onboarding Step 2
 *
 * Shows:
 * - Globe emoji
 * - Title in 3 languages
 * - 3 language buttons with flags
 */
export const LanguageStep: React.FC<LanguageStepProps> = ({
  language,
  t,
  onLanguageSelect,
  currentLanguage,
}) => {
  const { hapticFeedback } = useTelegramWebApp();

  // Hide MainButton for this step (language buttons handle navigation)
  useMainButton({
    visible: false,
  });

  /**
   * Handle language button click
   */
  const handleLanguageClick = useCallback(
    (lang: Language) => {
      hapticFeedback.selection();
      onLanguageSelect(lang);
    },
    [onLanguageSelect, hapticFeedback]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      {/* Globe emoji */}
      <div className="text-7xl mb-8">
        <span role="img" aria-label="Globe">
          🌐
        </span>
      </div>

      {/* Title in 3 languages - always shows multilingual */}
      <h1 className="text-2xl font-bold text-foreground mb-8">
        Choose language / Выберите язык / 选择语言
      </h1>

      {/* Language buttons */}
      <div className="w-full max-w-xs space-y-3">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.code}
            onClick={() => handleLanguageClick(option.code)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200
              ${
                currentLanguage === option.code
                  ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                  : 'bg-card hover:bg-accent text-card-foreground border border-border'
              }
            `}
          >
            {/* Flag emoji */}
            <span className="text-2xl">{option.flag}</span>

            {/* Language name */}
            <span className="text-lg font-medium">{option.nativeName}</span>

            {/* Checkmark for selected */}
            {currentLanguage === option.code && (
              <span className="ml-auto text-xl">✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Hint text */}
      <p className="mt-8 text-sm text-muted-foreground">
        {language === 'ru'
          ? 'Вы можете изменить язык позже в настройках'
          : language === 'zh'
          ? '您可以稍后在设置中更改语言'
          : 'You can change the language later in settings'}
      </p>
    </div>
  );
};
