import React from 'react';
import type { SubscriptionTierConfig, BillingPeriod } from '../../../types/subscription';
import { calculateSubscriptionPrice } from '../../../types/subscription';
import { cn } from '../../../lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';

interface SubscriptionTierCardProps {
  config: SubscriptionTierConfig;
  billingPeriod: BillingPeriod;
  isCurrentPlan: boolean;
  onSelect: () => void;
  disabled: boolean;
  t: (key: string) => string;
}

export function SubscriptionTierCard({
  config,
  billingPeriod,
  isCurrentPlan,
  onSelect,
  disabled,
  t,
}: SubscriptionTierCardProps) {
  const isFree = config.tier === 'free';
  const pricing = isFree ? null : calculateSubscriptionPrice(config.tier, billingPeriod);
  const discount = pricing?.discount ?? 0;

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all duration-200',
        config.highlighted && 'border-primary shadow-md',
        isCurrentPlan && 'ring-2 ring-primary',
      )}
    >
      {/* Highlighted badge */}
      {config.highlighted && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full whitespace-nowrap">
          {t('subscription.selector.popular') || 'Popular'}
        </div>
      )}

      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t(config.nameKey)}</CardTitle>
        <CardDescription>
          {isFree ? (
            <span className="text-2xl font-bold text-foreground">
              {t('subscription.selector.free')}
            </span>
          ) : pricing ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {pricing.monthlyAmount}
                </span>
                <span className="text-muted-foreground">
                  &#8381;{t('subscription.billing.perMonth')}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm line-through text-muted-foreground">
                    {pricing.baseMonthly} &#8381;
                  </span>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t('subscription.billing.discount').replace('{percent}', String(discount))}
                  </span>
                </div>
              )}
              {billingPeriod > 1 && (
                <p className="text-xs text-muted-foreground">
                  {t('subscription.billing.total').replace('{amount}', String(pricing.totalAmount))}
                </p>
              )}
            </div>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Credits per month */}
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {t('subscription.manage.creditsPerMonth')}:
          </p>
          <p>
            {config.basicCreditsPerMonth} {t('credits.type.basic')}
            {config.cassandraCreditsPerMonth > 0 && (
              <> + {config.cassandraCreditsPerMonth} {t('credits.type.cassandra')}</>
            )}
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-1.5">
          {config.features.map((featureKey) => (
            <li key={featureKey} className="flex items-start gap-2 text-sm">
              <svg
                className="w-4 h-4 mt-0.5 text-green-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t(featureKey)}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            {t('subscription.selector.currentPlan')}
          </Button>
        ) : (
          <Button
            className="w-full"
            variant={config.highlighted ? 'default' : 'outline'}
            onClick={onSelect}
            disabled={disabled || isFree}
          >
            {isFree ? t('subscription.selector.free') : t('subscription.selector.subscribe')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
