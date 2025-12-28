import React from 'react';
import { Button } from '../../components/ui/button';

interface LinkSuccessProps {
  t: (key: string) => string;
  linkedUserName: string;
  onGoHome: () => void;
}

export const LinkSuccess: React.FC<LinkSuccessProps> = ({
  t,
  linkedUserName,
  onGoHome
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-6" role="img" aria-label="Success">
        <span className="inline-block animate-bounce">✅</span>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        {t('link.success.title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {linkedUserName
          ? t('link.success.subtitle').replace('{username}', linkedUserName)
          : t('link.success.subtitle').replace(' @{username}', '')}
      </p>
      <Button onClick={onGoHome} size="lg" className="min-w-[200px]">
        {t('link.button.goHome')}
      </Button>
    </div>
  </div>
);
