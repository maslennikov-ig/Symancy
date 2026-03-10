import React from 'react';
import type { BillingPeriod } from '../../../types/subscription';
import { BILLING_DISCOUNTS } from '../../../types/subscription';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface BillingPeriodSelectorProps {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  t: (key: string) => string;
}

const PERIOD_OPTIONS: { value: BillingPeriod; labelKey: string }[] = [
  { value: 1, labelKey: 'subscription.billing.monthly' },
  { value: 3, labelKey: 'subscription.billing.quarterly' },
  { value: 6, labelKey: 'subscription.billing.semiannual' },
  { value: 12, labelKey: 'subscription.billing.annual' },
];

export function BillingPeriodSelector({ value, onChange, t }: BillingPeriodSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(val) => {
        if (val) onChange(Number(val) as BillingPeriod);
      }}
      className="w-full flex flex-wrap"
    >
      {PERIOD_OPTIONS.map((option) => {
        const discount = BILLING_DISCOUNTS[option.value];
        return (
          <ToggleGroupItem
            key={option.value}
            value={String(option.value)}
            className="flex-1 min-w-[70px] text-xs sm:text-sm"
          >
            <span className="flex flex-col items-center gap-0.5">
              <span>{t(option.labelKey)}</span>
              {discount > 0 && (
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                  {t('subscription.billing.discount').replace('{percent}', String(discount))}
                </span>
              )}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
