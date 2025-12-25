import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';

/**
 * PaymentSuccess page - shown after successful payment completion
 *
 * URL: /payment/success
 * Optional query params:
 * - purchase_id: ID of the completed purchase (for reference)
 */
const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
          Спасибо за покупку!
        </h1>

        {/* Confirmation message */}
        <p className="text-muted-foreground mb-8">
          Кредиты добавлены на ваш счёт
        </p>

        {/* Return button */}
        <Button
          onClick={handleReturnToAnalysis}
          size="lg"
          className="min-w-[200px]"
        >
          Вернуться к анализу
        </Button>

        {/* Optional purchase ID reference */}
        {purchaseId && (
          <p className="text-xs text-muted-foreground mt-6">
            ID покупки: {purchaseId}
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
