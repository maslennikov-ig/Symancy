import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

/**
 * Contacts page - displays contact information and legal entity details
 *
 * URL: /contacts
 */
const Contacts: React.FC = () => {
  const navigate = useNavigate();

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-8">
        {/* Page Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Контакты
          </h1>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Email
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
              Телефон
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
            Реквизиты
          </h2>

          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              ИП Вознесенская Анна Юрьевна
            </p>

            <div className="font-mono text-muted-foreground space-y-1">
              <p>ИНН: 771976259033</p>
              <p>ОГРНИП: 316774600413540</p>
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
            Вернуться на главную
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Contacts;
