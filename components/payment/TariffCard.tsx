import React from 'react';
import { Tariff } from '../../types/payment';
import { cn } from '../../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { translations, Lang } from '../../lib/i18n';

interface TariffCardProps {
  tariff: Tariff;
  /** @deprecated Use onClick instead */
  onSelect?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  disabled?: boolean;
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

const creditTypeBadgeStyles: Record<Tariff['creditType'], string> = {
  basic: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  cassandra: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

// Use generic translations or specific keys if we add them later
const creditTypeLabels: Record<Tariff['creditType'], string> = {
  basic: 'Basic',
  pro: 'PRO',
  cassandra: 'Cassandra',
};

function formatCredits(count: number, t: (key: string) => string): string {
    // Simple pluralization logic could be improved with a proper library
    // For now, let's use a generic format or key if available
    // Assuming simple structure for brevity in this refactor
    if (count === 1) return `1 ${t('pricing.tariff.basic.feature.1').split(' ')[1] || 'credit'}`;
    return `${count} credits`; // Fallback, ideally add specific keys for "credits"
}

export function TariffCard({ tariff, onSelect, onClick, isSelected = false, disabled = false, t }: TariffCardProps) {
  const handleClick = () => {
    if (!disabled) {
      // Support both onClick and legacy onSelect
      (onClick ?? onSelect)?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      (onClick ?? onSelect)?.();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:border-primary hover:shadow-md hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected && 'border-primary ring-2 ring-primary shadow-md',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-sm hover:border-border'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{t(tariff.name as any)}</CardTitle>
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap',
              creditTypeBadgeStyles[tariff.creditType]
            )}
          >
            {creditTypeLabels[tariff.creditType]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">{tariff.price}</span>
          <span className="text-lg text-muted-foreground">&#8381;</span>
        </div>
        <CardDescription className="text-sm">
          {t(tariff.description as any)}
        </CardDescription>
        <p className="text-sm font-medium text-muted-foreground">
           {tariff.credits} Credits
        </p>
      </CardContent>
    </Card>
  );
}
