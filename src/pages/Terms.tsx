import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

interface TermsProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

/**
 * Terms of Service (Oferta) page
 *
 * URL: /offer (primary), /terms (legacy redirect)
 *
 * Displays the public offer agreement (Oferta) with terms and conditions
 * for using the Symancy service.
 *
 * Updated: 03 December 2025
 */
const Terms: React.FC<TermsProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  
  // Fallback if props are not passed (though App.tsx should pass them)
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
            {t('terms.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('terms.subtitle')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('terms.currentVersion')}{' '}
            <a href="https://symancy.ru/offer" className="text-primary hover:underline">
              https://symancy.ru/offer
            </a>
          </p>
        </div>

        {/* Section 1: General Provisions */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            {t('terms.section1.title')}
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>1.1.</strong> {t('terms.section1.text')}
            </p>
            {/* Note: Full legal text is kept concise for i18n example, but in production 
                you might want to load full HTML content per language or keep Russian as legal base. 
                Here we use the keys we added. */}
          </div>
        </section>

        {/* Section 2: Service Description */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            {t('terms.section2.title')}
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="font-semibold mb-2">
                {t('terms.section2.disclaimer.title')}
              </p>
              <p className="mb-2">
                {t('terms.section2.disclaimer.text')}
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Pricing and Payment */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            {t('terms.section3.title')}
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>3.1.</strong> {t('terms.section3.text')}
            </p>
          </div>
        </section>

        {/* Section 8: Company Details */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            {t('terms.section8.title')}
          </h2>
          <div className="bg-muted p-6 rounded-lg">
            <div className="space-y-2 text-foreground">
              <p><strong>{t('contacts.details.name')}</strong></p>
              <p>{t('contacts.details.ogrn')}</p>
              <p>{t('contacts.details.inn')}</p>
              <div className="mt-3">
                <p>
                  Email: {' '}
                  <a href="mailto:support@symancy.ru" className="text-primary hover:underline font-medium">
                    support@symancy.ru
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Return button */}
        <div className="flex justify-center pt-8 border-t border-border">
          <Button
            onClick={handleReturnHome}
            size="lg"
            className="min-w-[200px]"
          >
            {t('terms.button.return')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Terms;
