# Fix: Pricing page — broken buttons, dark theme, OKLCH conflict

## Context

Клиент сообщает 2 проблемы на странице `/pricing` в Telegram Mini App:
1. **Кнопки "Купить" не работают** — нажатие ничего не делает
2. **Тёмная тема**: при первом переходе из другой страницы контраст сломан (карточки тёмные с невидимыми элементами), после рефреша работает

**Корневые причины найдены:**

### Причина 1: PaymentWidget внутри mainAppContent (CRITICAL)
`PaymentWidget` и `TariffSelector` рендерятся ВНУТРИ `mainAppContent` (App.tsx:488-548). Этот блок показывается ТОЛЬКО web-пользователям на маршруте `/`. Telegram-пользователи на `/pricing` не видят модалку оплаты после нажатия "Купить".

### Причина 2: OKLCH переменные перезаписывают HSL (HIGH)
В `index.css` два набора CSS-переменных:
- Строки 11-54 (`@layer base`): наши HSL-цвета (stone/amber) 
- Строки 326-393 (без layer): OKLCH-цвета от shadcn

OKLCH идут последними → перезаписывают HSL. Tailwind конфиг оборачивает в `hsl(var(--border))` → `hsl(oklch(0.922 0 0))` = **невалидный CSS**. Результат: `bg-card`, `border-input`, `bg-background` не работают → карточки прозрачные, границы невидимые.

### Причина 3: Кнопки variant="outline" невидимы в dark mode (MEDIUM)  
Непопулярные тарифы используют `variant="outline"` → border-input border → в тёмной теме border=dark на dark фоне → невидимая граница.

## План исправлений

### Задача 1: Вынести PaymentWidget из mainAppContent (CRITICAL)
**Файл**: `src/App.tsx`

Переместить PaymentWidget overlay (строки 503-534) и payment error toast (536-547) из `mainAppContent` в общий рендер — рядом с AuthModal (строки 658-663), чтобы они отображались для ВСЕХ пользователей независимо от маршрута.

```tsx
{/* Перед </TelegramRedirectGuard> */}

{/* Auth modal */}
{showPricingAuth && (...)}

{/* Payment widget — должен быть доступен на всех маршрутах */}
{paymentData && (
  <div className="fixed inset-0 ...">
    <PaymentWidget ... />
  </div>
)}

{/* Payment error toast */}
{paymentError && (...)}
```

Также вынести TariffSelector (488-501) если он используется с `/pricing`.

### Задача 2: Удалить OKLCH-переменные, конфликтующие с HSL (HIGH)
**Файл**: `src/index.css`

Удалить OKLCH-определения (строки 326-393), которые дублируют наши HSL-переменные. Они были автоматически добавлены shadcn при установке компонентов и перезаписывают наш дизайн.

**НО**: нужно сохранить переменные `--chart-*` и `--sidebar-*`, которых НЕТ в HSL-блоке. Перенести их в HSL-блок (в формате HSL, не OKLCH).

### Задача 3: Сменить outline кнопки на default (MEDIUM)
**Файл**: `src/pages/Pricing.tsx`

Строка 297: заменить `variant={isPopular ? 'default' : 'outline'}` → `variant="default"` для всех кнопок CTA. Покупательские кнопки должны быть яркими и заметными.

## Критические файлы
- `src/App.tsx` — PaymentWidget/TariffSelector вынести из mainAppContent
- `src/index.css` — OKLCH vs HSL конфликт
- `src/pages/Pricing.tsx` — variant кнопок

## Верификация
1. `pnpm type-check` + `pnpm build`
2. Playwright: открыть `/pricing`, нажать "Купить" → должна появиться модалка PaymentWidget
3. Playwright: проверить тёмную тему — карточки видимы, текст читаемый, кнопки яркие
4. Убедиться, что web-версия (не Telegram) по-прежнему работает корректно
