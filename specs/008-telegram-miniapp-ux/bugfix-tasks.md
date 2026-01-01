# Telegram Mini App UX - Code Review Bug Fixes

> **Date**: 2026-01-01
> **Source**: Code Review Report

## Fixes to Implement

### H-2: useShareStory - HTTPS validation + env variable
- **File**: `src/hooks/useShareStory.ts`
- **Fix**:
  1. Validate imageUrl starts with `https://` before calling shareToStory
  2. Move `BOT_USERNAME` to environment variable `VITE_BOT_USERNAME`

### M-1: useCloudStorage - Race condition
- **File**: `src/hooks/useCloudStorage.ts`
- **Fix**: Make updatePreferences properly return Promise that resolves after storage is saved

### M-2: useExperiment - Non-Telegram initialization
- **File**: `src/hooks/useExperiment.ts`
- **Fix**: Initialize immediately for non-Telegram users (skip 100ms timeout)

### M-3: statsService - Parallelize queries
- **File**: `src/services/statsService.ts`
- **Fix**: Use Promise.all for the 3 Supabase queries

### M-4: App.tsx - ErrorBoundary for lazy routes
- **File**: `src/App.tsx`
- **Fix**: Wrap Suspense with ErrorBoundary for lazy-loaded routes

### M-6: BalanceCard - PRO credits display
- **File**: `src/components/features/home/BalanceCard.tsx`
- **Fix**: Add PRO credits display between Basic and Cassandra

### M-8: BottomNav - Icon size consistency
- **File**: `src/components/layout/BottomNav.tsx`
- **Fix**: Change icon size to consistent 24px (remove 22px for inactive)

### L-2: Home components - React.memo
- **Files**:
  - `src/components/features/home/BalanceCard.tsx`
  - `src/components/features/home/DailyInsightCard.tsx`
  - `src/components/features/home/QuickActions.tsx`
  - `src/components/features/home/RecentActivity.tsx`
- **Fix**: Wrap exports with React.memo()

### L-4: ErrorBoundary - i18n
- **File**: `src/components/ErrorBoundary.tsx`
- **Fix**: Use translation keys instead of inline text (keys already exist)
- **Need to add keys**: `error.title`, `error.description`, `error.refresh`

### L-5: dailyInsightService - Language validation
- **File**: `src/services/dailyInsightService.ts`
- **Fix**: Add warning log if language is not 'ru'|'en'|'zh'

### L-8: Profile - appVersion
- **File**: `src/pages/Profile.tsx`
- **Fix**: Use `__APP_VERSION__` instead of `import.meta.env.VITE_APP_VERSION`

## Status
- [x] All fixes implemented
- [x] Type-check passes
- [x] Build passes (6.71s)

## Completed: 2026-01-01
