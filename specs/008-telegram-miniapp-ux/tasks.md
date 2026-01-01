# Telegram Mini App UX Implementation Tasks

> **Spec**: `/home/me/code/coffee/specs/008-telegram-miniapp-ux/spec.md`
> **Started**: 2025-12-31
> **Last Updated**: 2026-01-01

---

## CONTEXT FOR NEXT SESSION (English)

```
TASK: Telegram Mini App UX implementation COMPLETE (Phase 1-3)

COMPLETED (All Phases):
- Phase 1: Bottom Navigation, Home Dashboard, Profile, History, App Layout, CloudStorage, i18n ✓
- Phase 2: Onboarding Flow (4 steps), Photo Analysis Flow, PersonaSelector ✓
- Phase 3: Daily Insights Service (14 insights × 3 languages), Statistics Service (real Supabase data) ✓

REMAINING (Phase 4 - Growth, optional):
1. Share functionality (shareToStory)
2. Push notifications (Telegram bot)
3. Analytics dashboard
4. A/B testing framework

FILES CREATED IN THIS SESSION:
- src/pages/Onboarding/* (5 files)
- src/pages/Analysis/* (4 files)
- src/components/features/onboarding/StepIndicator.tsx
- src/components/features/analysis/PersonaSelector.tsx
- src/services/dailyInsightService.ts
- src/services/statsService.ts

TECH STACK: React 19, TypeScript, Vite, shadcn/ui, Supabase, Telegram Mini Apps SDK
PATTERN: Orchestrator - gather context, delegate to subagents, verify with type-check/build
```

---

## Phase 1: MVP Enhancement ✅ COMPLETED

### Task 1.1: Bottom Navigation Component ✅
- **Status**: [X] Completed
- **Files**: `src/components/layout/BottomNav.tsx`

### Task 1.2: Home Dashboard Page ✅
- **Status**: [X] Completed
- **Files**: `src/pages/Home.tsx`, `src/components/features/home/*.tsx`

### Task 1.3: Profile Screen ✅
- **Status**: [X] Completed
- **Files**: `src/pages/Profile.tsx`, `src/pages/Profile/Credits.tsx`

### Task 1.4: App Layout & Routing ✅
- **Status**: [X] Completed
- **Files**: `src/components/layout/AppLayout.tsx`, `src/App.tsx`, `src/pages/History.tsx`

### Task 1.5: CloudStorage Integration ✅
- **Status**: [X] Completed
- **Files**: `src/hooks/useCloudStorage.ts`

### Task 1.6: i18n Keys ✅
- **Status**: [X] Completed
- **Files**: `src/lib/i18n.ts` (517 keys × 3 languages)

---

## Phase 1 Code Review Fixes ✅ COMPLETED

- [X] C-1: Memory leak in useCloudStorage
- [X] C-2: MainButton/BackButton lifecycle hooks (`useMainButton.ts`, `useBackButton.ts`)
- [X] H-1: Safe area insets fix
- [X] H-2: ErrorBoundary component
- [X] H-3: Race condition in updatePreferences
- [X] H-4: Haptic feedback fallback (Web Vibration API)
- [X] M-1: useTranslation typed hook
- [X] M-3: Shared icons library (`src/components/icons/index.tsx`)
- [X] M-4: ARIA accessibility labels
- [X] M-5: Image lazy loading
- [X] M-6: Keyboard navigation in dropdowns
- [X] L-1: DailyInsight language fallback fix
- [X] L-3: Layout constants (`src/constants/layout.ts`)
- [X] L-5: JSDoc for public hooks

---

## Phase 2: Core Features ✅ COMPLETED

### Task 2.1: Onboarding Flow ✅ DONE
- **Status**: [X] Completed
- **Priority**: P1
- **Spec Section**: 4.7

**Requirements** (from spec):
- 4-step wizard: Welcome → Language → HowItWorks → FreeCredit
- Dot indicators at bottom (● ○ ○ ○)
- MainButton for navigation ("Начать", "Продолжить", etc.)
- Store `onboardingCompleted` in CloudStorage
- Grant 1 free credit on completion
- Skip if already completed (check CloudStorage on app load)

**Files to create**:
- `src/pages/Onboarding/index.tsx` (main flow controller)
- `src/pages/Onboarding/Welcome.tsx`
- `src/pages/Onboarding/Language.tsx`
- `src/pages/Onboarding/HowItWorks.tsx`
- `src/pages/Onboarding/FreeCredit.tsx`
- `src/components/features/onboarding/StepIndicator.tsx`

**i18n keys needed**:
- `onboarding.welcome.title`, `onboarding.welcome.subtitle`
- `onboarding.language.title`
- `onboarding.howItWorks.title`, `onboarding.howItWorks.step1`, etc.
- `onboarding.freeCredit.title`, `onboarding.freeCredit.message`
- `onboarding.button.start`, `onboarding.button.continue`, `onboarding.button.finish`

---

### Task 2.2: Photo Analysis Flow ✅ DONE
- **Status**: [X] Completed
- **Priority**: P0
- **Spec Section**: 4.3

**Requirements** (from spec):
- Dedicated flow (NOT using Chat.tsx for this):
  1. Capture: Camera/gallery buttons, tips
  2. Preview: Photo display, "Retake" button
  3. Persona Selection: Arina (☕ ⭐1) vs Cassandra (🔮 💎1)
  4. Processing: Animation with progress bar, persona-specific messages
  5. Result: Navigate to Chat with result
- Check credit balance before starting
- Haptic feedback throughout

**Files to create**:
- `src/pages/Analysis/index.tsx` (flow controller)
- `src/pages/Analysis/Capture.tsx`
- `src/pages/Analysis/Preview.tsx`
- `src/pages/Analysis/Processing.tsx`
- `src/components/features/analysis/PersonaSelector.tsx`

**i18n keys needed**:
- `analysis.capture.title`, `analysis.capture.camera`, `analysis.capture.gallery`, `analysis.capture.tip`
- `analysis.preview.title`, `analysis.preview.retake`
- `analysis.persona.title`, `analysis.persona.arina`, `analysis.persona.cassandra`
- `analysis.processing.title`, `analysis.processing.analyzing`
- `analysis.error.noCredits`

---

### Task 2.3: Persona Selector Component ✅ DONE
- **Status**: [X] Completed
- **Priority**: P1

**Requirements**:
- Two cards: Arina (Basic, ⭐) and Cassandra (Pro, 💎)
- Show credit cost for each
- Show user's current balance
- Visual selection state
- Haptic feedback on selection

**Files to create**:
- `src/components/features/analysis/PersonaSelector.tsx`

---

## Phase 3: Polish ✅ COMPLETED

### Task 3.1: Daily Insights Service ✅ DONE
- **Status**: [X] Completed
- **Priority**: P1

**Implementation**:
- Created `src/services/dailyInsightService.ts`
- Pool of 14 insights × 3 languages (ru, en, zh)
- Day-based rotation using day of year
- Cache validation with `isCacheValid()`
- Updated `DailyInsightCard.tsx` to use service

---

### Task 3.2: Statistics Service ✅ DONE
- **Status**: [X] Completed
- **Priority**: P2

**Implementation**:
- Created `src/services/statsService.ts`
- Fetches real data from Supabase:
  - `analysis_history` → analyses count
  - `conversations` → messages count
  - `purchases` → credits used
- Updated `Profile.tsx` to use real stats with loading state

---

### Task 3.3: Settings & Animations ✅ DONE
- Theme selector (light/dark/auto)
- Language selector (ru/en/zh)
- Keyboard navigation
- Haptic feedback with fallbacks

---

## Phase 4: Growth ❌ NOT STARTED

- [ ] Share functionality
- [ ] Push notifications (Telegram bot)
- [ ] Analytics dashboard
- [ ] A/B testing framework

---

## Verification Status

| Check | Status |
|-------|--------|
| TypeScript compiles | ✅ PASSED |
| Build succeeds | ✅ PASSED (6.65s) |
| i18n: 3 languages | ✅ 517 keys each |
| Themes: light/dark | ✅ CSS variables |
| ARIA accessibility | ✅ Labels added |
| Keyboard navigation | ✅ Enter/Space/Escape |

---

## Files Created in This Implementation

### Hooks
- `src/hooks/useCloudStorage.ts`
- `src/hooks/useMainButton.ts`
- `src/hooks/useBackButton.ts`
- `src/hooks/useTranslation.ts`

### Layout
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/AppLayout.tsx`

### Pages
- `src/pages/Home.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Profile/Credits.tsx`
- `src/pages/History.tsx`

### Home Components
- `src/components/features/home/BalanceCard.tsx`
- `src/components/features/home/DailyInsightCard.tsx`
- `src/components/features/home/QuickActions.tsx`
- `src/components/features/home/RecentActivity.tsx`

### Shared
- `src/components/icons/index.tsx`
- `src/components/ErrorBoundary.tsx` (updated)
- `src/constants/layout.ts`

---

## Priority Order for Next Session

1. **Task 2.1: Onboarding Flow** - First-time user experience
2. **Task 2.2: Photo Analysis Flow** - Core feature with persona selection
3. **Task 3.2: Statistics** - Nice to have

