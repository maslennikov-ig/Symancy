import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

/**
 * Terms of Service (Oferta) page
 *
 * URL: /terms
 *
 * Displays the public offer agreement (Oferta) with terms and conditions
 * for using the Symancy service.
 */
const Terms: React.FC = () => {
  const navigate = useNavigate();

  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">
            Пользовательское соглашение (Оферта)
          </h1>
          <p className="text-sm text-muted-foreground">
            Дата публикации: 28 ноября 2024 г.
          </p>
        </div>

        {/* Introduction */}
        <div className="mb-8 text-foreground leading-relaxed">
          <p>
            Настоящий документ является публичной офертой (далее — «Оферта») и определяет условия использования сервиса Symancy (далее — «Сервис»).
          </p>
        </div>

        {/* Section 1: General Provisions */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            1. Общие положения
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>1.1.</strong> Сервис Symancy предоставляет услуги AI-анализа изображений кофейной гущи с использованием технологий искусственного интеллекта.
            </p>
            <p>
              <strong>1.2.</strong> Исполнитель: <strong>ИП Вознесенская Анна Юрьевна</strong>, ИНН <strong>771976259033</strong>, ОГРНИП <strong>316774600413540</strong>.
            </p>
            <p>
              <strong>1.3.</strong> Акцептом (принятием) настоящей Оферты является оплата любого тарифа Сервиса.
            </p>
          </div>
        </section>

        {/* Section 2: Service Description */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            2. Описание услуги
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>2.1.</strong> Сервис предоставляет развлекательную услугу — AI-генерацию интерпретаций на основе загруженных пользователем изображений.
            </p>
            <div>
              <p className="mb-2">
                <strong>2.2. Важно:</strong> Результаты анализа носят исключительно развлекательный характер и НЕ являются:
              </p>
              <ul className="list-disc ml-8 space-y-1 text-muted-foreground">
                <li>Психологической консультацией</li>
                <li>Медицинской диагностикой</li>
                <li>Гаданием или предсказанием будущего</li>
                <li>Профессиональной рекомендацией</li>
              </ul>
            </div>
            <p>
              <strong>2.3.</strong> Сервис использует технологии машинного обучения (Google Gemini API) для генерации текста на основе визуального анализа изображений.
            </p>
          </div>
        </section>

        {/* Section 3: Pricing and Payment */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            3. Тарифы и оплата
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <div>
              <p className="mb-2">
                <strong>3.1.</strong> Стоимость услуг:
              </p>
              <ul className="list-disc ml-8 space-y-1 text-muted-foreground">
                <li>Новичок: 100 руб. (1 базовый кредит)</li>
                <li>Любитель: 300 руб. (5 базовых кредитов)</li>
                <li>Внутренний мудрец: 500 руб. (1 PRO кредит)</li>
                <li>Кассандра: 1 000 руб. (1 кредит Кассандра)</li>
              </ul>
            </div>
            <p>
              <strong>3.2.</strong> Оплата осуществляется через платёжный сервис ЮKassa (ООО «ЮМани»).
            </p>
            <p>
              <strong>3.3.</strong> Кредиты зачисляются мгновенно после подтверждения оплаты.
            </p>
            <p>
              <strong>3.4.</strong> Кредиты не имеют срока действия и не сгорают.
            </p>
          </div>
        </section>

        {/* Section 4: Refunds */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            4. Возврат средств
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <div>
              <p className="mb-2">
                <strong>4.1.</strong> Возврат средств возможен в следующих случаях:
              </p>
              <ul className="list-disc ml-8 space-y-1 text-muted-foreground">
                <li>Техническая невозможность предоставления услуги по вине Сервиса</li>
                <li>Двойное списание средств</li>
              </ul>
            </div>
            <p>
              <strong>4.2.</strong> Для возврата обратитесь на email: <a href="mailto:1094242@list.ru" className="text-blue-600 hover:underline">1094242@list.ru</a>
            </p>
            <p>
              <strong>4.3.</strong> Срок рассмотрения заявки на возврат: до 10 рабочих дней.
            </p>
            <div>
              <p className="mb-2">
                <strong>4.4.</strong> Возврат не осуществляется, если:
              </p>
              <ul className="list-disc ml-8 space-y-1 text-muted-foreground">
                <li>Кредиты уже использованы</li>
                <li>Пользователь не удовлетворён результатом анализа (субъективная оценка)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Limitation of Liability */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            5. Ограничение ответственности
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>5.1.</strong> Исполнитель не несёт ответственности за решения, принятые Пользователем на основе результатов анализа.
            </p>
            <p>
              <strong>5.2.</strong> Максимальная ответственность Исполнителя ограничена суммой оплаченных Пользователем услуг.
            </p>
            <p>
              <strong>5.3.</strong> Сервис предоставляется «как есть» (as is).
            </p>
          </div>
        </section>

        {/* Section 6: Personal Data */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            6. Персональные данные
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <div>
              <p className="mb-2">
                <strong>6.1.</strong> При использовании Сервиса обрабатываются следующие данные:
              </p>
              <ul className="list-disc ml-8 space-y-1 text-muted-foreground">
                <li>Email (для авторизации)</li>
                <li>Загруженные изображения (для анализа)</li>
                <li>История расшифровок</li>
              </ul>
            </div>
            <p>
              <strong>6.2.</strong> Данные обрабатываются в соответствии с Федеральным законом №152-ФЗ «О персональных данных».
            </p>
            <p>
              <strong>6.3.</strong> Изображения не передаются третьим лицам и используются только для генерации анализа.
            </p>
            <p>
              <strong>6.4.</strong> Пользователь может запросить удаление своих данных, обратившись на <a href="mailto:1094242@list.ru" className="text-blue-600 hover:underline">1094242@list.ru</a>.
            </p>
          </div>
        </section>

        {/* Section 7: Intellectual Property */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            7. Интеллектуальная собственность
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>7.1.</strong> Все права на Сервис, его дизайн и программный код принадлежат Исполнителю.
            </p>
            <p>
              <strong>7.2.</strong> Сгенерированные тексты анализа могут использоваться Пользователем для личных целей.
            </p>
          </div>
        </section>

        {/* Section 8: Changes to Terms */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            8. Изменение условий
          </h2>
          <div className="space-y-3 text-foreground leading-relaxed">
            <p>
              <strong>8.1.</strong> Исполнитель вправе изменять условия настоящей Оферты.
            </p>
            <p>
              <strong>8.2.</strong> Изменения вступают в силу с момента публикации на сайте.
            </p>
            <p>
              <strong>8.3.</strong> Продолжение использования Сервиса после изменений означает согласие с новыми условиями.
            </p>
          </div>
        </section>

        {/* Section 9: Company Details */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">
            9. Реквизиты Исполнителя
          </h2>
          <div className="bg-muted p-6 rounded-lg">
            <div className="space-y-2 text-foreground">
              <p><strong>ИП Вознесенская Анна Юрьевна</strong></p>
              <p>ИНН: 771976259033</p>
              <p>ОГРНИП: 316774600413540</p>
              <p>Юридический адрес: 105484, РФ, г. Москва, ул. 15-я Парковая, д. 39, кв. 28</p>
              <p>Email: <a href="mailto:1094242@list.ru" className="text-blue-600 hover:underline">1094242@list.ru</a></p>
              <p>Телефон: <a href="tel:+79623677443" className="text-blue-600 hover:underline">+7 (962) 367-74-43</a></p>
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
            Вернуться на главную
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Terms;
