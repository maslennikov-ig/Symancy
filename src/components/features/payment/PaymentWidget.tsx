// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import YooWidget from 'react-yoomoneycheckoutwidget';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from '../../../lib/i18n';

interface PaymentWidgetProps {
  confirmationToken: string;
  purchaseId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onModalClose?: () => void;
  returnUrl?: string;
}

export function PaymentWidget({
  confirmationToken,
  purchaseId,
  onComplete,
  onError,
  onModalClose,
  returnUrl,
}: PaymentWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);
  const [widgetReady, setWidgetReady] = useState(false);

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

  // Delay widget mount to let React re-renders settle and prevent premature unmount
  useEffect(() => {
    const mountTimer = setTimeout(() => {
      setWidgetReady(true);
    }, 100);
    return () => clearTimeout(mountTimer);
  }, []);

  // Handle widget initialization complete
  useEffect(() => {
    if (!widgetReady) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [widgetKey, widgetReady]);

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
  // customization.modal=true: YooKassa renders a responsive full-screen modal that
  // fits mobile viewports natively (sym-6wb). Prevents horizontal overflow inside
  // our previous max-w-lg wrapper that clipped payment method buttons on the right.
  const widgetConfig = {
    confirmation_token: confirmationToken,
    return_url: computedReturnUrl,
    error_callback: handleError,
    customization: {
      modal: true,
      colors: {
        control_primary: '#8B4513', // Coffee brown theme color
      },
    },
  };

  // Loading overlay (shown until YooKassa mounts its own modal)
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-popover rounded-lg shadow-2xl p-6 max-w-sm w-full flex flex-col items-center space-y-4">
          <p className="text-destructive text-center">{error}</p>
          <div className="flex gap-2">
            <Button onClick={handleRetry} variant="outline">
              {t('payment.error.retry')}
            </Button>
            {onModalClose && (
              <Button onClick={onModalClose} variant="ghost">
                {t('payment.modal.close')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Pre-mount loading indicator (YooKassa modal takes ~100–500ms to appear) */}
      {(isLoading || !widgetReady) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 bg-popover px-4 py-3 rounded-lg shadow-lg">
            <LoaderIcon className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground text-sm">
              {t('payment.loading.widget')}
            </span>
          </div>
        </div>
      )}

      {/* YooKassa renders its own full-screen modal when customization.modal=true.
          No wrapper — let the widget own the overlay so mobile viewport works. */}
      {widgetReady && (
        <div className={cn('contents', isLoading ? 'opacity-0' : 'opacity-100')}>
          <YooWidget
            key={widgetKey}
            config={widgetConfig as any}
            onComplete={handleComplete}
            onModalClose={onModalClose}
          />
        </div>
      )}
    </>
  );
}

export default PaymentWidget;
