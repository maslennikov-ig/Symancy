import React from 'react';
import { LoaderIcon } from '../../components/icons/LoaderIcon';

interface LinkLoadingProps {
  t: (key: string) => string;
}

export const LinkLoading: React.FC<LinkLoadingProps> = ({ t }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
    <div className="text-center max-w-md">
      <LoaderIcon className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
      <p className="text-muted-foreground">{t('link.loading')}</p>
    </div>
  </div>
);
