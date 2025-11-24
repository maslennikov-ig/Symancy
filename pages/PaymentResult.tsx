import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';

type PaymentStatus = 'success' | 'canceled' | 'unknown';

interface StatusConfig {
  icon: string;
  title: string;
  subtitle: string;
}

const STATUS_CONFIGS: Record<PaymentStatus, StatusConfig> = {
  success: {
    icon: '✅',
    title: 'Оплата прошла успешно!',
    subtitle: 'Кредиты добавлены на ваш счёт',
  },
  canceled: {
    icon: '❌',
    title: 'Оплата отменена',
    subtitle: 'Вы можете попробовать снова',
  },
  unknown: {
    icon: '❓',
    title: 'Что-то пошло не так',
    subtitle: 'Статус платежа неизвестен. Проверьте историю покупок.',
  },
};

const PaymentResult: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('unknown');
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

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
    } else {
      setStatus('unknown');
    }
  }, [searchParams]);

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
            Вернуться к анализу
          </Button>
        );
      case 'canceled':
        return (
          <>
            <Button onClick={handleRetryPayment} size="lg">
              Попробовать снова
            </Button>
            <Button onClick={handleGoHome} variant="outline" size="lg">
              На главную
            </Button>
          </>
        );
      case 'unknown':
      default:
        return (
          <Button onClick={handleGoHome} size="lg">
            На главную
          </Button>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="text-6xl mb-6" role="img" aria-label={config.title}>
          {config.icon}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          {config.title}
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground mb-8">
          {config.subtitle}
        </p>

        {/* Purchase ID for success status */}
        {status === 'success' && purchaseId && (
          <p className="text-sm text-muted-foreground mb-6">
            ID покупки: <span className="font-mono">{purchaseId}</span>
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
