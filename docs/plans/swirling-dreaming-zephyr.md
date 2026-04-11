# Fix: Pricing page auth redirect & display issues in Telegram Mini App

## Context

Клиент сообщил, что при нажатии "Войти для покупки" на странице тарифов в Telegram Mini App его перекидывает на главное меню вместо авторизации. Также символ рубля (₽) отображается как пустой прямоугольник (□), а бейдж "Popular" не переведён.

**Приоритет**: CRITICAL — клиенты не могут совершить покупку.

## Найденные проблемы

### 1. CRITICAL: Telegram-пользователи выглядят как неавторизованные
- **Файл**: `src/App.tsx:152` — `const { user } = useAuth()` деструктурирует только Supabase `user`
- **Файл**: `src/App.tsx:586` — передаёт `isAuthenticated={!!user}` (только Supabase)
- **Контекст**: `AuthContext.tsx:215` правильно считает `isAuthenticated = !!(user || unifiedUser)`, но Pricing этим не пользуется
- **Результат**: Telegram-пользователь видит "Войти для покупки" даже когда авторизован

### 2. CRITICAL: Кнопка "Войти для покупки" уводит на главную
- **Файл**: `src/pages/Pricing.tsx:148-154` — `handleBuy()` делает `navigate('/')` вместо показа AuthModal
- **Результат**: Пользователь теряется на главной странице, не понимая что произошло

### 3. HIGH: Символ рубля (₽) не отображается
- **Файл**: `src/pages/Pricing.tsx:33,52,73,93` — цены захардкожены как `'100 ₽'`
- **Причина**: Шрифт Inter (Google Fonts, загружается как `Inter:wght@400;500;600`) не содержит глиф ₽ (U+20BD). В других компонентах используется `&#8381;` — HTML entity, которая корректно фолбечится на системные шрифты
- **Font stack**: `Inter, sans-serif` (tailwind.config.js:18) — нет промежуточного фолбека с ₽

### 4. MEDIUM: Бейдж "Popular" не переведён
- **Файл**: `src/pages/Pricing.tsx:211` — захардкожено `Popular`
- Ключ перевода есть: `subscription.selector.popular` (ru: "Популярный", zh: "热门")

## План исправлений

### Задача 1: Fix isAuthenticated для Telegram-пользователей (App.tsx)
**Файл**: `src/App.tsx`
1. Строка 152: изменить `const { user } = useAuth()` → `const { user, isAuthenticated: authIsAuthenticated } = useAuth()`
2. Строка 586: изменить `isAuthenticated={!!user}` → `isAuthenticated={authIsAuthenticated}`

### Задача 2: Показывать AuthModal вместо redirect на `/` (Pricing.tsx + App.tsx)
**Файлы**: `src/pages/Pricing.tsx`, `src/App.tsx`

1. Добавить prop `onLogin?: () => void` в `PricingProps`
2. В `handleBuy()` заменить `navigate('/')` → `onLogin?.()`
3. В `App.tsx`:
   - Добавить state `const [showPricingAuth, setShowPricingAuth] = useState(false)`
   - Передать `onLogin={() => setShowPricingAuth(true)}` в Pricing
   - Рендерить `AuthModal` когда `showPricingAuth === true`

### Задача 3: Исправить отображение символа рубля (Pricing.tsx)
**Файл**: `src/pages/Pricing.tsx`

Вместо хардкода `'100 ₽'` в строках — рендерить цену в JSX:
```tsx
<span>{tariff.priceNum.toLocaleString('ru-RU')}</span>
<span>&nbsp;&#8381;</span>
```
Это позволит браузеру фолбечиться на системный шрифт для символа рубля.

Альтернативы (рассмотренные, отклонённые):
- `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })` — выдаёт "100 ₽" строкой, не решает проблему шрифта
- Менять шрифт — рискованно, может сломать другие элементы

### Задача 4: Перевести бейдж "Popular" (Pricing.tsx)
**Файл**: `src/pages/Pricing.tsx:211`
- Заменить `Popular` → `{t('subscription.selector.popular' as any)}`

## Критические файлы
- `src/App.tsx` — роутинг, передача пропсов в Pricing
- `src/pages/Pricing.tsx` — страница тарифов (основной файл для исправлений)
- `src/contexts/AuthContext.tsx` — контекст авторизации (НЕ трогаем, работает корректно)
- `src/components/features/auth/AuthModal.tsx` — модалка авторизации (НЕ трогаем, работает корректно)

## Верификация
1. `pnpm type-check` — TypeScript должен пройти без ошибок
2. `pnpm build` — билд должен быть успешным
3. Проверить в Playwright/браузере:
   - Открыть `/pricing` как неавторизованный → кнопки показывают "Войти для покупки"
   - Нажать → появляется AuthModal, а не редирект на `/`
   - Символ ₽ отображается корректно рядом с ценами
   - Бейдж показывает "Популярный" (ru), "Popular" (en), "热门" (zh)
