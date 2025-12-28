import React from 'react';
import { Button } from '../../components/ui/button';

interface LinkLoginRequiredProps {
  t: (key: string) => string;
  onLogin: () => void;
  onGoHome: () => void;
}

export const LinkLoginRequired: React.FC<LinkLoginRequiredProps> = ({
  t,
  onLogin,
  onGoHome
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-6" role="img" aria-label="Login">
        <span className="inline-block">🔐</span>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-foreground">
        {t('link.error.loginRequired')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('link.subtitle')}
      </p>
      <div className="flex gap-4 justify-center">
        <Button onClick={onLogin} size="lg" variant="default">
          {t('link.button.login')}
        </Button>
        <Button onClick={onGoHome} size="lg" variant="outline">
          {t('link.button.goHome')}
        </Button>
      </div>
    </div>
  </div>
);
