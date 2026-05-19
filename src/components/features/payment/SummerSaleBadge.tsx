import React from 'react';
import { translations } from '../../../lib/i18n';
import { cn } from '../../../lib/utils';

interface SummerSaleBadgeProps {
  t: (key: keyof typeof translations.en) => string;
  size?: 'sm' | 'md';
  className?: string;
}

// Small inline badge shown next to a discounted tariff price.
// Used by TariffCard (modal) and Pricing.tsx (landing).
export function SummerSaleBadge({ t, size = 'sm', className }: SummerSaleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide',
        'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
        'shadow-sm',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span aria-hidden="true">☀️</span>
      <span>{t('summerSale.badge')}</span>
    </span>
  );
}
