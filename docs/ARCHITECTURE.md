# Symancy Architecture

> Актуальная архитектура проекта Coffee Psychologist (Symancy)

**Last Updated:** 2025-12-27

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Web)                             │
│                    React 19 + Vite + TypeScript                  │
│                         symancy.ru                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Auth       │  │  Database   │  │  Edge Functions         │  │
│  │  (OAuth)    │  │  (Postgres) │  │  (analyze-coffee, etc)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  OpenRouter │  │  YooKassa   │  │  Telegram Bot (future)  │  │
│  │  (LLM API)  │  │  (Payments) │  │  (symancy-backend)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── App.tsx                 # Main app component + routing
├── main.tsx                # Entry point
├── index.css               # Global styles + Tailwind
│
├── components/
│   ├── ui/                 # Base UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── scroll-area.tsx
│   │   └── toggle-group.tsx
│   │
│   ├── layout/             # Layout components
│   │   ├── Header.tsx      # App header with menu
│   │   └── ThemeToggle.tsx # Light/dark toggle
│   │
│   ├── features/           # Feature-specific components
│   │   ├── auth/           # Authentication
│   │   │   ├── AuthModal.tsx
│   │   │   ├── ProfileIcon.tsx
│   │   │   └── [Social icons]
│   │   │
│   │   ├── payment/        # Payment system
│   │   │   ├── PaymentWidget.tsx   # YooKassa widget
│   │   │   ├── TariffSelector.tsx  # Tariff picker modal
│   │   │   ├── TariffCard.tsx
│   │   │   ├── CreditBadge.tsx
│   │   │   ├── CreditBalance.tsx
│   │   │   └── PurchaseHistory.tsx
│   │   │
│   │   ├── history/        # Analysis history
│   │   │   ├── HistoryDisplay.tsx
│   │   │   └── HistoryItemSkeleton.tsx
│   │   │
│   │   ├── analysis/       # Coffee analysis
│   │   │   ├── ImageUploader.tsx
│   │   │   └── ResultDisplay.tsx
│   │   │
│   │   ├── ChatOnboarding.tsx      # Chat-based onboarding flow
│   │   └── MysticalCoffeeCupIllustration.tsx  # Background animation
│   │
│   └── icons/              # SVG icon components
│       ├── CoffeeIcon.tsx
│       ├── LoaderIcon.tsx
│       ├── OfficialLogo.tsx
│       └── [Other icons]
│
├── config/                 # Configuration
│   ├── chat.ts             # Chat settings (avatars, delays)
│   └── admin-configurable.ts  # Settings for future admin panel
│
├── contexts/               # React contexts
│   └── AuthContext.tsx     # Authentication state
│
├── hooks/                  # Custom hooks (empty, reserved)
│
├── lib/                    # Utilities
│   ├── i18n.ts             # Translations (ru, en, zh)
│   ├── supabaseClient.ts   # Supabase client singleton
│   └── utils.ts            # Utility functions (cn)
│
├── pages/                  # Route pages
│   ├── Pricing.tsx         # /pricing
│   ├── Terms.tsx           # /offer, /terms
│   ├── Contacts.tsx        # /contacts
│   ├── PaymentSuccess.tsx  # /payment/success
│   ├── PaymentResult.tsx   # /payment/result
│   └── TestPayment.tsx     # /test-payment (dev only)
│
├── services/               # API services
│   ├── analysisService.ts  # Coffee analysis API
│   ├── paymentService.ts   # Payment creation
│   ├── creditService.ts    # Credit balance
│   ├── historyService.ts   # Analysis history
│   ├── analyticsService.ts # Analytics tracking
│   └── imageGenerator.ts   # Share image generation
│
└── types/                  # TypeScript types
    ├── payment.ts          # Payment-related types
    └── react-yoomoneycheckoutwidget.d.ts
```

---

## Component Hierarchy

```
App.tsx
├── MysticalBackground          # Animated background
├── Header                      # Top navigation
│   ├── OfficialLogo
│   ├── CreditBadge            # (if logged in)
│   ├── UserAvatar / ProfileIcon
│   └── Menu (dropdown)
│       ├── HistoryIcon + History link
│       ├── CoffeeIcon + Buy credits
│       ├── Language selector
│       ├── ThemeToggle
│       └── LogoutIcon + Logout
│
├── Main Content (Card)
│   ├── ChatOnboarding         # Initial state
│   │   ├── MessageList
│   │   ├── ImageUploader      # When ready for upload
│   │   └── MessageInput
│   │
│   ├── LoaderIcon             # Loading state
│   ├── Error display          # Error state
│   └── ResultDisplay          # Analysis result
│       └── ReactMarkdown
│
├── HistoryDisplay             # (when view=history)
│   └── HistoryItemSkeleton
│
├── TariffSelector (modal)     # Buy credits modal
│   └── TariffCard
│
├── PaymentWidget (modal)      # YooKassa checkout
│
├── AuthModal (modal)          # Sign in modal
│   └── Social login buttons
│
└── Footer
    └── Navigation links
```

---

## Data Flow

### Authentication Flow
```
User clicks "Sign In"
    → AuthModal opens
    → User selects OAuth provider (Google, Telegram, etc.)
    → Supabase Auth handles OAuth
    → AuthContext updates with user data
    → CreditBadge fetches credit balance
```

### Analysis Flow
```
ChatOnboarding collects:
    1. User name (WAIT_NAME)
    2. User intent (WAIT_INTENT)
    3. Image upload (UPLOAD_READY)

Image uploaded
    → imageCompression reduces size
    → fileToBase64 converts
    → analyzeCoffeeCup calls Edge Function
    → Edge Function:
        - Checks credits
        - Calls OpenRouter (vision model)
        - Deducts credit
        - Returns analysis
    → ResultDisplay shows markdown
    → saveAnalysis stores in history
```

### Payment Flow
```
User clicks "Buy Credits"
    → TariffSelector modal opens
    → User selects tariff
    → createPayment calls Edge Function
    → Edge Function creates YooKassa payment
    → PaymentWidget shows checkout form
    → User completes payment
    → YooKassa webhook → Edge Function
    → Credits added to user_credits table
    → User redirected to /payment/success
```

---

## State Management

### Global State (Contexts)
- **AuthContext**: User authentication state, signIn/signOut

### Local State (useState in App.tsx)
- `imageFile`, `imageUrl` - Current image
- `analysis` - Analysis result
- `isLoading`, `error` - Loading states
- `language` - Current locale (ru/en/zh)
- `theme` - Current theme (light/dark)
- `currentView` - uploader/history
- `userData` - Collected from chat (name, intent)
- Payment states: `showTariffSelector`, `paymentData`, etc.

### Persistence
- `localStorage.theme` - Theme preference
- `localStorage.language` - Language preference
- Supabase `analysis_history` - Analysis history
- Supabase `user_credits` - Credit balance

---

## Code Splitting

### Lazy-loaded Components
```typescript
// Heavy components - load on demand
const HistoryDisplay = lazy(() => import('./components/features/history/HistoryDisplay'));
const TariffSelector = lazy(() => import('./components/features/payment/TariffSelector'));
const PaymentWidget = lazy(() => import('./components/features/payment/PaymentWidget'));

// Pages - route-based splitting
const Pricing = lazy(() => import('./pages/Pricing'));
const Terms = lazy(() => import('./pages/Terms'));
const Contacts = lazy(() => import('./pages/Contacts'));
const TestPayment = lazy(() => import('./pages/TestPayment'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentResult = lazy(() => import('./pages/PaymentResult'));
```

### Bundle Structure (after build)
```
dist/
├── index.html                    1.78 KB
├── assets/
│   ├── index.css                63.09 KB  # Styles
│   ├── vendor_react.js          45.70 KB  # React + React-DOM
│   ├── index.js                805.21 KB  # Main bundle
│   ├── HistoryDisplay.js         2.82 KB  # Lazy chunk
│   ├── TariffSelector.js         4.64 KB  # Lazy chunk
│   ├── PaymentWidget.js          2.91 KB  # Lazy chunk
│   ├── Pricing.js                4.45 KB  # Lazy chunk
│   └── [other lazy chunks]
```

---

## Styling Architecture

### Tailwind CSS 4 + CSS Variables
```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 30 50% 98%;      /* Light theme */
    --foreground: 20 14.3% 4.1%;
    --primary: 38 92% 50%;         /* Amber accent */
    /* ... */
  }
  .dark {
    --background: 20 14.3% 4.1%;   /* Dark theme */
    --foreground: 0 0% 98%;
    /* ... */
  }
}
```

### Component Styling Pattern
```tsx
// Use Tailwind classes + shadcn/ui components
<Button variant="ghost" size="icon" className="text-primary">
  <CoffeeIcon className="w-4 h-4" />
</Button>
```

---

## Internationalization

### Supported Languages
- `ru` - Russian (default, auto-detected)
- `en` - English
- `zh` - Chinese

### Implementation
```typescript
// src/lib/i18n.ts
export const translations = {
  en: { 'key': 'English' },
  ru: { 'key': 'Русский' },
  zh: { 'key': '中文' },
};

// Usage in components
const t = useCallback((key) => i18n_t(key, language), [language]);
<button>{t('menu.buyAnalysis')}</button>
```

See `docs/I18N_GUIDE.md` for full translation guide.

---

## Backend (Telegram Bot)

### Directory: `symancy-backend/`

```
symancy-backend/
├── src/
│   ├── bot/              # grammY bot setup
│   ├── handlers/         # Message handlers
│   ├── services/         # Business logic
│   └── utils/            # Utilities
├── tests/                # Test suites
└── package.json
```

**Status**: In development (spec-003)

---

## Database Schema (Supabase)

### Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (from auth.users) |
| `purchases` | Payment transactions |
| `user_credits` | Credit balances |
| `analysis_history` | Saved analyses |

### Future Tables (spec-003)
| Table | Purpose |
|-------|---------|
| `system_config` | Admin-editable settings |
| `chat_messages` | Bot conversation history |
| `user_states` | Bot state machine |
| `scheduled_messages` | Proactive engagement |

---

## Security

### Authentication
- Supabase Auth with OAuth providers
- JWT tokens for API calls

### Row Level Security (RLS)
- All tables have RLS policies
- Users can only access their own data
- Admin functions check `is_admin()` SQL function

### API Security
- Edge Functions validate JWT
- Credit checks before analysis
- Rate limiting on Supabase

---

## Future Architecture (Admin Panel)

```
/admin/*                    # Protected admin routes
├── ConfigResource          # Edit system_config
├── UsersResource           # View profiles
├── MessagesResource        # Debug conversations
├── StatesResource          # Reset stuck users
└── CostsDashboard          # LLM cost analytics
```

See `docs/ADMIN_PANEL_SPEC.md` for implementation details.

---

## Quick Reference

| Aspect | Technology |
|--------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | React Context + useState |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Payments | YooKassa |
| LLM | OpenRouter API |
| i18n | Custom (3 languages) |
| Themes | CSS Variables (2 themes) |
