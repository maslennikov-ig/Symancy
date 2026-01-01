# Phase 1 Code Review Fix Tasks

> **Source**: `/home/me/code/coffee/.tmp/current/code-review-miniapp-phase1.md`
> **Started**: 2025-12-31
> **Completed**: 2025-12-31
> **Priority**: Critical > High > Medium

---

## Critical Fixes (MUST FIX)

### Fix C-1: Memory Leak in useCloudStorage
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **File**: `src/hooks/useCloudStorage.ts:296-360`
- **Problem**: Missing useEffect cleanup causes memory leaks
- **Fix**: Added `isMounted` flag and cleanup in useEffect return

**Artifacts**:
> [useCloudStorage.ts](src/hooks/useCloudStorage.ts)

---

### Fix C-2: MainButton/BackButton Lifecycle
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/hooks/useMainButton.ts`, `src/hooks/useBackButton.ts`
- **Problem**: No proper initialization/cleanup for MainButton/BackButton
- **Fix**: Created dedicated hooks with proper lifecycle management

**Artifacts**:
> [useMainButton.ts](src/hooks/useMainButton.ts), [useBackButton.ts](src/hooks/useBackButton.ts)

---

## High Priority Fixes

### Fix H-1: Safe Area Insets
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/components/layout/AppLayout.tsx`
- **Problem**: Mixed use of `safeAreaInset` vs `contentSafeAreaInset`
- **Fix**: Updated to use `contentSafeAreaInset` for content area

**Artifacts**:
> [AppLayout.tsx](src/components/layout/AppLayout.tsx)

---

### Fix H-2: Error Boundaries
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/components/ErrorBoundary.tsx`, `src/App.tsx`
- **Problem**: No error boundaries - app crashes on errors
- **Fix**: Created ErrorBoundary component and wrapped Routes

**Artifacts**:
> [ErrorBoundary.tsx](src/components/ErrorBoundary.tsx), [App.tsx](src/App.tsx)

---

### Fix H-3: Race Condition in updatePreferences
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **File**: `src/hooks/useCloudStorage.ts:362-395`
- **Problem**: Stale closure in updatePreferences callback
- **Fix**: Used functional update pattern for setPreferences

**Artifacts**:
> [useCloudStorage.ts](src/hooks/useCloudStorage.ts)

---

### Fix H-4: Haptic Feedback Fallback
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **File**: `src/hooks/useTelegramWebApp.ts:455-505`
- **Problem**: No fallback when HapticFeedback API unavailable
- **Fix**: Added Web Vibration API fallback (navigator.vibrate)

**Artifacts**:
> [useTelegramWebApp.ts](src/hooks/useTelegramWebApp.ts)

---

## Medium Priority Fixes

### Fix M-1: Translation Types Consistency
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/hooks/useTranslation.ts`
- **Problem**: Inconsistent translation function typing
- **Fix**: Created typed useTranslation hook

**Artifacts**:
> [useTranslation.ts](src/hooks/useTranslation.ts)

---

### Fix M-3: Consolidate Icons
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/components/icons/index.tsx`
- **Problem**: Duplicate icon components across files
- **Fix**: Created shared icon library with all icons

**Artifacts**:
> [icons/index.tsx](src/components/icons/index.tsx)

---

### Fix M-4: Accessibility Labels
- **Status**: [ ] Deferred
- **Notes**: Can be done incrementally in future updates

---

### Fix M-5: Image Lazy Loading
- **Status**: [ ] Deferred
- **Notes**: Minor optimization, can be done incrementally

---

### Fix L-3: Layout Constants
- **Status**: [X] Completed
- **Agent**: react-vite-specialist
- **Files**: `src/constants/layout.ts`, `src/components/layout/AppLayout.tsx`
- **Problem**: Magic numbers for bottom padding (100px, 80px)
- **Fix**: Extracted to shared constants file

**Artifacts**:
> [layout.ts](src/constants/layout.ts), [AppLayout.tsx](src/components/layout/AppLayout.tsx)

---

## Verification

After all fixes:
- [X] TypeScript compiles (`pnpm type-check`) - PASSED
- [X] Build succeeds (`pnpm build`) - PASSED (6.68s)
- [ ] No memory leak warnings in dev console - needs manual testing
- [ ] Haptic feedback works (Telegram + web fallback) - needs manual testing
- [ ] Error boundary catches errors gracefully - needs manual testing

---

## Summary

| Priority | Total | Completed | Deferred |
|----------|-------|-----------|----------|
| Critical | 2 | 2 | 0 |
| High | 4 | 4 | 0 |
| Medium | 4 | 3 | 2 |
| **Total** | **10** | **9** | **2** |

### Files Created
- `src/hooks/useMainButton.ts` (211 lines)
- `src/hooks/useBackButton.ts` (152 lines)
- `src/hooks/useTranslation.ts` (~50 lines)
- `src/components/icons/index.tsx` (~300 lines)
- `src/constants/layout.ts` (~40 lines)

### Files Modified
- `src/hooks/useCloudStorage.ts` - C-1, H-3 fixes
- `src/hooks/useTelegramWebApp.ts` - H-4 fix
- `src/components/layout/AppLayout.tsx` - H-1, L-3 fixes
- `src/components/ErrorBoundary.tsx` - H-2 fix (updated)
- `src/App.tsx` - H-2 fix (wrapped with ErrorBoundary)

---

**Completed**: 2025-12-31
**Verification Time**: type-check + build passed

