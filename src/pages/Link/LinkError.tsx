import React from 'react';
import { Button } from '../../components/ui/button';

interface LinkErrorProps {
  t: (key: string) => string;
  errorMessage: string;
  onRetry: () => void;
  onGoHome: () => void;
}

export const LinkError: React.FC<LinkErrorProps> = ({
  t,
  errorMessage,
  onRetry,
  onGoHome
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-6" role="img" aria-label="Error">
        <span className="inline-block">❌</span>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-destructive">
        {t('error.title')}
      </h1>
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-8">
        <p className="text-destructive font-medium">{errorMessage}</p>
      </div>
      <div className="flex gap-4 justify-center">
        <Button onClick={onRetry} size="lg" variant="default">
          {t('payment.error.retry')}
        </Button>
        <Button onClick={onGoHome} size="lg" variant="outline">
          {t('link.button.goHome')}
        </Button>
      </div>
    </div>
  </div>
);
