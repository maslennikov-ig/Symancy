# Symancy Architecture

> Актуальная архитектура проекта Coffee Psychologist (Symancy)

**Last Updated:** 2026-01-06

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
│   └── chat.ts             # Chat settings (avatars, delays)
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

**Status**: Production (v0.5.47+)

---

## Daily Insights System

### Overview

The Daily Insights system sends personalized morning advice and evening reflections to users via Telegram. It uses AI-generated content based on user context (memories, chat history, previous analyses).

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      INSIGHT GENERATION                         │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐ │
│  │  pg-boss      │   │  Dispatcher   │   │  Daily Insight    │ │
│  │  Scheduler    │──▶│  (hourly)     │──▶│  Chain            │ │
│  │  (cron)       │   │               │   │  (LangChain)      │ │
│  └───────────────┘   └───────────────┘   └───────────────────┘ │
│         │                   │                     │             │
│         ▼                   ▼                     ▼             │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐ │
│  │ insight-      │   │ morning/      │   │ generateMorning   │ │
│  │ dispatcher    │   │ evening-      │   │ Advice()          │ │
│  │ queue         │   │ insight-single│   │ generateEvening   │ │
│  │               │   │ queues        │   │ Insight()         │ │
│  └───────────────┘   └───────────────┘   └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER CONTEXT LOADING                        │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐ │
│  │ Recent        │   │ User          │   │ Last              │ │
│  │ Messages (10) │   │ Memories (5)  │   │ Analysis          │ │
│  └───────────────┘   └───────────────┘   └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DELIVERY & STORAGE                           │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐ │
│  │ daily_        │   │ Proactive     │   │ Telegram          │ │
│  │ insights      │──▶│ Message       │──▶│ Bot API           │ │
│  │ (DB)          │   │ Service       │   │                   │ │
│  └───────────────┘   └───────────────┘   └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `daily-insight.chain.ts` | `src/chains/` | LangChain-based insight generation |
| `worker.ts` | `src/modules/engagement/` | pg-boss job handlers |
| `dispatcher.ts` | `src/modules/engagement/` | Timezone-aware job dispatching |
| `insight-constants.ts` | `src/config/` | Configurable thresholds and limits |
| `static-insights.ts` | `src/modules/engagement/triggers/` | Fallback messages |

### Configuration (insight-constants.ts)

```typescript
SHORT_TEXT_LENGTH = 100        // Preview text length
BATCH_RATE_LIMIT_DELAY_MS = 200 // Rate limiting between users
MAX_RECENT_MESSAGES = 10       // Context messages to load
MAX_MEMORIES = 5               // Memories to include in prompt
INSIGHT_MAX_TOKENS = 500       // LLM response limit
EVENING_HOUR_THRESHOLD = 20    // Hour (0-23) for evening insight
MORNING_INSIGHT_HOUR = 8       // Default morning delivery
EVENING_INSIGHT_HOUR = 20      // Default evening delivery
```

### Fallback Strategy

```
AI Generation → generateWithRetry (3 attempts, exponential backoff)
       │
       ├─ Success → Send personalized insight
       │
       └─ Failure → getStaticMorningInsight() / getStaticEveningInsight()
                    (Pre-written generic messages by language)
```

---

## Memory System

### Overview

The memory system stores and retrieves user memories using vector search (pgvector). Memories are extracted from conversations and used for context enrichment.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY EXTRACTION                          │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐ │
│  │ User Message  │──▶│ Memory        │──▶│ Embedding         │ │
│  │               │   │ Extraction    │   │ (BGE-M3)          │ │
│  │               │   │ Chain         │   │                   │ │
│  └───────────────┘   └───────────────┘   └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY STORAGE                             │
│                                                                 │
│  user_memories table (Supabase + pgvector)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ id | telegram_user_id | content | category | embedding  │   │
│  │    |                  |         |          | (vector)   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY RETRIEVAL                           │
│                                                                 │
│  searchMemories(userId, query, limit)                          │
│       │                                                         │
│       ├─ Generate query embedding                               │
│       ├─ RPC: search_user_memories (cosine distance)           │
│       └─ Return top-k matches with similarity scores           │
└─────────────────────────────────────────────────────────────────┘
```

### Memory Categories

| Category | Priority | Examples |
|----------|----------|----------|
| `personal_info` | 1 (highest) | Name, age, location |
| `health` | 2 | Medical conditions, allergies |
| `work` | 3 | Job, career details |
| `preferences` | 4 | Communication style, likes |
| `interests` | 5 | Hobbies, activities |
| `events` | 6 | Scheduled events, plans |
| `other` | 7 (lowest) | Miscellaneous |

### Memory Consolidation

The `consolidateMemories(telegramUserId)` function merges similar memories:

1. Fetch all memories with embeddings
2. Compare pairwise using cosine similarity
3. If similarity > 0.85:
   - Keep newer memory
   - Append older content with `[Previous info]:` prefix
   - Use more specific category (lower priority number)
   - Delete older memory

### Key Files

| File | Purpose |
|------|---------|
| `src/services/memory.service.ts` | Memory CRUD + search + consolidation |
| `src/core/embeddings/index.ts` | BGE-M3 embedding generation |
| `src/chains/memory-extraction.chain.ts` | LLM-based memory extraction |

---

## Metrics Collection

### Overview

System metrics are collected for monitoring insight generation, memory operations, and API performance.

### Schema (system_metrics table)

```sql
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,      -- 'insight', 'memory', 'api', 'embedding', 'queue'
  metric_name TEXT NOT NULL,      -- 'generation_latency_ms', 'tokens_used', etc.
  metric_value NUMERIC NOT NULL,
  tags JSONB,                     -- { user_id, job_type, language, timezone }
  recorded_at TIMESTAMPTZ DEFAULT now()
);
```

### Metric Types

| Type | Metrics Tracked |
|------|-----------------|
| `insight` | generation_latency_ms, total_processing_time_ms, tokens_used, success_count, error_count, fallback_used_count |
| `memory` | search_latency_ms, add_latency_ms, results_count |
| `api` | request_latency_ms, response_size_bytes |
| `embedding` | generation_latency_ms, dimensions |
| `queue` | job_processing_time_ms, jobs_dispatched, jobs_failed |

### Usage in Code

```typescript
import { recordMetric, startTimer, recordDuration } from './services/metrics.service.js';

// Timing measurement
const timer = startTimer();
await generateMorningAdvice(context);
await recordDuration('insight', 'generation_latency_ms', timer, {
  user_id: userId,
  job_type: 'morning',
  language: 'ru'
});

// Batch recording
await recordMetricBatch([
  { type: 'insight', name: 'tokens_used', value: 500, tags: { job_type: 'morning' } },
  { type: 'insight', name: 'success_count', value: 1, tags: { job_type: 'morning' } },
]);
```

### Memory Usage Tracking

The `memory_usage` table tracks how often memories are used in context:

```sql
CREATE TABLE memory_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES user_memories(id) ON DELETE CASCADE,
  used_in_context_type TEXT,  -- 'chat', 'morning_insight', 'evening_insight'
  context_id TEXT,            -- Optional reference to specific context
  used_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Database Schema (Supabase)

### Legacy Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (from auth.users) |
| `purchases` | Payment transactions |
| `user_credits` | Credit balances |
| `analysis_history` | Saved analyses |

### Omnichannel Tables
| Table | Purpose |
|-------|---------|
| `unified_users` | Unified user records (Telegram + Web) |
| `conversations` | Chat conversations |
| `messages` | Chat messages |
| `message_deliveries` | Delivery tracking |
| `link_tokens` | Account linking tokens |
| `unified_user_credits` | Omnichannel credit balances |

### Daily Insights Tables
| Table | Purpose |
|-------|---------|
| `daily_insights` | Daily morning/evening insights per user |
| `user_memories` | Vector-indexed user memories |
| `memory_usage` | Memory usage tracking |
| `system_metrics` | Application metrics |

### Future Tables
| Table | Purpose |
|-------|---------|
| `system_config` | Admin-editable settings |
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
