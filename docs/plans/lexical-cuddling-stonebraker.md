# Plan: Fix /pricing Buy Buttons (Auth Gate)

## Context

Buy buttons were added to `/pricing` but they don't work — clicking does nothing. The tester reports buttons are visible but not interactive.

**Root cause:** `handleSelectTariff` → `createPayment()` → throws `"Not authenticated"` because the web user has no Supabase session. The error is caught silently and shown as a toast at the bottom, which the user doesn't see.

The fix is to pass `isAuthenticated` to Pricing and show proper UX:
- **Authenticated:** "Купить" button works normally
- **Not authenticated:** button navigates to auth (login) page

## Plan

### Step 1: Pass `isAuthenticated` to Pricing

**File:** `src/App.tsx` (~line 586)

`user` is already available via `useAuth()` (line 152). Pass `!!user` to Pricing:

```tsx
<Pricing
  language={language}
  t={t}
  onBuyTariff={(productType) => handleSelectTariff(productType as ProductType)}
  isAuthenticated={!!user}
/>
```

### Step 2: Handle auth gate in Pricing

**File:** `src/pages/Pricing.tsx`

Add `isAuthenticated` prop. When button is clicked and user is NOT authenticated, navigate to login page (or root `/` which has auth). When authenticated, call `onBuyTariff` as before.

```typescript
interface PricingProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
  onBuyTariff?: (productType: string) => void;
  isAuthenticated?: boolean;
}
```

Button logic:
```tsx
<Button
  onClick={() => {
    if (isAuthenticated && onBuyTariff) {
      onBuyTariff(tariff.type);
    } else {
      navigate('/');  // redirect to auth
    }
  }}
  className="w-full mt-4"
  variant={tariff.highlighted ? 'default' : 'outline'}
>
  {isAuthenticated ? t('pricing.button.buy') : t('pricing.button.login')}
</Button>
```

### Step 3: Add i18n key for login button text

**File:** `src/lib/i18n.ts`

Add `pricing.button.login` for all 3 languages:
- en: `"Sign in to buy"`
- ru: `"Войти для покупки"`
- zh: `"登录购买"`

### Step 4: Make all buttons always visible (remove `onBuyTariff &&` guard)

Currently buttons only render when `onBuyTariff` is provided. Change to always render — unauthenticated users see "Войти для покупки", authenticated see "Купить".

## Critical Files

| File | Change |
|------|--------|
| `src/pages/Pricing.tsx` | Add `isAuthenticated` prop, auth gate logic, always show buttons |
| `src/App.tsx:586` | Pass `isAuthenticated={!!user}` |
| `src/lib/i18n.ts` | Add `pricing.button.login` (3 languages) |

## Verification

1. `pnpm type-check && pnpm build`
2. Open `symancy.ru/pricing` not logged in → buttons say "Войти для покупки" → click redirects to auth
3. Open `symancy.ru/pricing` logged in → buttons say "Купить" → click opens YooKassa widget
4. Same flow works in Telegram Mini App
5. Push → CI/CD deploys
