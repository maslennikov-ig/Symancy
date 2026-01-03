# Telegram Mini App UX Fixes - Continuation Prompt

## Context

Project: **Symancy** - Coffee fortune-telling Telegram Mini App
User: **@maslennikovig** (telegram_id: 166848328, unified_user_id: 3b76d1c5-6534-4c4d-bb20-791993dff217)
Current version: **v0.5.23**
Tech stack: React 19, Vite, Supabase, Tailwind CSS, Telegram Mini App SDK

## Issues to Fix

### 1. CRITICAL: Dark Theme Text Issues (Black on Black)

**Affected Pages:**
- `/pricing` - Title "Тарифы Symancy" and subtitle "Выберите подходящий тариф..." are black text on dark background
- Profile page "About" section - black text on black

**Root Cause:** Text elements don't have explicit `text-foreground` class in dark mode.

**Files to check:**
- `src/pages/Pricing.tsx` - Lines 93-99 (header section)
- `src/pages/Profile.tsx` - About section

**Fix:** Add `text-foreground` class to all header text elements.

---

### 2. CRITICAL: Profile Stats Show 0 (Data Exists in DB)

**Symptom:** Profile shows "0 анализов, 0 сообщений" but user has:
- 9 analyses in `analysis_history` (2 completed)
- 8 messages in `chat_messages`
- 7 messages in omnichannel `messages` table

**Root Cause:** `statsService.ts` queries `analysis_history.unified_user_id` but data is stored with `telegram_user_id` only (`unified_user_id` is NULL).

**Database evidence:**
```sql
SELECT unified_user_id FROM analysis_history WHERE telegram_user_id = 166848328;
-- Result: all records have unified_user_id = NULL
```

**File:** `src/services/statsService.ts`

**Fix options:**
1. Query by `telegram_user_id` (from profile) instead of `unified_user_id`
2. Or migrate existing data to populate `unified_user_id`
3. Or join through `unified_users.telegram_id`

**Recommended fix - modify query (lines 46-50):**
```typescript
// Instead of: .eq('unified_user_id', unifiedUserId)
// Use: join to get telegram_user_id from unified_users
```

---

### 3. HIGH: Chat Page Layout Issues

**Symptom:** Chat input field doesn't fit on screen, user must scroll down to see/reach it.

**Screenshot shows:** Large empty space above chat, input barely visible at bottom.

**Files:**
- `src/pages/Chat.tsx`
- `src/components/features/chat/ChatWindow.tsx`

**Fix:** Ensure chat uses `height: 100%` layout with proper flexbox to fit viewport.

---

### 4. HIGH: Balance Card Overflow with Large Numbers

**Symptom:** Balance "999995" is too wide, pushes "Кассандра" label off-screen.

**File:** `src/components/features/home/BalanceCard.tsx`

**Fix options (choose one):**
1. **Responsive font size** - Reduce font size for numbers > 5 digits
2. **Number formatting** - Show "999K+" for large numbers
3. **Horizontal scroll** - Allow horizontal scroll in balance container
4. **Two-row layout** - Stack credits vertically on small screens

**Recommended:** Option 1 or 2 - responsive font or number formatting.

---

### 5. MEDIUM: BottomNav Inconsistency

**Symptom:** BottomNav disappears on `/pricing`, `/about` pages but should be visible for navigation consistency.

**File:** `src/components/layout/BottomNav.tsx` - Line 83:
```typescript
const HIDDEN_ROUTES = ['/admin', '/payment', '/terms', '/contacts', '/pricing'];
```

**Fix:** Remove `/pricing` from HIDDEN_ROUTES (keep only `/admin`, `/payment` for checkout flow).

---

### 6. MEDIUM: Help Link Opens External Website

**Symptom:** "Help" button in Profile navigates to external website instead of in-app page.

**File:** `src/pages/Profile.tsx` - Look for help/support link handler

**Fix:** Create in-app Help page or use Telegram's native help (openLink with internal route).

---

### 7. LOW: About Section Dark Theme

**Symptom:** About app section has dark text on dark background.

**File:** `src/pages/Profile.tsx` - About section

**Fix:** Add `text-foreground` and `text-muted-foreground` classes appropriately.

---

## Key Files Summary

| File | Issues |
|------|--------|
| `src/pages/Pricing.tsx` | Dark theme text (#1), BottomNav (#5) |
| `src/pages/Profile.tsx` | Stats query (#2), About dark text (#7), Help link (#6) |
| `src/pages/Chat.tsx` | Layout overflow (#3) |
| `src/services/statsService.ts` | Wrong query field (#2) |
| `src/components/features/home/BalanceCard.tsx` | Number overflow (#4) |
| `src/components/layout/BottomNav.tsx` | Hidden routes (#5) |

---

## Database Schema Reference

**unified_users table:**
- `id` (uuid) - unified_user_id
- `telegram_id` (bigint) - Telegram user ID
- `auth_id` (uuid) - Supabase Auth ID

**analysis_history table:**
- `telegram_user_id` (bigint) - FK to profiles
- `unified_user_id` (uuid, nullable) - FK to unified_users (OFTEN NULL!)

**User's unified_user_id:** `3b76d1c5-6534-4c4d-bb20-791993dff217`
**User's telegram_id:** `166848328`

---

## RLS Policies Updated

`unified_user_credits` policy was fixed to:
```sql
unified_user_id = auth.uid() -- For Telegram JWT (sub claim)
OR
unified_user_id IN (SELECT id FROM unified_users WHERE auth_id = auth.uid()) -- For Supabase Auth
```

Similar fix may be needed for `analysis_history`, `conversations`, `messages` tables.

---

## Implementation Priority

1. **Stats query fix** (statsService.ts) - Critical, data exists but not showing
2. **Dark theme text** (Pricing, Profile About) - Critical UX issue
3. **Chat layout** - High, main feature unusable
4. **Balance overflow** - High, visual bug
5. **BottomNav consistency** - Medium, navigation UX
6. **Help link** - Medium, inconsistent behavior

---

## Commands to Run After Fixes

```bash
pnpm type-check
pnpm build
git add -A && git commit -m "fix: telegram miniapp ux issues"
git push origin main
```

---

## User Preferences

- Use Context7 for Telegram Mini App SDK documentation
- Follow Telegram official capabilities
- Keep all navigation in-app (no external redirects for core features)
