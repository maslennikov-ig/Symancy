import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

/* ── Types ─────────────────────────────────────────── */

interface Tariff {
  type: string;
  nameKey: string;
  price: string;
  priceNum: number;
  credits: number;
  descriptionKey: string;
  featureKeys: string[];
  highlighted?: boolean;
  accent: { strip: string; glow: string; icon: string; badge: string };
}

interface PricingProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
  onBuyTariff?: (productType: string) => void;
  isAuthenticated?: boolean;
}

/* ── Tariff data ───────────────────────────────────── */

const TARIFFS: Tariff[] = [
  {
    type: 'basic',
    nameKey: 'pricing.tariff.basic.name',
    price: '100 ₽',
    priceNum: 100,
    credits: 1,
    descriptionKey: 'pricing.tariff.basic.description',
    featureKeys: [
      'pricing.tariff.basic.feature.1',
      'pricing.tariff.basic.feature.2',
      'pricing.tariff.basic.feature.3',
    ],
    accent: {
      strip: 'from-emerald-600 to-emerald-400',
      glow: '',
      icon: '☕',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    },
  },
  {
    type: 'pack5',
    nameKey: 'pricing.tariff.pack5.name',
    price: '300 ₽',
    priceNum: 300,
    credits: 5,
    descriptionKey: 'pricing.tariff.pack5.description',
    featureKeys: [
      'pricing.tariff.pack5.feature.1',
      'pricing.tariff.pack5.feature.2',
      'pricing.tariff.pack5.feature.3',
      'pricing.tariff.pack5.feature.4',
    ],
    highlighted: true,
    accent: {
      strip: 'from-amber-500 to-yellow-400',
      glow: '0 0 30px rgba(245,158,11,0.15), 0 0 60px rgba(245,158,11,0.05)',
      icon: '✦',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    },
  },
  {
    type: 'pro',
    nameKey: 'pricing.tariff.pro.name',
    price: '500 ₽',
    priceNum: 500,
    credits: 1,
    descriptionKey: 'pricing.tariff.pro.description',
    featureKeys: [
      'pricing.tariff.pro.feature.1',
      'pricing.tariff.pro.feature.2',
      'pricing.tariff.pro.feature.3',
      'pricing.tariff.pro.feature.4',
    ],
    accent: {
      strip: 'from-violet-600 to-purple-400',
      glow: '',
      icon: '🔮',
      badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    },
  },
  {
    type: 'cassandra',
    nameKey: 'pricing.tariff.cassandra.name',
    price: '1 000 ₽',
    priceNum: 1000,
    credits: 1,
    descriptionKey: 'pricing.tariff.cassandra.description',
    featureKeys: [
      'pricing.tariff.cassandra.feature.1',
      'pricing.tariff.cassandra.feature.2',
      'pricing.tariff.cassandra.feature.3',
      'pricing.tariff.cassandra.feature.4',
    ],
    accent: {
      strip: 'from-amber-800 to-orange-600',
      glow: '',
      icon: '👁',
      badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-600/20',
    },
  },
];

const STEPS = [
  { num: '1', key: 'pricing.howItWorks.step1.text' },
  { num: '2', key: 'pricing.howItWorks.step2.text' },
  { num: '3', key: 'pricing.howItWorks.step3.text' },
  { num: '4', key: 'pricing.howItWorks.step4.text' },
];

/* ── Inline keyframes (injected once) ──────────────── */

const PRICING_STYLES = `
@keyframes pricing-rise {
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pricing-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes pricing-glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.10), 0 0 50px rgba(245,158,11,0.05); }
  50%      { box-shadow: 0 0 30px rgba(245,158,11,0.20), 0 0 60px rgba(245,158,11,0.08); }
}
`;

/* ── Component ─────────────────────────────────────── */

const Pricing: React.FC<PricingProps> = ({
  language: propLanguage,
  t: propT,
  onBuyTariff,
  isAuthenticated,
}) => {
  const navigate = useNavigate();
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  const handleBuy = (type: string) => {
    if (isAuthenticated && onBuyTariff) {
      onBuyTariff(type);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <style>{PRICING_STYLES}</style>

      <div
        className="flex flex-col items-center bg-gradient-to-b from-stone-50 via-stone-100/50 to-stone-50 dark:from-stone-950 dark:via-stone-900/50 dark:to-stone-950"
        style={{
          minHeight: '100%',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'var(--tg-content-safe-area-inset-top, 16px)',
          paddingBottom: 'var(--tg-content-safe-area-inset-bottom, 16px)',
        }}
      >
        <div className="w-full max-w-5xl px-4 py-6 sm:py-10">
          {/* ── Hero header ── */}
          <div
            className="text-center mb-10 sm:mb-14"
            style={{ animation: 'pricing-fade 0.6s ease-out both' }}
          >
            <p className="text-xs tracking-[0.3em] uppercase text-primary/70 mb-3 font-medium">
              Coffee Oracle
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground tracking-tight mb-4">
              {t('pricing.title')}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {t('pricing.subtitle')}
            </p>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className="block w-12 h-px bg-border" />
              <span className="text-primary/50 text-xs">✦</span>
              <span className="block w-12 h-px bg-border" />
            </div>
          </div>

          {/* ── Tariff cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mb-14 sm:mb-16 lg:items-end">
            {TARIFFS.map((tariff, i) => {
              const isPopular = !!tariff.highlighted;
              return (
                <div
                  key={tariff.type}
                  className={`relative ${isPopular ? 'lg:-mt-3 lg:mb-3 z-10' : ''}`}
                  style={{
                    animation: 'pricing-rise 0.55s ease-out both',
                    animationDelay: `${i * 100 + 100}ms`,
                  }}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                      <span className="inline-block px-4 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-primary text-primary-foreground shadow-md">
                        Popular
                      </span>
                    </div>
                  )}

                  <div
                    className={[
                      'group relative overflow-hidden rounded-xl border transition-all duration-300',
                      'bg-card/80 backdrop-blur-sm',
                      'hover:-translate-y-1 hover:shadow-lg',
                      isPopular
                        ? 'border-primary/40 dark:border-primary/30 shadow-md'
                        : 'border-border hover:border-primary/20',
                    ].join(' ')}
                    style={isPopular ? {
                      animation: 'pricing-glow-pulse 4s ease-in-out infinite',
                    } : undefined}
                  >
                    {/* Gradient strip at top */}
                    <div
                      className={`h-1 w-full bg-gradient-to-r ${tariff.accent.strip}`}
                    />

                    <div className="p-5 sm:p-6">
                      {/* Tier icon + name */}
                      <div className="flex items-center gap-2.5 mb-4">
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-base ${tariff.accent.badge}`}
                        >
                          {tariff.accent.icon}
                        </span>
                        <h3 className="font-display text-lg font-bold text-foreground tracking-tight">
                          {t(tariff.nameKey as any)}
                        </h3>
                      </div>

                      {/* Price */}
                      <div className="mb-4">
                        <span className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                          {tariff.price}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                        {t(tariff.descriptionKey as any)}
                      </p>

                      {/* Feature list */}
                      <ul className="space-y-2.5 mb-6">
                        {tariff.featureKeys.map((fk, fi) => (
                          <li
                            key={fi}
                            className="flex items-start gap-2 text-sm"
                          >
                            <svg
                              className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M3 8.5l3.5 3.5L13 4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-foreground/80">
                              {t(fk as any)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <Button
                        onClick={() => handleBuy(tariff.type)}
                        className={[
                          'w-full transition-all duration-200',
                          isPopular
                            ? 'shadow-sm hover:shadow-md'
                            : '',
                        ].join(' ')}
                        variant={isPopular ? 'default' : 'outline'}
                        size="lg"
                      >
                        {isAuthenticated
                          ? t('pricing.button.buy' as any)
                          : t('pricing.button.login' as any)}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Decorative divider ── */}
          <div
            className="flex items-center justify-center gap-3 mb-12 sm:mb-14"
            style={{ animation: 'pricing-fade 0.5s ease-out both', animationDelay: '500ms' }}
          >
            <span className="block w-16 h-px bg-border" />
            <span className="text-primary/40 text-xs">✦ ✦ ✦</span>
            <span className="block w-16 h-px bg-border" />
          </div>

          {/* ── How it works ── */}
          <div
            className="mb-12 sm:mb-14"
            style={{ animation: 'pricing-rise 0.55s ease-out both', animationDelay: '550ms' }}
          >
            <h2 className="text-xl sm:text-2xl font-display font-bold text-center mb-8 text-foreground">
              {t('pricing.howItWorks.title')}
            </h2>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
              {/* Connecting line (desktop only) */}
              <div className="hidden lg:block absolute top-6 left-[12%] right-[12%] h-px bg-border" />

              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="relative flex flex-col items-center text-center"
                  style={{
                    animation: 'pricing-rise 0.45s ease-out both',
                    animationDelay: `${600 + i * 80}ms`,
                  }}
                >
                  {/* Step number circle */}
                  <div className="relative z-10 w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/15 border border-primary/20 flex items-center justify-center mb-3">
                    <span className="text-sm font-bold text-primary">
                      {step.num}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[180px]">
                    {t(step.key as any)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delivery info ── */}
          <div
            className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 sm:p-8 mb-10"
            style={{ animation: 'pricing-rise 0.55s ease-out both', animationDelay: '700ms' }}
          >
            <h2 className="text-lg sm:text-xl font-display font-bold mb-3 text-foreground">
              {t('pricing.delivery.title')}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('pricing.delivery.instant')}
            </p>
            <ul className="space-y-2.5">
              {(['pricing.delivery.point1', 'pricing.delivery.point2', 'pricing.delivery.point3'] as const).map(
                (key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm">
                    <svg
                      className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M3 8.5l3.5 3.5L13 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-muted-foreground">{t(key as any)}</span>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* ── Return button ── */}
          <div
            className="text-center pb-6"
            style={{ animation: 'pricing-fade 0.5s ease-out both', animationDelay: '800ms' }}
          >
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              size="lg"
              className="min-w-[200px] text-muted-foreground hover:text-foreground"
            >
              {t('pricing.button.return')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Pricing;
