import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { LoaderIcon } from '../components/icons/LoaderIcon';
import { translations, Lang } from '../lib/i18n';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { MultiImageUploader } from '../components/features/analysis/MultiImageUploader';
import {
  ComparisonResult,
  type ComparisonResultData,
} from '../components/features/analysis/ComparisonResult';
import { getUserCredits } from '../services/paymentService';
import { supabase, createSupabaseWithToken } from '../lib/supabaseClient';
import { getStoredToken } from '../services/authService';
import type { UserCredits } from '../types/payment';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type CompareMode = 'dynamics' | 'compatibility';
type FormStatus = 'idle' | 'processing' | 'result' | 'error';

interface CompareCoffeeResponse {
  success?: boolean;
  result?: ComparisonResultData;
  analysisId?: string;
  pairedAnalysisId?: string;
  compareMode?: CompareMode;
  error?: string;
  code?: string;
}

interface CompareProps {
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

/**
 * Read a {@link File} as base64, stripping the `data:<mime>;base64,` prefix.
 * Resolves to `{ data, mimeType }`.
 */
function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader payload'));
        return;
      }
      const [header, payload] = result.split(',');
      if (!payload) {
        reject(new Error('Invalid base64 payload'));
        return;
      }
      const headerMimeMatch = header?.match(/:(.*?);/);
      const mimeType = headerMimeMatch?.[1] || file.type || 'image/jpeg';
      resolve({ data: payload, mimeType });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Cheap mime normaliser: the Edge Function only accepts a small subset.
 * Falls back to `image/jpeg` for unsupported types (HEIC, etc.).
 */
function normaliseMime(mime: string): 'image/webp' | 'image/jpeg' | 'image/png' {
  if (mime === 'image/webp' || mime === 'image/jpeg' || mime === 'image/png') {
    return mime;
  }
  return 'image/jpeg';
}

/* -------------------------------------------------------------------------- */
/*                              Tabs primitive                                */
/* -------------------------------------------------------------------------- */

interface TabConfig {
  id: CompareMode;
  labelKey: keyof typeof translations.en;
}

const TABS: TabConfig[] = [
  { id: 'dynamics', labelKey: 'compare.tab.dynamics' },
  { id: 'compatibility', labelKey: 'compare.tab.compatibility' },
];

interface CompareTabsProps {
  active: CompareMode;
  onChange: (mode: CompareMode) => void;
  t: (key: keyof typeof translations.en) => string;
}

const CompareTabs: React.FC<CompareTabsProps> = ({ active, onChange, t }) => {
  return (
    <div
      role="tablist"
      aria-label={t('compare.title')}
      className="inline-flex w-full sm:w-auto rounded-lg bg-muted p-1"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`compare-panel-${tab.id}`}
            id={`compare-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm font-medium rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Upgrade card                                  */
/* -------------------------------------------------------------------------- */

interface UpgradeCardProps {
  mode: CompareMode;
  t: (key: keyof typeof translations.en) => string;
}

const UpgradeCard: React.FC<UpgradeCardProps> = ({ mode, t }) => {
  const navigate = useNavigate();
  const messageKey: keyof typeof translations.en =
    mode === 'dynamics' ? 'compare.upgrade.dynamics' : 'compare.upgrade.compatibility';
  const titleKey: keyof typeof translations.en =
    mode === 'dynamics' ? 'compare.dynamics.title' : 'compare.compatibility.title';

  return (
    <Card className="w-full bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-display">{t('compare.locked.title')}</CardTitle>
        <CardDescription className="mt-1">{t(titleKey)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{t(messageKey)}</p>
        <Button
          type="button"
          size="lg"
          onClick={() => navigate('/pricing')}
          className="self-start"
        >
          {t('compare.upgrade.cta')}
        </Button>
      </CardContent>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                              CompareForm                                   */
/* -------------------------------------------------------------------------- */

interface CompareFormProps {
  mode: CompareMode;
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

const CompareForm: React.FC<CompareFormProps> = ({ mode, language, t }) => {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [result, setResult] = useState<ComparisonResultData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Used to remount the uploader after a reset, so its internal slot state
  // (file refs, object URLs) is also cleared.
  const [uploaderKey, setUploaderKey] = useState<number>(0);

  const firstLabel =
    mode === 'compatibility'
      ? t('compare.firstLabel.compatibility')
      : t('compare.firstLabel');
  const secondLabel =
    mode === 'compatibility'
      ? t('compare.secondLabel.compatibility')
      : t('compare.secondLabel');

  const handleImagesReady = useCallback(
    async (firstImage: File, secondImage: File) => {
      setStatus('processing');
      setErrorMessage(null);
      setResult(null);

      try {
        const [first, second] = await Promise.all([
          fileToBase64(firstImage),
          fileToBase64(secondImage),
        ]);

        const payload = {
          firstImage: first.data,
          firstMimeType: normaliseMime(first.mimeType),
          secondImage: second.data,
          secondMimeType: normaliseMime(second.mimeType),
          compareMode: mode,
          language,
        };

        // The Edge Function authenticates via Authorization header. We pass
        // the explicit Telegram JWT when present, otherwise let supabase-js
        // attach the Supabase Auth session token automatically.
        const telegramToken = getStoredToken();
        const client = telegramToken ? createSupabaseWithToken(telegramToken) : supabase;

        const { data, error } = await client.functions.invoke<CompareCoffeeResponse>(
          'compare-coffee',
          { body: payload },
        );

        if (error) {
          console.error('[Compare] Edge Function error:', error);
          throw new Error(error.message || t('compare.error'));
        }

        if (!data || data.success === false || !data.result) {
          const msg = data?.error || t('compare.error');
          throw new Error(msg);
        }

        setResult(data.result);
        setStatus('result');
      } catch (err) {
        const message = err instanceof Error ? err.message : t('compare.error');
        console.error('[Compare] comparison failed:', err);
        setErrorMessage(message);
        setStatus('error');
        toast.error(message);
      }
    },
    [language, mode, t],
  );

  const handleReset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setErrorMessage(null);
    setUploaderKey((k) => k + 1);
  }, []);

  if (status === 'processing') {
    return (
      <div
        className="flex flex-col items-center justify-center text-center p-8 min-h-[16rem]"
        role="status"
        aria-live="polite"
      >
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground animate-pulse">
          {t('compare.processing')}
        </p>
      </div>
    );
  }

  if (status === 'result' && result) {
    return <ComparisonResult result={result} mode={mode} t={t} onReset={handleReset} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {status === 'error' && errorMessage ? (
        <div
          className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3"
          role="alert"
        >
          <p className="font-medium">{t('compare.error')}</p>
          <p className="text-destructive/80 mt-1 break-words">{errorMessage}</p>
          <Button
            type="button"
            variant="link"
            className="mt-1 px-0"
            onClick={() => {
              setStatus('idle');
              setErrorMessage(null);
            }}
          >
            {t('compare.error.tryAgain')}
          </Button>
        </div>
      ) : null}

      <MultiImageUploader
        key={uploaderKey}
        t={t}
        onImagesReady={handleImagesReady}
        firstLabel={firstLabel}
        secondLabel={secondLabel}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Compare page                                  */
/* -------------------------------------------------------------------------- */

const Compare: React.FC<CompareProps> = ({ language, t }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<CompareMode>('dynamics');
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState<boolean>(false);

  /**
   * Fetch the current user's credit balance. Re-runs whenever auth state
   * changes (e.g. after sign-in) so the tabs unlock without a manual reload.
   */
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setCredits(null);
      return;
    }

    setCreditsLoading(true);
    getUserCredits()
      .then((data) => {
        if (!cancelled) setCredits(data);
      })
      .catch((err) => {
        console.error('[Compare] Failed to fetch credits:', err);
        if (!cancelled) setCredits(null);
      })
      .finally(() => {
        if (!cancelled) setCreditsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const hasPro = useMemo(() => (credits?.pro_credits ?? 0) > 0, [credits]);
  const hasCassandra = useMemo(
    () => (credits?.cassandra_credits ?? 0) > 0,
    [credits],
  );

  /* ------------------------------ render branches ------------------------- */

  const renderTabBody = () => {
    // Auth/credits still loading — show centered spinner so we don't flash
    // a misleading "upgrade" CTA at users who actually have credits.
    if (authLoading || creditsLoading) {
      return (
        <div className="flex items-center justify-center min-h-[16rem]" role="status">
          <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <Card className="w-full bg-card/80 backdrop-blur-sm">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t('compare.auth.required')}</p>
          </CardContent>
        </Card>
      );
    }

    if (activeTab === 'dynamics') {
      return hasPro ? (
        <CompareForm mode="dynamics" language={language} t={t} />
      ) : (
        <UpgradeCard mode="dynamics" t={t} />
      );
    }

    return hasCassandra ? (
      <CompareForm mode="compatibility" language={language} t={t} />
    ) : (
      <UpgradeCard mode="compatibility" t={t} />
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl">
      <header className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
          {t('compare.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t('compare.subtitle')}
        </p>
      </header>

      <div className="flex justify-center mb-6 sm:mb-8">
        <CompareTabs active={activeTab} onChange={setActiveTab} t={t} />
      </div>

      <div
        id={`compare-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`compare-tab-${activeTab}`}
        className="w-full"
      >
        {renderTabBody()}
      </div>
    </div>
  );
};

export default Compare;
