import React, { useEffect, useState, useCallback } from 'react';
import { getPurchaseHistory } from '../../../services/paymentService';
import { TARIFFS, Purchase, PaymentStatus } from '../../../types/payment';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { cn } from '../../../lib/utils';
import { translations, Lang, detectInitialLanguage, t as i18n_t } from '../../../lib/i18n';

/**
 * Maps product_type to human-readable tariff name
 */
function getProductName(productType: Purchase['product_type']): string {
  const tariff = TARIFFS.find((t) => t.type === productType);
  return tariff?.name ?? productType;
}

/**
 * Formats date to Russian locale
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Status badge styles (labels are now i18n keys)
 */
const statusConfig: Record<PaymentStatus, { labelKey: keyof typeof translations.en; className: string }> = {
  pending: {
    labelKey: 'purchase.history.status.pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  succeeded: {
    labelKey: 'purchase.history.status.succeeded',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  canceled: {
    labelKey: 'purchase.history.status.canceled',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
};

interface PurchaseHistoryProps {
  /** Optional limit for initial fetch */
  limit?: number;
  /** Optional className for container */
  className?: string;
}

export function PurchaseHistory({ limit = 20, className }: PurchaseHistoryProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Lang>(detectInitialLanguage);

  useEffect(() => {
    // Sync language with local storage
    const savedLang = localStorage.getItem('language');
    if (savedLang && translations.hasOwnProperty(savedLang)) {
      setLanguage(savedLang as Lang);
    }
  }, []);

  const t = useCallback((key: keyof typeof translations.en) => {
    return i18n_t(key, language);
  }, [language]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const result = await getPurchaseHistory(limit);
        setPurchases(result.purchases);
        setTotal(result.total);
      } catch (err) {
        console.error('Failed to fetch purchase history:', err);
        setError(err instanceof Error ? err.message : t('purchase.history.error.loading'));
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [limit, t]);

  // Loading state
  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-12 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t('purchase.history.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            <p className="font-medium">{t('purchase.history.error.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (purchases.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="text-lg">{t('purchase.history.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('purchase.history.empty.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('purchase.history.empty.subtitle')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-lg">
          {t('purchase.history.title')}
          {total > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({total})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                  {t('purchase.history.table.tariff')}
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  {t('purchase.history.table.amount')}
                </th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                  {t('purchase.history.table.status')}
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  {t('purchase.history.table.date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => {
                const status = statusConfig[purchase.status];
                return (
                  <tr
                    key={purchase.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-2 font-medium">
                      {getProductName(purchase.product_type)}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums">
                      {purchase.amount_rub} &#8381;
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
                          status.className
                        )}
                      >
                        {t(status.labelKey)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">
                      {formatDate(purchase.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-3">
          {purchases.map((purchase) => {
            const status = statusConfig[purchase.status];
            return (
              <div
                key={purchase.id}
                className="p-4 rounded-lg border border-border/50 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {getProductName(purchase.product_type)}
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded-full',
                      status.className
                    )}
                  >
                    {t(status.labelKey)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(purchase.created_at)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {purchase.amount_rub} &#8381;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
