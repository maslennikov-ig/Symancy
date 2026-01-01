# Code Review Prompt: Telegram Mini App UX Implementation

> **Purpose**: Comprehensive code review of the Telegram Mini App UX implementation (Phases 1-4)
> **Project**: `/home/me/code/coffee`
> **Date**: 2026-01-01
> **Reviewer Agent**: `code-reviewer`

---

## 1. Executive Summary

A complete Telegram Mini App UX was implemented across 4 phases with 48+ new files and 10,000+ lines of code. The implementation covers:

- **Phase 1**: MVP Enhancement (Bottom Navigation, Home Dashboard, Profile, History, CloudStorage, i18n)
- **Phase 2**: Core Features (Onboarding Flow, Photo Analysis Flow, PersonaSelector)
- **Phase 3**: Polish (Daily Insights Service, Statistics Service)
- **Phase 4**: Growth (Share to Story, Push Notifications, Analytics, A/B Testing)

---

## 2. Technical Stack

| Technology | Version | Usage |
|------------|---------|-------|
| React | 19.x | UI Framework |
| TypeScript | 5.8.x | Type safety |
| Vite | 6.x | Build tool |
| shadcn/ui | latest | UI components |
| Supabase | 2.84.x | Backend/Database |
| Telegram Mini Apps SDK | Native API | WebApp integration |

---

## 3. Files to Review

### 3.1 Phase 1 - MVP Enhancement

#### Hooks
| File | LOC | Description |
|------|-----|-------------|
| `src/hooks/useCloudStorage.ts` | ~200 | Telegram CloudStorage wrapper with preferences management |
| `src/hooks/useMainButton.ts` | ~80 | Telegram MainButton lifecycle hook |
| `src/hooks/useBackButton.ts` | ~60 | Telegram BackButton lifecycle hook |
| `src/hooks/useTranslation.ts` | ~40 | Typed translation hook |

#### Layout Components
| File | LOC | Description |
|------|-----|-------------|
| `src/components/layout/BottomNav.tsx` | ~150 | Bottom navigation bar with 4 tabs |
| `src/components/layout/AppLayout.tsx` | ~100 | Main app layout with safe area insets |

#### Pages
| File | LOC | Description |
|------|-----|-------------|
| `src/pages/Home.tsx` | ~200 | Home dashboard with cards |
| `src/pages/Profile.tsx` | ~300 | User profile with settings |
| `src/pages/Profile/Credits.tsx` | ~150 | Credits management |
| `src/pages/History.tsx` | ~100 | Analysis history page |

#### Home Feature Components
| File | LOC | Description |
|------|-----|-------------|
| `src/components/features/home/BalanceCard.tsx` | ~80 | Credit balance display |
| `src/components/features/home/DailyInsightCard.tsx` | ~100 | Daily insight with rotation |
| `src/components/features/home/QuickActions.tsx` | ~80 | Quick action buttons |
| `src/components/features/home/RecentActivity.tsx` | ~100 | Recent activity list |

#### Shared
| File | LOC | Description |
|------|-----|-------------|
| `src/components/icons/index.tsx` | ~200 | Shared icon components |
| `src/components/ErrorBoundary.tsx` | ~80 | Error boundary with fallback |
| `src/constants/layout.ts` | ~30 | Layout constants |

#### Modified
| File | Changes |
|------|---------|
| `src/App.tsx` | Added routing, lazy loading, onboarding check |
| `src/lib/i18n.ts` | 517+ keys × 3 languages (ru, en, zh) |
| `src/hooks/useTelegramWebApp.ts` | Added requestWriteAccess type |

---

### 3.2 Phase 2 - Core Features

#### Onboarding Flow
| File | LOC | Description |
|------|-----|-------------|
| `src/pages/Onboarding/index.tsx` | ~200 | 4-step onboarding controller |
| `src/pages/Onboarding/Welcome.tsx` | ~80 | Welcome step |
| `src/pages/Onboarding/Language.tsx` | ~100 | Language selection step |
| `src/pages/Onboarding/HowItWorks.tsx` | ~120 | How it works step |
| `src/pages/Onboarding/FreeCredit.tsx` | ~100 | Free credit gift step |
| `src/components/features/onboarding/StepIndicator.tsx` | ~90 | Progress dots indicator |

#### Photo Analysis Flow
| File | LOC | Description |
|------|-----|-------------|
| `src/pages/Analysis/index.tsx` | ~330 | Analysis flow controller |
| `src/pages/Analysis/Capture.tsx` | ~150 | Photo capture step |
| `src/pages/Analysis/Preview.tsx` | ~200 | Photo preview + persona selection |
| `src/pages/Analysis/Processing.tsx` | ~100 | Processing animation |
| `src/components/features/analysis/PersonaSelector.tsx` | ~150 | Arina/Cassandra selector |

---

### 3.3 Phase 3 - Polish

#### Services
| File | LOC | Description |
|------|-----|-------------|
| `src/services/dailyInsightService.ts` | ~200 | 14 insights × 3 languages, day-based rotation |
| `src/services/statsService.ts` | ~100 | Real Supabase stats queries |

---

### 3.4 Phase 4 - Growth

#### Share Functionality
| File | LOC | Description |
|------|-----|-------------|
| `src/hooks/useShareStory.ts` | ~190 | Telegram shareToStory API wrapper |
| `src/components/features/share/ShareButton.tsx` | ~170 | Share button component |

#### Push Notifications
| File | LOC | Description |
|------|-----|-------------|
| `src/hooks/useNotifications.ts` | ~285 | requestWriteAccess + CloudStorage sync |
| `src/components/features/settings/NotificationToggle.tsx` | ~260 | Notification toggle UI |

#### Analytics
| File | LOC | Description |
|------|-----|-------------|
| `src/services/analyticsService.ts` | ~250 | Extended with 8 new event types |

#### A/B Testing
| File | LOC | Description |
|------|-----|-------------|
| `src/services/abTestingService.ts` | ~160 | DJB2 hash, 3 experiments |
| `src/hooks/useExperiment.ts` | ~325 | Experiment hooks with CloudStorage |

---

## 4. Review Checklist

### 4.1 Code Quality
- [ ] TypeScript strict mode compliance
- [ ] Proper type definitions (no `any` types)
- [ ] Consistent naming conventions
- [ ] Code duplication detection
- [ ] Dead code detection
- [ ] Proper error handling

### 4.2 React Patterns
- [ ] Proper hook dependencies in useEffect/useCallback/useMemo
- [ ] No memory leaks (cleanup in useEffect)
- [ ] Correct use of React 19 patterns
- [ ] Proper component composition
- [ ] Props interface definitions
- [ ] Memoization where needed

### 4.3 Telegram Integration
- [ ] Proper API availability checks before calling
- [ ] Graceful fallbacks for non-Telegram environments
- [ ] CloudStorage error handling
- [ ] MainButton/BackButton lifecycle management
- [ ] Haptic feedback implementation
- [ ] Safe area insets usage

### 4.4 Security
- [ ] No hardcoded credentials or secrets
- [ ] Proper input validation
- [ ] XSS prevention in user content
- [ ] Secure API calls
- [ ] Token handling in authService

### 4.5 Performance
- [ ] Unnecessary re-renders
- [ ] Proper lazy loading usage
- [ ] Bundle size impact
- [ ] Image optimization
- [ ] API call optimization

### 4.6 Accessibility
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation support
- [ ] Color contrast compliance
- [ ] Screen reader compatibility

### 4.7 i18n
- [ ] All user-facing strings in i18n
- [ ] All 3 languages have complete translations
- [ ] Proper translation key structure
- [ ] No hardcoded text in components

### 4.8 Error Handling
- [ ] Try-catch blocks where needed
- [ ] User-friendly error messages
- [ ] Error boundary coverage
- [ ] Graceful degradation

---

## 5. Specific Areas of Concern

### 5.1 High Priority

1. **useCloudStorage Memory Leaks**
   - Check if all CloudStorage callbacks are properly cleaned up
   - Verify race condition handling in updatePreferences

2. **useExperiment Initialization**
   - Verify the timeout-based initialization doesn't cause issues
   - Check if variant assignment is truly deterministic

3. **useNotifications Backend Sync**
   - The backend endpoint `/api/users/notification-settings` may not exist
   - Verify error handling when backend is unavailable

4. **ShareButton Image URL**
   - Telegram requires publicly accessible HTTPS URLs
   - Verify image URL handling for analysis results

### 5.2 Medium Priority

1. **A/B Testing Hash Distribution**
   - Verify DJB2 hash provides uniform distribution
   - Check edge cases (empty userId, special characters)

2. **Analytics Tracking**
   - Verify all events are being tracked correctly
   - Check if analytics failures are truly silent

3. **Onboarding Flow**
   - Verify credit granting logic
   - Check if onboardingCompleted flag is properly persisted

### 5.3 Low Priority

1. **Icon Consistency**
   - Check if all icons follow same style
   - Verify icon accessibility

2. **CSS-in-JS vs Tailwind**
   - Some components use inline styles, others use Tailwind
   - Check for consistency

---

## 6. Expected Output Format

Please provide the review in the following format:

```markdown
# Code Review Report: Telegram Mini App UX

## Summary
- Total issues found: X
- Critical: X
- High: X
- Medium: X
- Low: X

## Critical Issues (must fix before production)
### C-1: [Issue Title]
- **File**: path/to/file.ts:line
- **Description**: What's wrong
- **Impact**: Why it matters
- **Suggested Fix**: How to fix it
- **Code Example**: Before/After

## High Priority Issues
### H-1: [Issue Title]
...

## Medium Priority Issues
### M-1: [Issue Title]
...

## Low Priority Issues / Suggestions
### L-1: [Issue Title]
...

## Best Practices Observations
- What was done well
- Patterns to continue

## Recommended Improvements
1. Improvement 1
2. Improvement 2
...
```

---

## 7. Commands for Review

```bash
# Run type-check
pnpm type-check

# Run build
pnpm build

# Check file structure
find src -name "*.tsx" -o -name "*.ts" | head -50

# Count lines of code
wc -l src/hooks/*.ts src/pages/**/*.tsx src/components/**/*.tsx
```

---

## 8. Reference Documents

- **Spec**: `/home/me/code/coffee/specs/008-telegram-miniapp-ux/spec.md`
- **Tasks**: `/home/me/code/coffee/specs/008-telegram-miniapp-ux/tasks.md`
- **Project Docs**: `/home/me/code/coffee/CLAUDE.md`
- **i18n Guide**: `/home/me/code/coffee/docs/I18N_GUIDE.md`

---

## 9. Orchestrator Instructions

When running this review:

1. **Read all files** listed in Section 3 before making any assessments
2. **Run type-check and build** to verify compilation
3. **Use Context7** for Telegram Mini Apps SDK documentation if needed
4. **Check cross-file dependencies** (hooks used in components, services used in pages)
5. **Generate actionable report** with specific file:line references
6. **Prioritize issues** by severity and impact

---

*This document serves as a comprehensive prompt for code review. The reviewer should analyze all mentioned files and provide a detailed report following the expected output format.*
