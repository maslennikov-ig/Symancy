# План: исправить тёмный текст на /pricing в Mini App, hover кнопок «Купить» и обрезание YooKassa-виджета

## Context

Пользователь открывает бота Тассеограф в Telegram Mini App и нажимает «пополнить баланс» → загружается `/pricing`:

1. **Тёмный текст на тёмном фоне.** Заголовок «Тарифы Symancy», подзаголовок, цена «100 ₽» — едва читаемы (серый на почти-чёрном). Если нажать «обновить» внутри мини-аппа — рендер становится корректным. При повторном заходе баг возвращается. Скрин: `/home/me/code/coffee/.tmp/view (12).png`.
2. **CTA-кнопки «Купить» не считываются как кликабельные.** Нет явного hover/active-состояния, пользователь не понимает, что это кнопка.
3. **YooKassa-виджет обрезан справа.** Тексты «Оплата для клиентов Сбе…», «Кошелёк или привязанна…» срезаны, под виджетом видна наша нижняя навигация. Скрин: `/home/me/code/mc2/.tmp/view (35).png`.

Уже было несколько попыток (`1f18a3a`, `96cbad8`) — они исправили OKLCH-конфликт и варианты кнопок, но корневой причины race condition для темы не устранили.

---

## Root Causes

### RC-1: тема ставится по `Telegram.WebApp.colorScheme` один раз, без подписки на `themeChanged`

`src/main.tsx:20-48` читает `tg.colorScheme` синхронно до монтирования React и ставит класс `dark`/`light`. `src/App.tsx:183-213` — тот же read в `useState` + `useEffect` фиксирует класс на первом рендере. **Нет подписки** на событие `themeChanged` (официальное Telegram-событие, см. Bot API docs: `themeChanged → this.colorScheme + this.themeParams`). `useTelegramWebApp` hook (`src/hooks/useTelegramWebApp.ts:336`) подписывается на `themeChanged`, но только чтобы перепривязать `--tg-*` CSS-переменные; React-state `theme` и классы `dark`/`light` при этом НЕ обновляются.

**Как это даёт баг:** Telegram отдаёт `colorScheme: 'light'` при первом инициальном опросе (до того, как синхронизируется тема пользователя), а позже присылает `themeChanged` с правильным `dark`. В этом промежутке:
- класс `light` стоит на `<html>` → CSS-токены = light-палитра (`--foreground: stone-950` = почти чёрный, `--muted-foreground: stone-600`).
- Но `--tg-bg-color` уже установлен в тёмный hex из `themeParams.bg_color` (Telegram in dark mode).
- `.tg-webapp .bg-background { background-color: var(--tg-bg-color, …) !important }` (`src/index.css:188-190`) → фон тёмный.
- `.tg-webapp .text-foreground { color: var(--tg-text-color, hsl(var(--foreground))) !important }` (`src/index.css:180-182`) → если `--tg-text-color` не записан или записан как `#000000`/тёмный — падаем в fallback `hsl(var(--foreground))` в light-режиме = stone-950 (чёрный).
- Итог: тёмный текст на тёмном фоне, точно как на скриншоте.

Нажатие «обновить» в мини-аппе переинициализирует WebApp, и к этому моменту `colorScheme` уже корректный → класс `dark` встаёт сразу → всё ок.

### RC-2: `variant="default"` Button даёт слабый rest-state и никакого touch-feedback

`src/components/ui/button.tsx:11-12`: `default: "bg-primary text-primary-foreground hover:bg-primary/90"`. `--primary: 38 92% 50%` (amber). На тёмном фоне кнопка без тени/бордера и без `:active`-отклика не выглядит «нажимаемой» на touch-устройстве (где `hover` не срабатывает до тапа). В `src/pages/Pricing.tsx:288-299` добавлен только `hover:shadow-md` для популярного тарифа.

### RC-3: модальный контейнер платёжки `max-w-lg` режет виджет YooKassa на мобильном

`src/App.tsx:619-648` — кастомный оверлей:
```
<div className="... p-4">
  <div className="... p-6 w-full max-w-lg">   <!-- 512px -->
    <PaymentWidget .../>
  </div>
</div>
```
Внутри `PaymentWidget` YooKassa-виджет получает только `customization.colors`, но **не `customization.modal`** (`src/components/features/payment/PaymentWidget.tsx:90-99`). Виджет рисуется inline, внутренние payment-методы имеют минимальный внутренний width — получаем horizontal overflow внутри 512-пиксельного контейнера + 48px padding. На iPhone с viewport 375-412px результат: методы обрезаны справа.

Официальная документация `react-yoomoneycheckoutwidget` поддерживает `customization.modal: true` — виджет сам отрисует полноэкранный mobile-friendly popup с корректным responsive-поведением.

---

## Recommended Fixes

### Fix 1 — подписка на `themeChanged` + синхронное обновление класса `dark`/`light`

В `src/App.tsx` добавить внутри существующего `useEffect([theme])` или новым отдельным эффектом:

```ts
useEffect(() => {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const handler = () => {
    const scheme = tg.colorScheme;
    if (scheme === 'light' || scheme === 'dark') setTheme(scheme);
  };
  try { tg.onEvent('themeChanged', handler); } catch {}
  // Если tg.colorScheme уже изменился между mount и effect-attach — синхронизируем сразу.
  handler();
  return () => { try { tg.offEvent('themeChanged', handler); } catch {} };
}, []);
```

### Fix 2 — убрать fallback-ловушку в `.tg-webapp .text-foreground` для случая «`--tg-text-color` не определён»

В `src/index.css:166-194` сейчас fallback — `hsl(var(--foreground))`. В dark-режиме (класс `dark`) `--foreground` уже правильный (почти белый). После Fix 1 класс `dark` будет гарантированно установлен к моменту `themeChanged`, так что fallback сам станет безопасным. Дополнительно подстраховаться: убедиться, что `.tg-webapp .text-foreground` не перекрывает корректное значение, — можно явно ссылаться на `hsl(var(--foreground))` без `var(--tg-text-color, …)` (наш дизайн в любом случае строится на нашей палитре, а не на Telegram's). Это отдельный опциональный шаг; минимальный фикс — Fix 1, но избавление от `!important`-переопределения делает регрессии невозможными.

Минимальный вариант: **оставить `.tg-webapp` правила только для `background-color` и `color` body-уровня**; убрать переопределения `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-background`, `text-primary` (строки `src/index.css:171-194`). Это позволит нашим HSL-токенам `--foreground`, `--card` и т. д. работать без `!important`-ловушки.

### Fix 3 — CTA-кнопки «Купить»: явная тень + active-scale + bold

В `src/pages/Pricing.tsx:288-299` расширить className:
```
'w-full transition-all duration-200',
'shadow-md hover:shadow-xl active:scale-[0.98]',
'font-semibold tracking-wide',
isPopular ? 'ring-1 ring-primary/30' : '',
```
Это даёт видимую тень в rest-state (читается как «объект, который можно тапнуть»), яркий press-feedback (`active:scale`), и попадает в touch-UX без завязки на `hover`.

### Fix 4 — YooKassa: включить `customization.modal: true`

В `src/components/features/payment/PaymentWidget.tsx:90-99`:
```ts
const widgetConfig = {
  confirmation_token: confirmationToken,
  return_url: computedReturnUrl,
  error_callback: handleError,
  customization: {
    modal: true,                    // <— полноэкранный mobile-friendly popup
    colors: { control_primary: '#8B4513' },
  },
};
```
С `modal: true` виджет рендерится как свой overlay. Одновременно упростить обёртку в `src/App.tsx:619-648`: убрать свой `max-w-lg`-контейнер (или оставить минимальный триггер/близкий крестик), чтобы не было конкурирующих overlay-ев. Добавить `onModalClose` pass-through в `PaymentWidget` (prop) → триггерит `handleClosePaymentWidget` из App.tsx.

Если по какой-то причине `customization.modal: true` несовместимо с текущим UX (например, нужен свой close-button поверх) — альтернатива: расширить контейнер до `w-[min(95vw,720px)] max-h-[90vh] overflow-y-auto`, чтобы на mobile виджет получал ~95vw и мог свободно ресайзиться. Это решает обрезание на всех ширинах ≥ 360px.

**Рекомендую `modal: true`** — это нативный supported путь и убирает сразу и ширину, и скролл, и overlay.

---

## Files to modify

| Файл | Что меняем | Строки |
|---|---|---|
| `src/App.tsx` | подписка на `themeChanged`, убрать `max-w-lg` обёртку вокруг PaymentWidget (или заменить на minimal trigger) | 183-213, 619-648 |
| `src/index.css` | удалить `!important`-переопределения `.tg-webapp .text-foreground`, `.text-muted-foreground`, `.bg-card`, `.bg-background`, `.text-primary` | 171-194 |
| `src/pages/Pricing.tsx` | добавить `shadow-md hover:shadow-xl active:scale-[0.98] font-semibold` на CTA-кнопках | 288-299 |
| `src/components/features/payment/PaymentWidget.tsx` | `customization.modal: true`, прокинуть `onModalClose` prop | 90-99 + типы |

Переиспользуется существующее: `useTelegramWebApp` hook уже подписан на `themeChanged` (добавим туда обновление React-state theme при желании — но минимум достаточно эффекта в App.tsx).

---

## Verification

1. **Сборка**: `pnpm type-check && pnpm build`.
2. **Визуально в браузере** (эмуляция Mini App): запустить `pnpm dev`, открыть `/pricing`, DevTools → media-query `prefers-color-scheme: dark` + эмулировать `window.Telegram = { WebApp: { colorScheme:'dark', themeParams:{bg_color:'#17212b', text_color:'#ffffff', …}, ready(){}, expand(){}, onEvent(){}, offEvent(){}, viewportHeight:812, viewportStableHeight:812 } }` до монтирования React, перезагрузить — проверить, что тёмный фон + **белый** текст (не тёмный).
3. **Эмулировать race**: повторить с `colorScheme:'light'` + темой `dark` в `themeParams`, затем после монтирования вызвать `tg.onEvent('themeChanged')` listeners → текст должен стать белым.
4. **Кнопки**: открыть `/pricing` на touch-устройстве (DevTools → toggle device toolbar, iPhone 14 Pro) → тапнуть «Купить» → видна `active:scale` анимация и shadow.
5. **YooKassa**: пройти до оплаты на мобильном viewport (375×812) → виджет должен занимать весь экран без horizontal overflow. Проверить, что `onModalClose` закрывает state (`paymentData → null`).
6. **Playwright MCP** (предпочтительно): автотест открытия `/pricing` в mobile viewport, скриншот до/после фикса + проверка contrast текста через `browser_evaluate`.
7. **Реальный Telegram**: задеплоить на staging, протестировать в bot `@coffeeveda_bot` на Android+iOS, включая переключение темы Telegram во время открытой страницы (проверка Fix 1).

---

## Out of scope

- Глобальная ревизия `.tg-webapp` стилей (только убираем ловушку для текстовых токенов).
- Переход на `@telegram-apps/sdk`-хуки для темы — уже частично интегрирован через `bindThemeParamsCssVars`, дальше не трогаем.
- Редизайн Pricing-страницы — только минимальный UX-fix для CTA.
