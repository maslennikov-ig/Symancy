# Code Review: Pricing Page Auth Fix + Ruble Symbol + i18n

**Date**: 2026-04-11
**Scope**: Recent changes fixing auth gate, ruble rendering, and i18n on /pricing, plus release.sh SIGPIPE fix
**Files**: 3 | **Changes**: +42 / -10

## Summary

|              | Critical | High | Medium | Low |
| ------------ | -------- | ---- | ------ | --- |
| Issues       | 0        | 1    | 2      | 2   |
| Improvements | —        | 1    | 2      | 2   |

**Verdict**: NEEDS WORK

The primary bug fix (Telegram auth gate) is correct. The ruble symbol approach works but has a subtle font-consistency issue. Two medium issues need attention: a race condition where the auth loading state is not propagated to the Pricing route (causing a flash of wrong button state), and a silent no-op in `handleBuy` when `onLogin` is not provided. The dead `price` field and excessive `as any` casts are low-priority cleanup items.

---

## Issues

### High

#### 1. Auth loading state not propagated to Pricing — flash of wrong button state

- **File**: `src/App.tsx:590`
- **Problem**: `isAuthenticated={authIsAuthenticated}` is computed from `AuthContext.isAuthenticated`, which is `false` while `loading === true` (the auth state is still being resolved, e.g. while `waitForTelegramWebApp` polls or the Supabase session fetch is in flight). The Pricing route renders immediately via `withAppLayout(...)` — there is no guard waiting for `loading` to settle. As a result, a Telegram user who IS authenticated will briefly see the "Войти для покупки" button before auth resolves.
- **Impact**: On slow devices or first load inside Telegram, the CTA button flashes the wrong label and could let the user tap the login modal unnecessarily. More importantly: if the user taps in the first ~1 second, they get the auth modal instead of the buy flow.
- **Evidence**: `AuthContext.tsx:74` — `loading` starts as `true`; `AuthContext.tsx:88` — `waitForTelegramWebApp` with up to 1000ms poll; `App.tsx:590` — Pricing rendered without waiting for `loading`.
- **Fix**:

```tsx
// src/App.tsx — destructure loading from useAuth
const { user, isAuthenticated: authIsAuthenticated, loading: authLoading } = useAuth();

// src/App.tsx:590 — pass loading state to Pricing
element={withAppLayout(
  <Pricing
    language={language}
    t={t}
    onBuyTariff={(productType) => handleSelectTariff(productType as ProductType)}
    isAuthenticated={authIsAuthenticated}
    isAuthLoading={authLoading}
    onLogin={() => setShowPricingAuth(true)}
  />
)}

// src/pages/Pricing.tsx — use loading state to suppress the button or show skeleton
interface PricingProps {
  isAuthLoading?: boolean;
  // ...
}
// In the CTA:
<Button
  onClick={() => handleBuy(tariff.type)}
  disabled={isAuthLoading}
  // ...
>
  {isAuthLoading
    ? '...'
    : isAuthenticated
      ? t('pricing.button.buy' as any)
      : t('pricing.button.login' as any)}
</Button>
```

---

### Medium

#### 2. Silent no-op when `onLogin` is not provided and user is not authenticated

- **File**: `src/pages/Pricing.tsx:150-155`
- **Problem**: If neither `isAuthenticated` nor `onLogin` is provided (e.g. if Pricing is ever used standalone or without the prop, or the parent forgets to pass it), `handleBuy` silently does nothing. The previous code at least navigated to `/`. The new code has no fallback.

```ts
const handleBuy = (type: string) => {
  if (isAuthenticated && onBuyTariff) {
    onBuyTariff(type);
  } else if (onLogin) {
    onLogin();  // <-- only fires if onLogin was provided
  }
  // else: nothing happens, user clicks button and nothing occurs
};
```

- **Impact**: Not triggered in current production wiring, but fragile — an easy regression point. If `onLogin` is ever removed or forgotten in a refactor, unauthenticated users see a dead button.
- **Fix**: Add a fallback navigate or at least a console warning:

```ts
const handleBuy = (type: string) => {
  if (isAuthenticated && onBuyTariff) {
    onBuyTariff(type);
  } else if (onLogin) {
    onLogin();
  } else {
    // Fallback: navigate to home if auth callback not wired up
    navigate('/');
  }
};
```

#### 3. Temp file not cleaned up on unexpected error in release.sh

- **File**: `.claude/scripts/release.sh:953-978` and `1022-1067`
- **Problem**: `tmpfile=$(mktemp)` is called inside `update_changelog()` and `update_release_notes()`. If any command between `mktemp` and `rm -f "$tmpfile"` raises a non-zero exit, the `trap cleanup EXIT` fires but `cleanup()` only removes `BACKUP_FILES[@]` — it does not remove `tmpfile`. The tmpfile is a local variable not tracked globally.

```bash
# update_changelog:
tmpfile=$(mktemp)       # tmpfile created
cp "$changelog_file" "$tmpfile"
# ... if grep -q exits non-zero → cleanup trap fires → tmpfile not removed
rm -f "$tmpfile"        # never reached on error
```

- **Impact**: Low severity — mktemp files are in `/tmp` and cleaned on reboot. However, on a long-running CI environment repeated failures could accumulate stale temp files.
- **Fix**: Use a local trap within the function to ensure cleanup:

```bash
update_changelog() {
    local tmpfile
    tmpfile=$(mktemp)
    trap "rm -f '$tmpfile'" RETURN  # clean up on function exit (success or error)
    cp "$changelog_file" "$tmpfile"
    # ... rest of function ...
    rm -f "$tmpfile"
    trap - RETURN
}
```

Or register via subshell so the local trap does not conflict with the global EXIT trap.

---

### Low

#### 4. Dead `price: string` field on the `Tariff` interface and TARIFFS data

- **File**: `src/pages/Pricing.tsx:11, 34, 53, 74, 94`
- **Problem**: The `Tariff` interface declares `price: string` (e.g. `'100 ₽'`, `'1 000 ₽'`). After the fix switched the render to use `tariff.priceNum.toLocaleString('ru-RU')` + `&#8381;`, the `price` string field is no longer used anywhere in the template. It is dead data.
- **Impact**: Misleading — future developers may believe `price` is the canonical field and reference it. Violates single source of truth.
- **Fix**: Remove `price: string` from the `Tariff` interface and delete the `price` values from all four TARIFF objects. Keep only `priceNum`.

#### 5. `useNavigate` is imported but only used for the return button, not the auth flow

- **File**: `src/pages/Pricing.tsx:2, 146`
- **Problem**: Not a dead import — `navigate('/')` is still called at line 401 (return button). However, after the auth fix, `navigate` is no longer used in `handleBuy`. Worth noting that this import is still legitimate and should NOT be removed. This is a documentation correction: the PR description says "`useNavigate` still needed in Pricing.tsx" — it is, for the return button only.
- **Impact**: No functional issue. Low priority notation only.
- **Fix**: None needed for the import. Just a clarification.

---

## Improvements

### High

#### 1. No post-auth action after successful login from Pricing page

- **File**: `src/App.tsx:651` / `src/components/features/auth/AuthModal.tsx:127`
- **Problem**: After the user logs in via the modal triggered from the Pricing page, `AuthModal` calls `onClose()` which sets `showPricingAuth = false`. The user is returned to the Pricing page, now authenticated. However, the purchase flow they intended to start is NOT continued — they still need to click the buy button again manually. This is a UX friction point that will cause drop-off.
- **Recommendation**: Pass a `onSuccess` callback to `AuthModal` that, after login, automatically triggers `handleSelectTariff` for whichever plan the user was attempting to buy. This requires threading the selected tariff type through from `Pricing → onLogin → App → AuthModal`.

```tsx
// Pricing.tsx — pass selected type to onLogin
const handleBuy = (type: string) => {
  if (isAuthenticated && onBuyTariff) {
    onBuyTariff(type);
  } else if (onLogin) {
    onLogin(type);  // pass the tariff type
  }
};

// App.tsx
const [pendingTariff, setPendingTariff] = useState<string | null>(null);

// onLogin prop becomes:
onLogin={(type) => { setPendingTariff(type); setShowPricingAuth(true); }}

// AuthModal onClose:
<AuthModal
  onClose={() => setShowPricingAuth(false)}
  onSuccess={() => {
    setShowPricingAuth(false);
    if (pendingTariff) handleSelectTariff(pendingTariff as ProductType);
    setPendingTariff(null);
  }}
  t={t}
/>
```

---

### Medium

#### 2. Pervasive `as any` casts on i18n translation keys

- **File**: `src/pages/Pricing.tsx:213, 245, 261, 285, 304, 305, 353, 388`
- **Problem**: Eight separate `t('key' as any)` casts. These defeat TypeScript's ability to catch missing translation keys at compile time. The root cause is that the Pricing page uses translation keys that technically exist in i18n.ts but are not yet typed in the `t` function signature for all Pricing-specific keys.
- **Recommendation**: Instead of `as any`, extend the i18n type to cover all Pricing keys. The `t` function in App.tsx is typed as `(key: keyof typeof translations.en) => string` — if all Pricing keys ARE in `translations.en` (which they are, verified), the casts are unnecessary. The issue is that `propT` and the locally constructed `t` have a narrower type path. The fix is structural:

```ts
// In Pricing.tsx, change the prop type:
interface PricingProps {
  t?: (key: keyof typeof translations.en) => string;
}

// And remove all 'as any' casts — the keys already exist in translations.en
// (verified: 'pricing.tariff.basic.name', 'subscription.selector.popular', etc. are all valid)
```

The `as any` casts were added in the original redesign commit and carried forward. The new `subscription.selector.popular` addition was correctly added to all 3 locales (en/ru/zh) — the key exists, the cast is just unnecessary.

#### 3. Ruble span font-size inconsistency between number and symbol

- **File**: `src/pages/Pricing.tsx:251-256`
- **Problem**: The price number is rendered as `font-display text-3xl sm:text-4xl` (Playfair Display, 30px/36px). The ruble symbol `&#8381;` is rendered in a sibling span as `text-3xl sm:text-4xl` without `font-display` (falls back to Inter or system font). This means:
  1. Font metrics (cap-height, line-height, baseline) differ between the two spans, which can cause subtle vertical misalignment on some platforms.
  2. The `&nbsp;` before `&#8381;` renders as a non-breaking space, so the ruble always appears space-separated, which is correct per Russian typography — but the spacing comes from font metrics and may appear unequal across devices.
- **Recommendation**: A more robust approach is to use a dedicated currency-aware font character or set `font-variant-numeric: tabular-nums` on the number. Alternatively, wrap both in one span and use `font-sans` for the entire price (Inter has the ₽ glyph at codepoint U+20BD):

```tsx
<div className="mb-4">
  <span className="font-sans text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
    {tariff.priceNum.toLocaleString('ru-RU')}&nbsp;&#8381;
  </span>
</div>
```

This sacrifices the Playfair Display style on the price number but eliminates the two-font alignment problem and ensures the ₽ glyph renders from the same font as the digits.

---

### Low

#### 4. `safe_head` / `safe_first` utilities still available but `head` also used directly in release.sh

- **File**: `.claude/scripts/release.sh:960, 1030`
- **Problem**: The script defines `safe_head` and `safe_first` as SIGPIPE-safe `awk`-based utilities. The `update_changelog` and `update_release_notes` functions correctly use `head` after reading from a temp file (no pipeline, so SIGPIPE cannot occur). However, at lines 960 and 1030:

```bash
unreleased_line=$(grep -n "## \[Unreleased\]" "$tmpfile" | head -1 | cut -d: -f1)
first_release_line=$(grep -n "^## v" "$tmpfile" | head -1 | cut -d: -f1 || echo "")
```

These ARE pipelines with `head -1`. Under `set -euo pipefail`, if `grep` finds no match, it returns exit code 1 — but the trailing `|| echo ""` only appears on the second one. The first one at line 960 (`unreleased_line=...`) will only run inside the `if grep -q "## \[Unreleased\]" "$tmpfile"` block, so the outer grep guarantees a match. This is safe but non-obvious.

- **Recommendation**: For consistency and defensive clarity, replace the `| head -1` inside those pipelines with `| safe_first`:

```bash
unreleased_line=$(grep -n "## \[Unreleased\]" "$tmpfile" | safe_first | cut -d: -f1)
first_release_line=$(grep -n "^## v" "$tmpfile" | safe_first | cut -d: -f1 || echo "")
```

#### 5. `credits` field inaccurate for `pro` and `cassandra` tariffs in TARIFFS data

- **File**: `src/pages/Pricing.tsx:76, 96`
- **Problem**: According to `docs/TARIFFS.md`, the `pro` tariff gives 1 pro credit (full analysis of all 6 topics), and `cassandra` consumes 3 credits. In the TARIFFS array:
  - `pro`: `credits: 1` — correct
  - `cassandra`: `credits: 1` — potentially misleading (TARIFFS.md says Cassandra persona costs 3 credits per analysis)

The `credits` field is declared on the interface but not rendered in the UI component. However, it could be consumed by external code or future features, and having `cassandra.credits: 1` contradicts the docs.

- **Recommendation**: Either correct `cassandra.credits` to `3` per the spec, or remove the `credits` field entirely since it is not rendered. If it is used in payment processing, verify against `TARIFFS.md`.

---

## Positive Patterns

1. **Correct auth identity model**: The fix properly uses `AuthContext.isAuthenticated = !!(user || unifiedUser)` instead of the old `!!user`. This correctly handles both Supabase OAuth users and Telegram Mini App users in a single boolean, and the ref-based pattern in AuthContext (lines 78, 103, 134, 200) correctly avoids stale closure issues in the `onAuthStateChange` subscription.

2. **Lazy loading of AuthModal**: The `AuthModal` is added as a lazy import (`const AuthModal = lazy(...)`, line 19) with a `<Suspense fallback={null}>` wrapper (line 650). This is the correct pattern — the modal is rarely shown, so deferring its bundle to the auth-needed moment is appropriate. The `fallback={null}` is intentional (no spinner for the modal shell itself, which avoids layout flash).

3. **SIGPIPE fix approach in release.sh**: The temp file pattern (`mktemp` + `cp` + `head`/`tail` from file) correctly eliminates the SIGPIPE race condition by decoupling the write side from the read side. The previous `echo "$large_string" | safe_head N` approach still had a subtle interaction: the `safe_head` `awk` script exits after N lines, but under `pipefail` any process in the pipeline that exits non-zero can propagate. The temp-file approach is definitively correct.

---

## Escalation

**Auth logic change** — this review modified the auth state that gates payment flows. The change from `!!user` to `authIsAuthenticated` has the correct semantic, but any regression in `AuthContext.isAuthenticated` (e.g. a race condition during hydration) now directly affects whether the payment CTA is shown. Recommend manual QA on both:
- Telegram Mini App cold open (no cached token)
- Supabase OAuth flow (Google sign-in)

Verify that `isAuthenticated` is stable (not flickering) after initial load before and after login.

---

## Validation

- **Type Check**: PASS (`pnpm type-check` — 0 errors)
- **Build**: PASS (`pnpm build` — completed successfully, 8.69s; bundle size warnings pre-existing and unrelated to this change)
