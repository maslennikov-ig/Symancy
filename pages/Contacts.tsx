import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { translations, Lang, t as i18n_t } from '../lib/i18n';

interface ContactsProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

/**
 * Contacts page - displays contact information and legal entity details
 *
 * URL: /contacts
 */
const Contacts: React.FC<ContactsProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  
  // Fallback
  const language = propLanguage || 'en';
  const t = propT || ((key: any) => i18n_t(key, language));

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-8">
        {/* Page Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            {t('contacts.title')}
          </h1>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {t('contacts.email')}
            </h2>
            <a
              href="mailto:support@symancy.ru"
              className="text-foreground hover:text-primary transition-colors underline"
            >
              support@symancy.ru
            </a>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {t('contacts.phone')}
            </h2>
            <a
              href="tel:+79957675765"
              className="text-foreground hover:text-primary transition-colors underline"
            >
              +7 (995) 767-57-65
            </a>
          </div>
        </div>

        {/* Legal Entity Details */}
        <div className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            {t('contacts.details')}
          </h2>

          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              {t('contacts.details.name')}
            </p>

            <div className="font-mono text-muted-foreground space-y-1">
              <p>{t('contacts.details.inn')}</p>
              <p>{t('contacts.details.ogrn')}</p>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div className="pt-6">
          <Button
            onClick={handleReturnHome}
            size="lg"
            className="w-full"
          >
            {t('contacts.button.return')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Contacts;
