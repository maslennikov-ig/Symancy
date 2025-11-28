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
              href="mailto:1094242@list.ru"
              className="text-foreground hover:text-primary transition-colors underline"
            >
              1094242@list.ru
            </a>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Телефон
            </h2>
            <a
              href="tel:+79623677443"
              className="text-foreground hover:text-primary transition-colors underline"
            >
              +7 (962) 367-74-43
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

            <div className="text-muted-foreground">
              <p className="font-medium mb-1">Юридический адрес:</p>
              <p>105484, РФ, г. Москва,</p>
              <p>ул. 15-я Парковая, д. 39, кв. 28</p>
            </div>

            <div className="border-t border-border pt-3 mt-4">
              <p className="font-medium text-foreground mb-2">
                Банковские реквизиты:
              </p>
              <div className="font-mono text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-md">
                <p>Расчётный счёт: 40802810438000037254</p>
                <p>Банк: ПАО «СБЕРБАНК РОССИИ»</p>
                <p>БИК: 044525225</p>
              </div>
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
