import React, { useEffect, useState, useCallback } from 'react';
import { TARIFFS, ProductType } from '../../types/payment';
import { TariffCard } from './TariffCard';
import { LoaderIcon } from '../LoaderIcon';
import { trackTariffView, trackPaymentStarted } from '../../services/analyticsService';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from '../../lib/i18n';

interface TariffSelectorProps {
  onClose: () => void;
  onSelectTariff: (productType: ProductType) => void;
  isLoading?: boolean;
  /** Optional message to display above tariffs (e.g., "For analysis you need a credit") */
  message?: string;
}

const TariffSelector: React.FC<TariffSelectorProps> = ({
  onClose,
  onSelectTariff,
  isLoading = false,
  message,
}) => {
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);

  useEffect(() => {
     // Sync language with local storage
     const savedLang = localStorage.getItem('language');
     if (savedLang && translations.hasOwnProperty(savedLang)) {
        setLanguage(savedLang as Lang);
     }
  }, []);

  const t = useCallback((key: keyof typeof translations.en) => {
    return i18n_t(key, language);
  }, [language]);

  // Track tariff view on modal mount
  useEffect(() => {
    trackTariffView();
  }, []);

  // Handle tariff selection with analytics tracking
  const handleSelectTariff = (productType: ProductType) => {
    const tariff = TARIFFS.find((t) => t.type === productType);
    if (tariff) {
      trackPaymentStarted(productType, tariff.price);
    }
    onSelectTariff(productType);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tariff-selector-title"
    >
      <div
        className="bg-popover text-popover-foreground rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none"
          aria-label={t('payment.selector.close')}
          disabled={isLoading}
        >
          &times;
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2
            id="tariff-selector-title"
            className="text-2xl font-display font-bold"
          >
            {t('payment.selector.title')}
          </h2>
          {message ? (
            <p className="text-primary mt-2 text-sm font-medium bg-primary/10 rounded-lg px-3 py-2">
              {message}
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {t('payment.selector.subtitle')}
            </p>
          )}
        </div>

        {/* Tariff grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TARIFFS.map((tariff) => (
            <TariffCard
              key={tariff.type}
              tariff={tariff}
              onSelect={() => handleSelectTariff(tariff.type)}
              disabled={isLoading}
              language={language}
              t={t as any}
            />
          ))}
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-popover/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {t('payment.loading.creating')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TariffSelector;
