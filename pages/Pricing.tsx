import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card';

interface Tariff {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const TARIFFS: Tariff[] = [
  {
    name: 'Новичок',
    price: '100 руб.',
    description: '1 базовая расшифровка (3-4 блока анализа)',
    features: ['1 анализ', 'Базовые блоки', 'История анализов'],
  },
  {
    name: 'Любитель',
    price: '300 руб.',
    description: '5 базовых расшифровок (скидка 40%)',
    features: ['5 анализов', 'Экономия 40%', 'Базовые блоки', 'История анализов'],
    highlighted: true,
  },
  {
    name: 'Внутренний мудрец',
    price: '500 руб.',
    description: '1 PRO расшифровка (6+ блоков, глубокий анализ)',
    features: ['1 PRO анализ', '6+ блоков', 'Глубокий анализ', 'История анализов'],
  },
  {
    name: 'Кассандра',
    price: '1 000 руб.',
    description: '1 эзотерическое предсказание (уникальный формат)',
    features: ['Эзотерика', 'Уникальный формат', 'Предсказание', 'История анализов'],
  },
];

/**
 * Pricing page - displays available tariffs and pricing information
 *
 * URL: /pricing
 */
const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl">
        {/* Page header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Тарифы Symancy
          </h1>
          <p className="text-lg text-muted-foreground">
            Выберите подходящий тариф для анализа кофейной гущи с помощью AI
          </p>
        </div>

        {/* Tariff cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {TARIFFS.map((tariff) => (
            <Card
              key={tariff.name}
              className={
                tariff.highlighted
                  ? 'border-2 border-primary shadow-lg'
                  : ''
              }
            >
              <CardHeader>
                <CardTitle className="text-xl">{tariff.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-foreground mt-2">
                  {tariff.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {tariff.description}
                </p>
                <ul className="space-y-2">
                  {tariff.features.map((feature, index) => (
                    <li
                      key={index}
                      className="text-sm flex items-start gap-2"
                    >
                      <span className="text-primary">✓</span>
                      <span>{feature}</span>
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
            Как это работает
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">1️⃣</div>
              <p className="text-sm text-muted-foreground">
                Выберите тариф и оплатите
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">2️⃣</div>
              <p className="text-sm text-muted-foreground">
                На ваш аккаунт начисляются кредиты
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">3️⃣</div>
              <p className="text-sm text-muted-foreground">
                Загрузите фото кофейной гущи
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">4️⃣</div>
              <p className="text-sm text-muted-foreground">
                Получите персональную расшифровку от AI
              </p>
            </div>
          </div>
        </div>

        {/* Delivery information */}
        <div className="bg-card rounded-lg border p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            Способ получения услуги
          </h2>
          <p className="text-muted-foreground mb-4">
            Услуга предоставляется <strong>мгновенно</strong> после оплаты:
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Кредиты зачисляются автоматически</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>
                Результат анализа доступен сразу после обработки (1-2 минуты)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>История всех расшифровок сохраняется в личном кабинете</span>
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
            Вернуться на главную
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
