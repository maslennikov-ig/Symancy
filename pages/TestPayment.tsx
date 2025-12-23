// @ts-nocheck
// pages/TestPayment.tsx
// Тестовая страница для проверки платежей
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createPayment } from '../services/paymentService';
import { PaymentWidget } from '../components/payment/PaymentWidget';
import type { ProductType } from '../types/payment';

const TARIFFS: Array<{ id: ProductType; name: string; price: number; credits: number }> = [
  { id: 'basic', name: 'Новичок', price: 100, credits: 1 },
  { id: 'pack5', name: 'Любитель', price: 300, credits: 5 },
  { id: 'pro', name: 'Внутренний мудрец', price: 500, credits: 1 },
  { id: 'cassandra', name: 'Кассандра', price: 1000, credits: 1 },
];

export default function TestPayment() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    confirmationToken: string;
    purchaseId: string;
    tariff: string;
  } | null>(null);

  // Авторизация через magic link
  const handleLogin = async () => {
    if (!email) {
      setError('Введите email');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn(email);
      setSuccess('Ссылка для входа отправлена на ' + email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  // Создание платежа
  const handleSelectTariff = async (tariff: typeof TARIFFS[0]) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createPayment(tariff.id);
      setPaymentData({
        confirmationToken: result.confirmation_token,
        purchaseId: result.purchase_id,
        tariff: tariff.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
    } finally {
      setIsLoading(false);
    }
  };

  // Завершение платежа
  const handlePaymentComplete = () => {
    setPaymentData(null);
    setSuccess('Платёж успешно завершён! Проверьте базу данных.');
  };

  const handlePaymentError = (errorMsg: string) => {
    setPaymentData(null);
    setError('Ошибка платежа: ' + errorMsg);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Заголовок */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>
            🧪 Тестовая страница платежей
          </h1>
          <p style={{ color: '#888' }}>
            Symancy — Проверка интеграции YooKassa
          </p>
        </div>

        {/* Инструкция с тестовой картой */}
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px',
        }}>
          <h3 style={{ color: '#ffc107', margin: '0 0 15px 0' }}>
            💳 Тестовая карта
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#888' }}>Номер карты:</td>
                <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                  4111 1111 1111 1111
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#888' }}>Срок действия:</td>
                <td style={{ padding: '8px 0' }}>Любая дата в будущем (например, 12/25)</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#888' }}>CVV:</td>
                <td style={{ padding: '8px 0' }}>Любые 3 цифры (например, 123)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Сообщения */}
        {error && (
          <div style={{
            background: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid rgba(220, 53, 69, 0.5)',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
            color: '#ff6b6b',
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(40, 167, 69, 0.2)',
            border: '1px solid rgba(40, 167, 69, 0.5)',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
            color: '#51cf66',
          }}>
            ✅ {success}
          </div>
        )}

        {/* Авторизация */}
        {!user && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px',
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>1. Авторизация</h2>
            <p style={{ color: '#888', marginBottom: '20px' }}>
              Для тестирования платежей нужно авторизоваться
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="email"
                placeholder="Введите ваш email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #333',
                  background: '#1a1a2e',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
              <button
                onClick={handleLogin}
                disabled={isLoading}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4f46e5',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? 'Загрузка...' : 'Войти'}
              </button>
            </div>
          </div>
        )}

        {/* Статус авторизации */}
        {user && (
          <div style={{
            background: 'rgba(40, 167, 69, 0.1)',
            border: '1px solid rgba(40, 167, 69, 0.3)',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '30px',
          }}>
            ✅ Авторизован: <strong>{user.email}</strong>
          </div>
        )}

        {/* Выбор тарифа */}
        {user && !paymentData && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px',
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>2. Выберите тариф</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '15px',
            }}>
              {TARIFFS.map((tariff) => (
                <button
                  key={tariff.id}
                  onClick={() => handleSelectTariff(tariff)}
                  disabled={isLoading}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: '2px solid #333',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: '#fff',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#4f46e5';
                    e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>
                    {tariff.price} ₽
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {tariff.name}
                  </div>
                  <div style={{ color: '#888', fontSize: '0.9rem' }}>
                    {tariff.credits} {tariff.credits === 1 ? 'кредит' : 'кредитов'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Виджет оплаты */}
        {paymentData && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px',
          }}>
            <h2 style={{ margin: '0 0 10px 0' }}>3. Оплата: {paymentData.tariff}</h2>
            <p style={{ color: '#888', marginBottom: '20px' }}>
              Purchase ID: <code style={{ color: '#4f46e5' }}>{paymentData.purchaseId}</code>
            </p>
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '10px',
            }}>
              <PaymentWidget
                confirmationToken={paymentData.confirmationToken}
                purchaseId={paymentData.purchaseId}
                onComplete={handlePaymentComplete}
                onError={handlePaymentError}
              />
            </div>
            <button
              onClick={() => setPaymentData(null)}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #666',
                background: 'transparent',
                color: '#888',
                cursor: 'pointer',
              }}
            >
              ← Назад к тарифам
            </button>
          </div>
        )}

        {/* Что проверить */}
        <div style={{
          background: 'rgba(79, 70, 229, 0.1)',
          border: '1px solid rgba(79, 70, 229, 0.3)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <h3 style={{ color: '#818cf8', margin: '0 0 15px 0' }}>
            📋 Что проверить после оплаты
          </h3>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#aaa' }}>
            <li style={{ marginBottom: '8px' }}>
              Таблица <code>purchases</code> — появилась запись со статусом <code>succeeded</code>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Таблица <code>user_credits</code> — кредиты начислены
            </li>
            <li style={{ marginBottom: '8px' }}>
              Таблица <code>payment_analytics</code> — события <code>payment_started</code> и <code>payment_succeeded</code>
            </li>
          </ol>
        </div>

        {/* Ссылка на основной сайт */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <a
            href="/"
            style={{
              color: '#888',
              textDecoration: 'none',
            }}
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
}
