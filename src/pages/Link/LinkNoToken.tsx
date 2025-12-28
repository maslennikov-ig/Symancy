import React from 'react';
import { Button } from '../../components/ui/button';

interface LinkNoTokenProps {
  t: (key: string) => string;
  onGoHome: () => void;
}

export const LinkNoToken: React.FC<LinkNoTokenProps> = ({ t, onGoHome }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-6" role="img" aria-label="Error">
        <span className="inline-block">❌</span>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        {t('link.error.noToken')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('link.subtitle')}
      </p>
      <Button onClick={onGoHome} size="lg" className="min-w-[200px]">
        {t('link.button.goHome')}
      </Button>
    </div>
  </div>
);
