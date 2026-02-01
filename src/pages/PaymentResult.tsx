import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { translations, t as i18n_t, Lang } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import { getCancellationI18nKey } from '../constants/payment';

type PaymentStatus = 'success' | 'canceled' | 'unknown';

interface StatusConfig {
  icon: string;
  titleKey: string;
  subtitleKey: string;
}

interface PaymentResultProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

const STATUS_CONFIGS: Record<PaymentStatus, StatusConfig> = {
  success: {
    icon: '✅',
    titleKey: 'payment.result.success.title',
    subtitleKey: 'payment.result.success.subtitle',
  },
  canceled: {
    icon: '❌',
    titleKey: 'payment.result.canceled.title',
    subtitleKey: 'payment.result.canceled.subtitle',
  },
  unknown: {
    icon: '❓',
    titleKey: 'payment.result.unknown.title',
    subtitleKey: 'payment.result.unknown.subtitle',
  },
};

const PaymentResult: React.FC<PaymentResultProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('unknown');
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fallback if props are not passed (though App.tsx should pass them)
  const language = propLanguage || 'en';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const purchaseIdParam = searchParams.get('purchase_id');

    if (statusParam === 'success') {
      setStatus('success');
      if (purchaseIdParam) {
        setPurchaseId(purchaseIdParam);
      }
    } else if (statusParam === 'canceled') {
      setStatus('canceled');
      if (purchaseIdParam) {
        setPurchaseId(purchaseIdParam);
        // Fetch cancellation reason from database (secure approach)
        const fetchCancellationReason = async () => {
          setLoading(true);
          try {
            const { data } = await supabase
              .from('purchases')
              .select('cancellation_reason')
              .eq('id', purchaseIdParam)
              .single();

            if (data?.cancellation_reason) {
              setCancellationReason(data.cancellation_reason);
            }
          } catch (error) {
            console.error('Error fetching cancellation reason:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchCancellationReason();
      }
    } else {
      setStatus('unknown');
    }
  }, [searchParams]);

  // Get the appropriate cancellation message based on reason
  const getCancellationMessage = (): string => {
    if (loading) {
      return '...';
    }
    if (!cancellationReason) {
      return t('payment.result.canceled.subtitle');
    }
    const messageKey = getCancellationI18nKey(cancellationReason);
    return t(messageKey as keyof typeof translations.en);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleRetryPayment = () => {
    navigate('/pricing');
  };

  const handleGoToAnalysis = () => {
    navigate('/');
  };

  const config = STATUS_CONFIGS[status];

  const renderButtons = () => {
    switch (status) {
      case 'success':
        return (
          <Button onClick={handleGoToAnalysis} size="lg">
            {t('payment.result.button.backToAnalysis')}
          </Button>
        );
      case 'canceled':
        return (
          <>
            <Button onClick={handleRetryPayment} size="lg">
              {t('payment.result.button.retry')}
            </Button>
            <Button onClick={handleGoHome} variant="outline" size="lg">
              {t('payment.result.button.home')}
            </Button>
          </>
        );
      case 'unknown':
      default:
        return (
          <Button onClick={handleGoHome} size="lg">
            {t('payment.result.button.home')}
          </Button>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="text-6xl mb-6" role="img" aria-label={t(config.titleKey as keyof typeof translations.en)}>
          {config.icon}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          {t(config.titleKey as keyof typeof translations.en)}
        </h1>

        {/* Subtitle - show detailed cancellation reason for canceled payments */}
        <p className="text-muted-foreground mb-8">
          {status === 'canceled' ? getCancellationMessage() : t(config.subtitleKey as keyof typeof translations.en)}
        </p>

        {/* Purchase ID for success status */}
        {status === 'success' && purchaseId && (
          <p className="text-sm text-muted-foreground mb-6">
            {t('payment.result.purchaseId')}<span className="font-mono">{purchaseId}</span>
          </p>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {renderButtons()}
        </div>
      </div>
    </div>
  );
};

export default PaymentResult;
