import React, { useState } from 'react';
import type { SubscriptionTier, BillingPeriod } from '../../../types/subscription';
import { SUBSCRIPTION_TIERS } from '../../../types/subscription';
import { BillingPeriodSelector } from './BillingPeriodSelector';
import { SubscriptionTierCard } from './SubscriptionTierCard';
import { LoaderIcon } from '../../icons/LoaderIcon';

interface SubscriptionSelectorProps {
  onClose: () => void;
  onSelectSubscription: (tier: SubscriptionTier, period: BillingPeriod) => void;
  isLoading?: boolean;
  currentTier?: SubscriptionTier;
  t: (key: string) => string;
}

export function SubscriptionSelector({
  onClose,
  onSelectSubscription,
  isLoading = false,
  currentTier,
  t,
}: SubscriptionSelectorProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(1);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-popover rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-display font-bold">{t('subscription.selector.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subscription.selector.subtitle')}
          </p>
        </div>

        {/* Billing period toggle */}
        <div className="flex justify-center mb-6">
          <BillingPeriodSelector value={billingPeriod} onChange={setBillingPeriod} t={t} />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Tier cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBSCRIPTION_TIERS.map((tierConfig) => (
            <SubscriptionTierCard
              key={tierConfig.tier}
              config={tierConfig}
              billingPeriod={billingPeriod}
              isCurrentPlan={currentTier === tierConfig.tier}
              onSelect={() => onSelectSubscription(tierConfig.tier, billingPeriod)}
              disabled={isLoading}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SubscriptionSelector;
