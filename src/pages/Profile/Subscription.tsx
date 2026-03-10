/**
 * Subscription Page - Manage subscription plan
 *
 * Displays current subscription status and allows managing it.
 * Located at /profile/subscription
 *
 * @module pages/Profile/Subscription
 */
import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { SubscriptionManagement } from '../../components/features/subscription/SubscriptionManagement';
import { SubscriptionSelector } from '../../components/features/subscription/SubscriptionSelector';
import { createSubscription } from '../../services/subscriptionService';
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
  const [showSelector, setShowSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [paymentData, setPaymentData] = useState<{
    confirmationToken: string;
    subscriptionId: string;
  } | null>(null);

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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--background)))',
        paddingBottom: '80px',
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
          borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            margin: '-8px',
            cursor: 'pointer',
            color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
          }}
        >
          {t('subscription.manage.title' as keyof typeof translations.en)}
        </h1>
      </header>

      {/* Content */}
      <div style={{ padding: '16px' }}>
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
                  setRefreshKey((k) => k + 1);
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
