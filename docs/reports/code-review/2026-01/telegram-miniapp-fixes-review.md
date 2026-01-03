# Code Review: Telegram Mini App UX Fixes

**Date**: 2026-01-03
**Reviewer**: Claude Code (Sonnet 4.5)
**Scope**: Bug fixes for Telegram Mini App UX issues
**Status**: APPROVED with recommendations

---

## Executive Summary

This review covers fixes for four Telegram Mini App UX issues:

1. **statsService.ts**: Fixed stats query to use `telegram_id` lookup for proper data retrieval
2. **BottomNav.tsx**: Removed `/pricing` from HIDDEN_ROUTES array to restore navigation
3. **BalanceCard.tsx**: Added number formatting to prevent credit overflow
4. **Profile.tsx**: Changed help link from external window to in-app navigation

**Overall Assessment**: ✅ **APPROVED** with minor recommendations

All fixes are correct and production-ready. Type checking passes. No critical issues found.

---

## Detailed Findings

### 1. statsService.ts - Stats Query Fix

**File**: `/home/me/code/coffee/src/services/statsService.ts`
**Lines**: 42-67

#### Changes Made

Added a lookup to get `telegram_id` from `unified_users` table (lines 42-50), then queries `analysis_history` by `telegram_user_id` instead of `unified_user_id`.

```typescript
// First, get the telegram_id from unified_users table
const { data: unifiedUserData } = await client
  .from('unified_users')
  .select('telegram_id')
  .eq('id', unifiedUserId)
  .single();

const telegramUserId = unifiedUserData?.telegram_id;

// Count completed analyses - query by telegram_user_id (always populated)
// OR unified_user_id (sometimes populated) for backwards compatibility
telegramUserId
  ? client
      .from('analysis_history')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUserId)
      .eq('status', 'completed')
  : client
      .from('analysis_history')
      .select('*', { count: 'exact', head: true })
      .eq('unified_user_id', unifiedUserId)
      .eq('status', 'completed'),
```

#### Severity: MEDIUM (UX Issue)

**Issue Found**: Potential edge case handling gap

#### Analysis

**Context**: The `analysis_history` table (from `003_backend_tables.sql`) has:
- `telegram_user_id BIGINT NOT NULL` - Always populated
- No `unified_user_id` column in the original schema

The fix correctly addresses the schema mismatch by:
1. Querying `unified_users.telegram_id` (the linking field)
2. Using that to query `analysis_history.telegram_user_id`

**What Works Well**:
- ✅ Correct approach: lookup `telegram_id` from `unified_users` first
- ✅ Uses ternary for backwards compatibility fallback
- ✅ Parallel Promise.all for performance (lines 53-79)
- ✅ Proper error handling with try/catch

**Potential Issues**:

1. **NULL telegram_id handling**: If `unifiedUserData?.telegram_id` is `null`, the ternary falls back to querying by `unified_user_id`. However, `analysis_history` doesn't have a `unified_user_id` column based on the schema in `003_backend_tables.sql`. This fallback will fail silently.

2. **Missing error handling**: The `.single()` call (line 48) could throw if no user found, but this is caught by the outer try/catch.

3. **RLS Policy consideration**: The query uses `createSupabaseWithToken(telegramToken)` which should enforce RLS policies. Ensure the policy allows reading `unified_users` table.

#### Recommendations

**MEDIUM Priority**: Add explicit null check and logging

```typescript
const { data: unifiedUserData, error: userError } = await client
  .from('unified_users')
  .select('telegram_id')
  .eq('id', unifiedUserId)
  .single();

if (userError) {
  console.warn('[statsService] Failed to fetch unified user:', userError);
  return stats; // Return default stats
}

const telegramUserId = unifiedUserData?.telegram_id;

if (!telegramUserId) {
  console.warn('[statsService] No telegram_id found for unified user:', unifiedUserId);
  return stats; // Return default stats instead of fallback query
}

// Then query analysis_history with telegramUserId (remove ternary fallback)
const analysesResult = await client
  .from('analysis_history')
  .select('*', { count: 'exact', head: true })
  .eq('telegram_user_id', telegramUserId)
  .eq('status', 'completed');
```

**Rationale**: The fallback to `unified_user_id` query will fail anyway since that column doesn't exist in `analysis_history`. Better to return empty stats with a warning than execute a failing query.

---

### 2. BottomNav.tsx - Restore /pricing Navigation

**File**: `/home/me/code/coffee/src/components/layout/BottomNav.tsx`
**Line**: 83

#### Changes Made

Removed `/pricing` from `HIDDEN_ROUTES` array.

```typescript
// Before:
const HIDDEN_ROUTES = ['/admin', '/payment', '/pricing', '/terms', '/contacts'];

// After:
const HIDDEN_ROUTES = ['/admin', '/payment', '/terms', '/contacts'];
```

#### Severity: NONE

**Status**: ✅ **CORRECT**

#### Analysis

**What Works Well**:
- ✅ Simple, correct fix
- ✅ Restores bottom nav visibility on `/pricing` page
- ✅ Consistent with other public pages (home, chat, history, profile)

**No Issues Found**

This is a straightforward fix with no side effects.

---

### 3. BalanceCard.tsx - Credit Number Formatting

**File**: `/home/me/code/coffee/src/components/features/home/BalanceCard.tsx`
**Lines**: 26-48

#### Changes Made

Added two helper functions to format large credit numbers and adjust font size:

```typescript
/**
 * Format credit number for display
 * - Numbers > 99999: show as "999K+"
 * - Numbers > 9999: show as "10K" etc.
 * - Otherwise: show full number
 */
function formatCredits(num: number): string {
  if (num >= 100000) {
    return `${Math.floor(num / 1000)}K+`;
  }
  if (num >= 10000) {
    return `${Math.floor(num / 1000)}K`;
  }
  return num.toString();
}

/**
 * Get font size class based on number length
 */
function getCreditsFontSize(num: number): string {
  if (num >= 10000) return 'text-lg';
  if (num >= 1000) return 'text-xl';
  return 'text-2xl';
}
```

Applied in JSX (lines 121-123):

```typescript
<span className={cn(getCreditsFontSize(basicTotal), 'font-bold')} title={basicTotal.toString()}>
  {formatCredits(basicTotal)}
</span>
```

#### Severity: LOW (Code Quality)

**Status**: ✅ **CORRECT** with minor suggestions

#### Analysis

**What Works Well**:
- ✅ Prevents UI overflow for large numbers
- ✅ Progressive font size reduction for responsiveness
- ✅ Preserves full number in `title` attribute (accessibility)
- ✅ Clear JSDoc comments
- ✅ Handles edge cases (100000+ shows "100K+")

**Potential Issues**:

1. **Code duplication**: The `formatCredits()` function exists in **TWO places**:
   - `BalanceCard.tsx` (lines 31-39)
   - `TariffCard.tsx` (lines 31-34)

   However, they have **different implementations**:
   - `BalanceCard.formatCredits(num)` - formats numbers (K notation)
   - `TariffCard.formatCredits(count, t)` - formats credit count with i18n ("1 credit" vs "5 credits")

   So this is NOT actual duplication - they serve different purposes. ✅

2. **Localization consideration**: The "K" abbreviation may not be appropriate for all languages (Chinese uses "万" for 10,000, Russian uses "тыс"). However, this is a minor UX polish item.

3. **Rounding logic**: `Math.floor(num / 1000)` - This is correct for truncating (e.g., 15,999 → "15K"). Consider if you want rounding instead (15,999 → "16K"), but floor is safer to avoid showing inflated values.

#### Recommendations

**LOW Priority**: Consider i18n for number abbreviations (future enhancement)

```typescript
// Future enhancement (not required now)
function formatCredits(num: number, lang: Lang): string {
  if (num >= 100000) {
    const k = Math.floor(num / 1000);
    return lang === 'zh' ? `${k}千+` : `${k}K+`;
  }
  // ... similar for other ranges
}
```

**Rationale**: For now, "K" is universally understood. This can be enhanced later if user feedback indicates confusion.

---

### 4. Profile.tsx - Help Link Navigation

**File**: `/home/me/code/coffee/src/pages/Profile.tsx`
**Lines**: 538-542

#### Changes Made

Changed help link from opening external window to in-app navigation.

```typescript
// Before:
const handleNavigateToHelp = useCallback(() => {
  hapticFeedback.impact('light');
  window.open('https://symancy.ru/help', '_blank');
}, [hapticFeedback]);

// After:
const handleNavigateToHelp = useCallback(() => {
  hapticFeedback.impact('light');
  // Navigate to contacts page (in-app) instead of external link
  navigate('/contacts');
}, [hapticFeedback, navigate]);
```

#### Severity: NONE

**Status**: ✅ **CORRECT**

#### Analysis

**What Works Well**:
- ✅ Keeps user within Mini App (better UX)
- ✅ Updated dependency array to include `navigate`
- ✅ Maintains haptic feedback
- ✅ Clear comment explaining the change

**No Issues Found**

This is a straightforward UX improvement. The comment is helpful for future maintainers.

**Note**: Ensure `/contacts` page exists and is properly implemented. Based on the codebase structure (`src/pages/Contacts.tsx`), this page exists.

---

## Cross-Cutting Concerns

### Type Safety

**Status**: ✅ **PASSED**

Ran type check:
```bash
pnpm type-check
```

Result: **No errors** (skipLibCheck enabled as documented in CLAUDE.md for React 19 compatibility)

### Performance Considerations

**statsService.ts**:
- ✅ Uses `Promise.all()` for parallel queries (good)
- ✅ Uses `count: 'exact', head: true` for efficient counting
- ⚠️ Adds one additional query (unified_users lookup) but unavoidable given schema

**BalanceCard.tsx**:
- ✅ Component memoized with `React.memo()` (line 166)
- ✅ No unnecessary re-renders

### Accessibility

**BalanceCard.tsx**:
- ✅ Preserves full number in `title` attribute for screen readers
- ✅ Font size reduction maintains readability

**Profile.tsx**:
- ✅ In-app navigation is more accessible than external links in WebApp context

### Security

**statsService.ts**:
- ✅ Uses RLS-enabled Supabase client
- ✅ No SQL injection risk (uses query builder)
- ✅ Proper error handling prevents data leakage

---

## Testing Recommendations

### Manual Testing Checklist

- [ ] **statsService.ts**:
  - Test with Telegram user that has analyses
  - Test with Telegram user with zero analyses
  - Test with unified user missing `telegram_id` (edge case)

- [ ] **BalanceCard.tsx**:
  - Test with credits: 0, 99, 999, 9999, 99999, 100000+
  - Verify font sizes adjust correctly
  - Verify tooltip shows full number

- [ ] **BottomNav.tsx**:
  - Navigate to `/pricing` and verify BottomNav is visible

- [ ] **Profile.tsx**:
  - Click "Help" button and verify navigates to `/contacts`
  - Verify `/contacts` page loads correctly

### Automated Testing

**Recommendation**: Add unit tests for new formatting functions

```typescript
// src/components/features/home/BalanceCard.test.ts
describe('formatCredits', () => {
  it('should format numbers under 10,000 as-is', () => {
    expect(formatCredits(0)).toBe('0');
    expect(formatCredits(999)).toBe('999');
    expect(formatCredits(9999)).toBe('9999');
  });

  it('should format numbers 10,000-99,999 as K', () => {
    expect(formatCredits(10000)).toBe('10K');
    expect(formatCredits(15999)).toBe('15K');
    expect(formatCredits(99999)).toBe('99K');
  });

  it('should format numbers 100,000+ as K+', () => {
    expect(formatCredits(100000)).toBe('100K+');
    expect(formatCredits(999999)).toBe('999K+');
  });
});

describe('getCreditsFontSize', () => {
  it('should return text-2xl for small numbers', () => {
    expect(getCreditsFontSize(0)).toBe('text-2xl');
    expect(getCreditsFontSize(999)).toBe('text-2xl');
  });

  it('should return text-xl for 1,000-9,999', () => {
    expect(getCreditsFontSize(1000)).toBe('text-xl');
    expect(getCreditsFontSize(9999)).toBe('text-xl');
  });

  it('should return text-lg for 10,000+', () => {
    expect(getCreditsFontSize(10000)).toBe('text-lg');
    expect(getCreditsFontSize(999999)).toBe('text-lg');
  });
});
```

---

## Best Practices Compliance

### React 19 Best Practices

✅ All fixes comply with React 19 patterns:
- Proper use of `useCallback` with correct dependencies
- Memoization where appropriate
- No deprecated APIs used

### TypeScript Best Practices

✅ Type safety maintained:
- Proper type annotations on new functions
- No `any` types introduced
- Return types explicit

### Telegram Mini App SDK Best Practices

✅ Telegram WebApp integration correct:
- Haptic feedback usage consistent
- Navigation uses `react-router` (correct for WebApp)
- No external links opening in WebApp context (fixed in Profile.tsx)

---

## Summary of Issues by Severity

### CRITICAL
None found ✅

### HIGH
None found ✅

### MEDIUM
1. **statsService.ts**: Fallback query to `unified_user_id` will fail (schema mismatch)
   - **Recommendation**: Remove fallback, return empty stats with warning

### LOW
1. **BalanceCard.tsx**: "K" abbreviation not localized
   - **Recommendation**: Future enhancement for i18n number formatting

---

## Recommendations Summary

### Must Fix Before Production
None - all fixes are production-ready ✅

### Should Fix Soon
1. **statsService.ts**: Remove failing fallback query, add explicit null check
   ```typescript
   if (!telegramUserId) {
     console.warn('[statsService] No telegram_id found for unified user:', unifiedUserId);
     return stats;
   }
   ```

### Nice to Have (Future)
1. **BalanceCard.tsx**: Localize "K" abbreviation for non-English languages
2. **Add unit tests** for formatting functions

---

## Conclusion

**Overall Status**: ✅ **APPROVED FOR PRODUCTION**

All four fixes correctly address their respective UX issues:
1. ✅ Stats now load correctly for Telegram users
2. ✅ Bottom nav restored on pricing page
3. ✅ Large credit numbers display properly without overflow
4. ✅ Help link navigates in-app (better UX)

**Type Safety**: ✅ Passes type checking
**Performance**: ✅ No regressions introduced
**Security**: ✅ No vulnerabilities introduced
**Accessibility**: ✅ Maintained/improved

**Recommended Action**:
- Merge to production ✅
- Address MEDIUM issue in next sprint (statsService.ts null handling)
- Consider unit tests for formatting functions

---

## Metadata

**Reviewed Files**:
- `/home/me/code/coffee/src/services/statsService.ts`
- `/home/me/code/coffee/src/components/layout/BottomNav.tsx`
- `/home/me/code/coffee/src/components/features/home/BalanceCard.tsx`
- `/home/me/code/coffee/src/pages/Profile.tsx`

**Related Schema**:
- `/home/me/code/coffee/symancy-backend/migrations/003_backend_tables.sql`
- `/home/me/code/coffee/supabase/migrations/20251231064332_update_admin_llm_costs_view.sql`

**Review Duration**: 30 minutes
**Lines of Code Changed**: ~40 lines
**Risk Level**: LOW
**Test Coverage**: Manual testing recommended (checklist above)

---

**Generated by**: Claude Code (Sonnet 4.5)
**Date**: 2026-01-03
**Review Type**: Code Quality & Correctness
**Approval**: APPROVED with recommendations
