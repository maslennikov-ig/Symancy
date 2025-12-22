# Symancy

AI-сервис для анализа кофейной гущи. Загрузите фото — получите персональную расшифровку.

## Технологии

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **База данных**: Supabase PostgreSQL
- **AI**: Google Gemini API
- **Платежи**: YooKassa
- **Хостинг**: Netlify

## Быстрый старт

```bash
# Установка зависимостей
pnpm install

# Запуск dev-сервера
pnpm dev

# Сборка
pnpm build
```

## Переменные окружения

Создайте `.env.local`:

```env
VITE_SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key
```

## Структура проекта

```
symancy/
├── components/           # React компоненты
│   ├── payment/         # Платёжные компоненты
│   └── ui/              # UI компоненты (shadcn)
├── pages/               # Страницы (Pricing, Terms, Contacts)
├── services/            # Сервисы (Gemini, payments, credits)
├── contexts/            # React contexts (Auth)
├── lib/                 # Утилиты (Supabase client, i18n)
├── types/               # TypeScript типы
├── supabase/
│   ├── functions/       # Edge Functions
│   └── migrations/      # SQL миграции
└── App.tsx              # Главный компонент
```

## Тарифы

| Тариф | Цена | Кредиты |
|-------|------|---------|
| Новичок | 100₽ | 1 базовый |
| Любитель | 300₽ | 5 базовых |
| Внутренний мудрец | 500₽ | 1 PRO |
| Кассандра | 1000₽ | 1 эзотерический |

## Supabase Edge Functions

### create-payment
Создаёт платёж в YooKassa, возвращает confirmation_token для виджета.

### payment-webhook
Обрабатывает webhook от YooKassa, начисляет кредиты пользователю.

## Настройка платежей

1. Получите credentials в [YooKassa](https://yookassa.ru/)
2. Установите секреты:
   ```bash
   supabase secrets set YUKASSA_SHOP_ID=xxx
   supabase secrets set YUKASSA_SECRET_KEY=xxx
   supabase secrets set YUKASSA_WEBHOOK_SECRET=xxx
   ```
3. Настройте webhook URL в YooKassa:
   ```
   https://johspxgvkbrysxhilmbg.supabase.co/functions/v1/payment-webhook
   ```

## Лицензия

Proprietary. All rights reserved.
