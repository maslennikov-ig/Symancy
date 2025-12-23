import React, { useState, useCallback, useEffect } from 'react';
import YooWidget from 'react-yoomoneycheckoutwidget';
import { LoaderIcon } from '../LoaderIcon';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from '../../lib/i18n';

interface PaymentWidgetProps {
  confirmationToken: string;
  purchaseId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  returnUrl?: string;
}

export function PaymentWidget({
  confirmationToken,
  purchaseId,
  onComplete,
  onError,
  returnUrl,
}: PaymentWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
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

  // Compute the return URL
  const computedReturnUrl =
    returnUrl ||
    `${window.location.origin}/payment/result?status=success&purchase_id=${purchaseId}`;

  // Handle widget initialization complete
  // The YooWidget library handles its own loading state via script loading
  // We set loading to false after a brief delay to allow widget to render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [widgetKey]);

  // Handle payment errors
  const handleError = useCallback(
    (widgetError: unknown) => {
      console.error('Payment widget error:', widgetError);
      const errorMessage = t('payment.error.widget');
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    },
    [onError, t]
  );

  // Handle payment completion
  const handleComplete = useCallback(() => {
    console.log('Payment completed successfully');
    onComplete?.();
  }, [onComplete]);

  // Retry loading the widget
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setWidgetKey((prev) => prev + 1);
  }, []);

  // Build widget configuration
  const widgetConfig = {
    confirmation_token: confirmationToken,
    return_url: computedReturnUrl,
    error_callback: handleError,
    customization: {
      colors: {
        control_primary: '#8B4513', // Coffee brown theme color
      },
    },
  };

  return (
    <div className="p-4">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            {t('payment.loading.widget')}
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <p className="text-destructive text-center">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            {t('payment.error.retry')}
          </Button>
        </div>
      )}

      {/* Payment widget container */}
      {!error && (
        <div
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'
          )}
        >
          <YooWidget
            key={widgetKey}
            config={widgetConfig as any}
            onComplete={handleComplete}
          />
        </div>
      )}
    </div>
  );
}

export default PaymentWidget;
