import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { translations, t as i18n_t, Lang } from '../lib/i18n';

interface PaymentSuccessProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

/**
 * PaymentSuccess page - shown after successful payment completion
 *
 * URL: /payment/success
 * Optional query params:
 * - purchase_id: ID of the completed purchase (for reference)
 */
const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Fallback if props are not passed (though App.tsx should pass them)
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  // Get optional purchase details from URL params
  const purchaseId = searchParams.get('purchase_id');

  const handleReturnToAnalysis = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        {/* Success checkmark */}
        <div className="text-6xl mb-6" role="img" aria-label="Success">
          <span className="inline-block animate-bounce">&#x2705;</span>
        </div>

        {/* Main heading */}
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          {t('payment.success.title')}
        </h1>

        {/* Confirmation message */}
        <p className="text-muted-foreground mb-8">
          {t('payment.success.subtitle')}
        </p>

        {/* Return button */}
        <Button
          onClick={handleReturnToAnalysis}
          size="lg"
          className="min-w-[200px]"
        >
          {t('payment.success.button.backToAnalysis')}
        </Button>

        {/* Optional purchase ID reference */}
        {purchaseId && (
          <p className="text-xs text-muted-foreground mt-6">
            {t('payment.success.purchaseId')}{purchaseId}
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
