/**
 * Subscription Page - Manage subscription plan
 *
 * Displays current subscription status and allows managing it.
 * Located at /profile/subscription
 *
 * @module pages/Profile/Subscription
 */
import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SubscriptionManagement } from '../../components/features/subscription/SubscriptionManagement';
import { SubscriptionSelector } from '../../components/features/subscription/SubscriptionSelector';
import { createSubscription, getActiveSubscription } from '../../services/subscriptionService';
import type { SubscriptionTier, BillingPeriod } from '../../types/subscription';
import { translations, Lang } from '../../lib/i18n';
import { LoaderIcon } from '../../components/icons/LoaderIcon';

const PaymentWidget = lazy(() => import('../../components/features/payment/PaymentWidget'));

interface SubscriptionPageProps {
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

function BackIcon(): React.ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function Subscription({ language, t }: SubscriptionPageProps): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSelector, setShowSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [paymentData, setPaymentData] = useState<{
    confirmationToken: string;
    subscriptionId: string;
  } | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'success' | 'timeout'>('idle');
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setPollingStatus('polling');

    pollingTimerRef.current = setInterval(async () => {
      try {
        const sub = await getActiveSubscription();
        if (sub && sub.status === 'active') {
          stopPolling();
          setPollingStatus('success');
          setRefreshKey((k) => k + 1);
          setTimeout(() => setPollingStatus('idle'), 5000);
        }
      } catch {
        // continue polling
      }
    }, 1500);

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setPollingStatus('timeout');
      setRefreshKey((k) => k + 1);
      setTimeout(() => setPollingStatus('idle'), 3000);
    }, 30000);
  }, [stopPolling]);

  // Detect return from 3DS redirect
  useEffect(() => {
    if (searchParams.get('from_payment') === '1') {
      setSearchParams({}, { replace: true });
      startPolling();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Escape key + scroll lock for payment modal
  useEffect(() => {
    if (!paymentData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaymentData(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [paymentData]);

  const handleSelectSubscription = useCallback(async (tier: SubscriptionTier, period: BillingPeriod) => {
    setIsLoading(true);
    setSubscriptionError(null);
    try {
      const result = await createSubscription(tier, period);
      setPaymentData({
        confirmationToken: result.confirmation_token,
        subscriptionId: result.subscription_id,
      });
      setShowSelector(false);
    } catch (err) {
      console.error('Subscription creation failed:', err);
      setSubscriptionError(err instanceof Error ? err.message : 'Subscription creation failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button
          onClick={handleBack}
          className="p-2 -m-2 cursor-pointer text-foreground flex items-center justify-center bg-transparent border-none"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1 className="m-0 text-lg font-semibold text-foreground">
          {t('subscription.manage.title' as keyof typeof translations.en)}
        </h1>
      </header>

      {/* Payment processing banner */}
      {pollingStatus === 'polling' && (
        <div className="mx-4 mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
          <LoaderIcon className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-primary">
            {t('subscription.payment.processing' as keyof typeof translations.en)}
          </span>
        </div>
      )}
      {pollingStatus === 'success' && (
        <div className="mx-4 mt-4 p-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            {t('subscription.payment.success' as keyof typeof translations.en)}
          </span>
        </div>
      )}
      {pollingStatus === 'timeout' && (
        <div className="mx-4 mt-4 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {t('subscription.payment.timeout' as keyof typeof translations.en)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <SubscriptionManagement
          t={t as (key: string) => string}
          language={language}
          onChangePlan={() => setShowSelector(true)}
          refreshKey={refreshKey}
        />
      </div>

      {/* Error toast */}
      {subscriptionError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span>{subscriptionError}</span>
          <button
            onClick={() => setSubscriptionError(null)}
            className="text-destructive-foreground/80 hover:text-destructive-foreground"
          >
            &times;
          </button>
        </div>
      )}

      {/* Subscription Selector Modal */}
      {showSelector && (
        <SubscriptionSelector
          onClose={() => setShowSelector(false)}
          onSelectSubscription={handleSelectSubscription}
          isLoading={isLoading}
          t={t as (key: string) => string}
        />
      )}

      {/* Payment Widget Modal */}
      {paymentData && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPaymentData(null)}
        >
          <div
            className="bg-popover rounded-lg shadow-2xl p-6 w-full max-w-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPaymentData(null)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-display font-bold mb-4 text-center">
              {t('payment.modal.title' as keyof typeof translations.en)}
            </h2>
            <Suspense fallback={<div className="flex items-center justify-center p-8"><LoaderIcon className="w-8 h-8 animate-spin" /></div>}>
              <PaymentWidget
                confirmationToken={paymentData.confirmationToken}
                purchaseId={paymentData.subscriptionId}
                onComplete={() => {
                  setPaymentData(null);
                  startPolling();
                }}
                onError={(err) => {
                  console.error('Payment error:', err);
                  setPaymentData(null);
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subscription;
