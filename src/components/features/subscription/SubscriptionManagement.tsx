import React, { useEffect, useState, useCallback } from 'react';
import type { Subscription, SubscriptionPayment } from '../../../types/subscription';
import { SUBSCRIPTION_TIERS } from '../../../types/subscription';
import {
  getActiveSubscription,
  cancelSubscription,
  getSubscriptionPaymentHistory,
} from '../../../services/subscriptionService';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { cn } from '../../../lib/utils';

interface SubscriptionManagementProps {
  t: (key: string) => string;
  onChangePlan?: () => void;
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

export function SubscriptionManagement({ t, onChangePlan }: SubscriptionManagementProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sub = await getActiveSubscription();
      setSubscription(sub);
      if (sub) {
        const hist = await getSubscriptionPaymentHistory(sub.id);
        setPayments(hist);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = useCallback(async () => {
    if (!subscription) return;
    setCancelLoading(true);
    try {
      const result = await cancelSubscription(subscription.id);
      if (result.success) {
        setShowCancelConfirm(false);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancelLoading(false);
    }
  }, [subscription, fetchData]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t('credits.balance.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <div className="text-center text-destructive">
            <p className="font-medium">{t('credits.balance.error.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active subscription
  if (!subscription) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('subscription.manage.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t('subscription.manage.noSubscription')}</p>
          {onChangePlan && (
            <Button onClick={onChangePlan} className="w-full">
              {t('subscription.manage.subscribe')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const tierConfig = SUBSCRIPTION_TIERS.find((tc) => tc.tier === subscription.tier);
  const statusKey = `subscription.status.${subscription.status}` as string;

  return (
    <div className="space-y-4 w-full">
      {/* Current Plan Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('subscription.manage.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan & Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('subscription.manage.currentPlan')}
              </p>
              <p className="text-lg font-bold">
                {tierConfig ? t(tierConfig.nameKey) : subscription.tier}
              </p>
            </div>
            <span
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full',
                statusStyles[subscription.status] || statusStyles.pending
              )}
            >
              {t(statusKey)}
            </span>
          </div>

          {/* Credits per month */}
          {tierConfig && (
            <div>
              <p className="text-sm text-muted-foreground">
                {t('subscription.manage.creditsPerMonth')}
              </p>
              <p className="font-medium">
                {tierConfig.basicCreditsPerMonth} {t('credits.type.basic')}
                {tierConfig.cassandraCreditsPerMonth > 0 && (
                  <> + {tierConfig.cassandraCreditsPerMonth} {t('credits.type.cassandra')}</>
                )}
              </p>
            </div>
          )}

          {/* Next billing / Expiry */}
          {subscription.status === 'active' && subscription.next_billing_date && (
            <div>
              <p className="text-sm text-muted-foreground">
                {t('subscription.manage.nextBilling')}
              </p>
              <p className="font-medium">{formatDate(subscription.next_billing_date)}</p>
            </div>
          )}
          {subscription.status === 'canceled' && subscription.expires_at && (
            <div>
              <p className="text-sm text-muted-foreground">
                {t('subscription.manage.expiresOn').replace('{date}', formatDate(subscription.expires_at))}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            {onChangePlan && (
              <Button variant="outline" onClick={onChangePlan} className="flex-1">
                {t('subscription.manage.changePlan')}
              </Button>
            )}
            {subscription.status === 'active' && (
              <Button
                variant="destructive"
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1"
              >
                {t('subscription.manage.cancel')}
              </Button>
            )}
          </div>

          {/* Cancel confirmation dialog */}
          {showCancelConfirm && (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
              <p className="text-sm">
                {t('subscription.manage.cancelConfirm').replace(
                  '{date}',
                  formatDate(subscription.current_period_end)
                )}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="flex-1"
                >
                  {cancelLoading ? (
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    t('subscription.manage.cancelConfirmButton')
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1"
                >
                  {t('subscription.manage.cancelKeep')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('subscription.manage.paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                      {t('subscription.manage.paymentHistory')}
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                      &#8381;
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        {formatDate(payment.period_start)} - {formatDate(payment.period_end)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {payment.amount_rub}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs rounded-full',
                            payment.status === 'succeeded'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : payment.status === 'canceled'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          )}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SubscriptionManagement;
