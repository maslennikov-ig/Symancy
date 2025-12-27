# i18n Translation Guide

> Reference for creating and maintaining translations in the Symancy frontend.

## Quick Reference

| Item | Location |
|------|----------|
| Translations | `src/lib/i18n.ts` |
| **Locales** | `ru`, `en`, `zh` (Russian, English, Chinese) |
| Default | `ru` (detected from browser) |

## Architecture

### Single-File Structure

All translations are stored in a single TypeScript file with type safety:

```
src/lib/i18n.ts
├── translations.en   # English strings
├── translations.ru   # Russian strings
├── translations.zh   # Chinese strings
├── Lang type         # Union of locale keys
├── t() function      # Translation getter
└── detectInitialLanguage()
```

### Key Files

**`src/lib/i18n.ts`** - All translations and utilities:
```typescript
export const translations = {
  en: { 'key': 'English text' },
  ru: { 'key': 'Русский текст' },
  zh: { 'key': '中文文本' },
};

export type Lang = keyof typeof translations; // 'en' | 'ru' | 'zh'

export const t = (key: keyof typeof translations.en, lang: Lang): string => {
  return translations[lang][key] || translations.en[key] || key;
};
```

## Usage in Components

### With `t` prop (preferred)

Most components receive a pre-bound `t` function:

```tsx
// Component receives t from parent
interface MyComponentProps {
  t: (key: string) => string;
}

function MyComponent({ t }: MyComponentProps) {
  return <button>{t('button.save')}</button>;
}
```

### Direct import

For standalone components:

```tsx
import { t as i18n_t, Lang } from '@/lib/i18n';

function MyComponent({ language }: { language: Lang }) {
  const t = (key: string) => i18n_t(key as any, language);
  return <span>{t('menu.settings')}</span>;
}
```

### In App.tsx

```tsx
import { translations, Lang, detectInitialLanguage, t as i18n_t } from './lib/i18n';

const [language, setLanguage] = useState<Lang>(detectInitialLanguage);

const t = useCallback((key: keyof typeof translations.en) => {
  return i18n_t(key, language);
}, [language]);
```

## Adding Translations

### 1. Add keys to ALL 3 locales

**CRITICAL:** Always add to `en`, `ru`, AND `zh` simultaneously!

```typescript
// src/lib/i18n.ts
export const translations = {
  en: {
    // ... existing keys
    'new.feature.title': 'New Feature',
    'new.feature.description': 'This is a new feature',
  },
  ru: {
    // ... existing keys
    'new.feature.title': 'Новая функция',
    'new.feature.description': 'Это новая функция',
  },
  zh: {
    // ... existing keys
    'new.feature.title': '新功能',
    'new.feature.description': '这是一个新功能',
  },
};
```

### 2. Keep structure identical

All three locales MUST have the same keys:

```typescript
// ✅ CORRECT - same keys in all locales
en: { 'button.save': 'Save', 'button.cancel': 'Cancel' }
ru: { 'button.save': 'Сохранить', 'button.cancel': 'Отмена' }
zh: { 'button.save': '保存', 'button.cancel': '取消' }

// ❌ WRONG - missing key in zh
en: { 'button.save': 'Save', 'button.cancel': 'Cancel' }
ru: { 'button.save': 'Сохранить', 'button.cancel': 'Отмена' }
zh: { 'button.save': '保存' }  // Missing 'button.cancel'!
```

## Variable Interpolation

Use `{variable}` placeholders:

```typescript
// In translations
'greeting': 'Hello, {name}!'
'items.count': 'You have {count} items'

// Usage
t('greeting').replace('{name}', userName)
t('items.count').replace('{count}', String(itemCount))
```

### In i18n.ts:
```typescript
'footer.copyright': '© {year} Coffee Psychologist. All rights reserved.'

// Usage:
t('footer.copyright').replace('{year}', new Date().getFullYear().toString())
```

## Key Naming Conventions

### Structure
```
{feature}.{element}.{variant}
```

### Examples
```typescript
// Headers
'header.title': 'Coffee Psychologist'
'header.subtitle': 'Your personal guide...'

// Buttons
'button.analyze': 'Analyze'
'button.reset': 'Reset'

// Errors
'error.analyzeFailed': 'Failed to analyze...'
'error.tryAgain': 'Try Again'

// Menu items
'menu.language': 'Language'
'menu.theme': 'Theme'
'menu.signIn': 'Sign In'

// Feature-specific
'chat.placeholder': 'Type your answer...'
'chat.arina.greeting': 'Hello! I am Arina...'
'pricing.tariff.basic.name': 'Novice'
```

## Language Detection

Language is detected in this priority:

1. `localStorage.getItem('language')` - User's saved preference
2. `navigator.language` - Browser language
3. `'en'` - Fallback default

```typescript
export const detectInitialLanguage = (): Lang => {
  if (typeof window === 'undefined') return 'en';

  const savedLang = localStorage.getItem('language');
  if (savedLang && translations.hasOwnProperty(savedLang)) {
    return savedLang as Lang;
  }

  const browserLang = navigator.language.split('-')[0];
  if (translations.hasOwnProperty(browserLang)) {
    return browserLang as Lang;
  }

  return 'en';
};
```

## Best Practices

### 1. No hardcoded text
```tsx
// ❌ WRONG
<button>Купить анализ</button>

// ✅ CORRECT
<button>{t('menu.buyAnalysis')}</button>
```

### 2. Semantic key names
```typescript
// ❌ WRONG
'error1': 'Something went wrong'
'btn_1': 'Submit'

// ✅ CORRECT
'error.generic': 'Something went wrong'
'button.submit': 'Submit'
```

### 3. Group by feature
```typescript
// Pricing section
'pricing.title': '...',
'pricing.subtitle': '...',
'pricing.tariff.basic.name': '...',
'pricing.tariff.basic.description': '...',

// Auth section
'auth.login': '...',
'auth.logout': '...',
'auth.modalTitle': '...',
```

### 4. Test all 3 languages
After adding new keys, manually verify:
- English (en)
- Russian (ru)
- Chinese (zh)

## Common Patterns

### Error messages
```typescript
'error.analyzeFailed': 'Failed to analyze the image. Please try again.'
'error.tryAgain': 'Try Again'
'error.selectImage': 'Please select an image first.'
```

### Form elements
```typescript
'auth.emailPlaceholder': 'your@email.com'
'auth.magicLink.send': 'Send Magic Link'
'auth.magicLink.sent': 'Link sent! Check your email.'
```

### Confirmation/Action buttons
```typescript
'button.analyze': 'Analyze'
'button.reset': 'Reset'
'result.button.share': 'Share'
'result.button.analyzeAnother': 'Analyze another cup'
```

## Checklist Before PR

### All 3 Languages
- [ ] Key exists in `translations.en`
- [ ] Key exists in `translations.ru`
- [ ] Key exists in `translations.zh`

### Code Quality
- [ ] No hardcoded user-visible text
- [ ] Semantic key names used
- [ ] Interpolation uses `{variable}` format
- [ ] Keys grouped by feature

### Testing
- [ ] Verified in English
- [ ] Verified in Russian
- [ ] Verified in Chinese
- [ ] Language switch works correctly

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Key shows as raw key | Check key exists in all 3 locales |
| TypeScript error on key | Key must exist in `translations.en` (source of truth for types) |
| Language not switching | Check `localStorage.setItem('language', lang)` is called |
| Wrong language on load | Clear localStorage and check `detectInitialLanguage()` |

---

## Future: Admin Panel Integration

> **TODO:** When Admin Panel is implemented, translations should be:
> - Editable via `system_config` table
> - Cached with TTL for performance
> - Support dynamic keys for prompts/messages

See `docs/ADMIN_PANEL_SPEC.md` for Admin Panel specification.
