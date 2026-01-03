import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

interface Tariff {
  nameKey: string;
  price: string;
  descriptionKey: string;
  featureKeys: string[];
  highlighted?: boolean;
}

interface PricingProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

const TARIFFS: Tariff[] = [
  {
    nameKey: 'pricing.tariff.basic.name',
    price: '100 ₽',
    descriptionKey: 'pricing.tariff.basic.description',
    featureKeys: [
      'pricing.tariff.basic.feature.1',
      'pricing.tariff.basic.feature.2',
      'pricing.tariff.basic.feature.3'
    ],
  },
  {
    nameKey: 'pricing.tariff.pack5.name',
    price: '300 ₽',
    descriptionKey: 'pricing.tariff.pack5.description',
    featureKeys: [
      'pricing.tariff.pack5.feature.1',
      'pricing.tariff.pack5.feature.2',
      'pricing.tariff.pack5.feature.3',
      'pricing.tariff.pack5.feature.4'
    ],
    highlighted: true,
  },
  {
    nameKey: 'pricing.tariff.pro.name',
    price: '500 ₽',
    descriptionKey: 'pricing.tariff.pro.description',
    featureKeys: [
      'pricing.tariff.pro.feature.1',
      'pricing.tariff.pro.feature.2',
      'pricing.tariff.pro.feature.3',
      'pricing.tariff.pro.feature.4'
    ],
  },
  {
    nameKey: 'pricing.tariff.cassandra.name',
    price: '1 000 ₽',
    descriptionKey: 'pricing.tariff.cassandra.description',
    featureKeys: [
      'pricing.tariff.cassandra.feature.1',
      'pricing.tariff.cassandra.feature.2',
      'pricing.tariff.cassandra.feature.3',
      'pricing.tariff.cassandra.feature.4'
    ],
  },
];

/**
 * Pricing page - displays available tariffs and pricing information
 *
 * URL: /pricing
 */
const Pricing: React.FC<PricingProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  
  // Fallback
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl">
        {/* Page header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Tariff cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {TARIFFS.map((tariff) => (
            <Card
              key={tariff.nameKey}
              className={
                tariff.highlighted
                  ? 'border-2 border-primary shadow-lg'
                  : ''
              }
            >
              <CardHeader>
                <CardTitle className="text-xl">{t(tariff.nameKey as any)}</CardTitle>
                <CardDescription className="text-2xl font-bold text-foreground mt-2">
                  {tariff.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t(tariff.descriptionKey as any)}
                </p>
                <ul className="space-y-2">
                  {tariff.featureKeys.map((featureKey, index) => (
                    <li
                      key={index}
                      className="text-sm flex items-start gap-2 text-foreground"
                    >
                      <span className="text-primary">✓</span>
                      <span>{t(featureKey as any)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works section */}
        <div className="bg-card rounded-lg border p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6 text-foreground">
             {t('pricing.howItWorks.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">1️⃣</div>
              <p className="text-sm text-muted-foreground">
                 {t('pricing.howItWorks.step1.text')}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">2️⃣</div>
              <p className="text-sm text-muted-foreground">
                 {t('pricing.howItWorks.step2.text')}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">3️⃣</div>
              <p className="text-sm text-muted-foreground">
                 {t('pricing.howItWorks.step3.text')}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">4️⃣</div>
              <p className="text-sm text-muted-foreground">
                 {t('pricing.howItWorks.step4.text')}
              </p>
            </div>
          </div>
        </div>

        {/* Delivery information */}
        <div className="bg-card rounded-lg border p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-foreground">
             {t('pricing.delivery.title')}
          </h2>
          <p className="text-muted-foreground mb-4">
             {t('pricing.delivery.instant')}
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>{t('pricing.delivery.point1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>
                 {t('pricing.delivery.point2')}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>{t('pricing.delivery.point3')}</span>
            </li>
          </ul>
        </div>

        {/* Return button */}
        <div className="text-center">
          <Button
            onClick={handleReturnHome}
            size="lg"
            className="min-w-[200px]"
          >
             {t('pricing.button.return')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
