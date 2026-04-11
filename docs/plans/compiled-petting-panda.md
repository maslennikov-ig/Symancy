# Pricing Page Redesign: Mystical Luxury

## Context

Редизайн страницы /pricing из простых карточек в визуально запоминающуюся страницу в стиле "Mystical Coffee Oracle". Поддержка ОБЕИХ тем (light + dark). Staggered fade-in анимация.

## Эстетика

**Тон**: Мистика + роскошь + кофейная культура
**Обе темы**: Dark theme — тёмный фон с зернистой текстурой, золотые акценты. Light theme — кремовый фон, тёплые кофейные тона, мягкие тени.
**Типографика**: Playfair Display (font-display) для заголовков тарифов + цен
**Акценты**: Amber/gold (#F59E0B) — основной акцент, кофейные коричневые градиенты
**Анимация**: CSS staggered fade-in-up при загрузке, hover эффекты на карточках

## Дизайн-решения

### Карточки тарифов

Каждый тариф имеет свою визуальную идентичность:

| Тариф | Градиент заголовка | Акцент |
|-------|-------------------|--------|
| Novice (basic) | green-900→green-800 / green-50→green-100 | Зелёный |
| Amateur (pack5) | amber-900→amber-700 / amber-50→amber-100 | Золотой + glow |
| Inner Sage (pro) | purple-900→purple-800 / purple-50→purple-100 | Фиолетовый |
| Cassandra | stone-900→stone-800 / stone-50→stone-100 | Amber/bronze |

**Popular тариф (pack5)**:
- Бейдж "Popular" / "Выгодно" сверху
- Golden border glow (box-shadow с amber) — в dark. Amber border + shadow — в light
- Slight scale-up (scale-[1.03]) на desktop

### Layout

- Mobile: 1 column stack
- Tablet: 2x2 grid
- Desktop: 4 columns, pack5 визуально приподнят
- Decorative divider между секциями (тонкая линия + ✦)

### Фоновый эффект

- Dark: radial-gradient от stone-900 к stone-950 + CSS noise overlay (pseudo-element с grain)
- Light: radial-gradient от stone-50 к stone-100, тёплый и чистый

### "How It Works" секция

- Горизонтальные шаги с connecting line между ними
- Круглые номера вместо emoji (1, 2, 3, 4) с primary/amber заливкой
- Тонкая линия-коннектор между шагами

### Анимация

CSS-only (без framer-motion):
```css
@keyframes pricing-fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```
Каждая карточка: `animation: pricing-fade-in 0.5s ease-out forwards`, `animation-delay: calc(index * 100ms)`
Секции ниже: delay 400ms+

## Файлы для изменения

| Файл | Что |
|------|-----|
| `src/pages/Pricing.tsx` | Полный редизайн компонента |
| `src/index.css` | Добавить keyframes для pricing анимаций (если нужно) |

**НЕ менять**: i18n ключи, типы, интеграцию с оплатой, пропсы компонента

## Constraints

- Поддержка light + dark тем через CSS variables / Tailwind dark: prefix
- Все текстовые строки через t() — без хардкода
- Telegram safe area insets (paddingTop/Bottom CSS vars)
- Mobile-first responsive (1→2→4 колонки)
- Существующие пропсы и onBuyTariff callback без изменений
- Только Tailwind CSS классы + inline styles для анимации

## Верификация

1. `pnpm type-check` — без ошибок
2. `pnpm build` — успешная сборка
3. Playwright screenshot в light и dark теме
4. Проверка responsive (mobile/desktop)
