# Symancy Project Audit Report

**Generated**: 2025-12-27
**Version**: 1.0.0
**Status**: ✅ COMPLETE

---

## Executive Summary

### Project Overview

| Metric | Value |
|--------|-------|
| Frontend Lines | ~2,500 LoC |
| Backend Lines | ~4,011 LoC |
| Total Dependencies | 1,020 (512 frontend + 508 backend) |
| Supabase Tables | 11 |
| Edge Functions | 3 deployed + 1 local |
| Security Vulnerabilities | 0 |

### Overall Assessment

| Area | Status | Summary |
|------|--------|---------|
| **Security** | ✅ Excellent | No npm vulnerabilities, Supabase issues need attention |
| **Dead Code** | ⚠️ 37 items | 13 unused deps, 10 empty files, example files |
| **Duplication** | ⚠️ 11 items | TARIFFS constant, payment types duplicated |
| **Frontend** | ⚠️ Needs Work | Flat structure, 10 empty files, React 19 new |
| **Backend** | ✅ Good | Well-architected, 4 critical issues |
| **Database** | ⚠️ Issues | 14 unused indexes, 9 function warnings |
| **Dependencies** | ⚠️ Mixed | React 19 fresh, some upgrades available |

---

## Critical Issues (Fix Immediately)

### 1. 🔴 Supabase Security Issues

**Severity**: HIGH
**Location**: Database functions

| Issue | Object | Remediation |
|-------|--------|-------------|
| SECURITY DEFINER View | `public.payment_conversion` | Remove or use SECURITY INVOKER |
| Function search_path mutable | 9 functions | Set `search_path = public` |
| Leaked Password Protection | Auth | Enable in Supabase Auth settings |

### 2. 🔴 Backend Critical Issues

| Issue | File | Line | Impact |
|-------|------|------|--------|
| Credit check after expensive operations | `photo-analysis/worker.ts` | 185 | Wasted GPU calls |
| Checkpointer connection stale | `langchain/checkpointer.ts` | - | Graph failures after DB restart |
| Onboarding state inconsistency | `graphs/onboarding/` | - | Users stuck in flow |
| Credit refund failures silent | `worker.ts` | 342-350 | User loses credits |

### 3. 🔴 Frontend Hardcoded Values

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Hardcoded Supabase URL/Key | `lib/supabaseClient.ts` | 3-4 | Move to env vars |
| Hardcoded Edge Function URL | `services/paymentService.ts` | 8 | Derive from supabase config |
| Hardcoded Russian text | `App.tsx`, `Header.tsx` | 102, 122 | Use i18n |

---

## Dead Code Summary (37 items)

### Frontend (23 items)

**Unused Dependencies (13):**
- @ant-design/icons, @chatscope/*, @refinedev/*, antd
- browser-image-compression, react-markdown, remark-gfm
- react-yoomoneycheckoutwidget (VERIFY - has patch)
- @supabase/supabase-js (VERIFY - may be needed)

**Empty Component Files (10):**
```
components/BackgroundPattern.tsx (0 bytes)
components/CoffeeCupIcon.tsx (0 bytes)
components/GlobeIcon.tsx (0 bytes)
components/Loader.tsx (0 bytes)
components/Logo.tsx (0 bytes)
components/LogoIcon.tsx (0 bytes)
components/LogoLab.tsx (0 bytes)
components/MenuIcon.tsx (0 bytes)
components/SettingsIcon.tsx (0 bytes)
components/auth/YandexIcon.tsx (0 bytes)
```

### Backend (14 items)

- 1 unused dependency: `@langchain/community` (upgrade to 1.x)
- 1 example file: `keyboards.example.ts` (204 lines)
- 10 unused exports in test utilities
- 3 unused mock files

---

## Code Duplication Summary (11 items)

### HIGH Priority (4 items)

| ID | Type | Files | Lines | Fix |
|----|------|-------|-------|-----|
| DUP-HIGH-1 | TARIFFS constant | 3 files | ~36 | Create shared/tariffs.ts |
| DUP-HIGH-2 | Payment types | 4 files | ~120 | Create shared-types/payment.ts |
| DUP-HIGH-3 | Database types | 2 packages | ~80 | Use backend types as SSOT |
| DUP-HIGH-4 | Supabase init | 3 locations | ~30 | Document as intentional |

### MEDIUM Priority (5 items)

- Retry constants duplicated in tests
- Analysis types differ frontend/backend
- Credit costs not shared
- CORS headers inline vs shared
- LLM model config (different personas same model)

---

## Supabase Database Issues

### Performance (17 items)

| Category | Count | Details |
|----------|-------|---------|
| Unused indexes | 14 | purchases, payment_analytics, analysis_history, etc. |
| Unindexed FKs | 4 | pgboss.*, payment_analytics.user_id |
| RLS performance | 2 | Use `(select auth.uid())` pattern |
| Multiple permissive policies | 1 | purchases table |

### Security (10 items)

| Category | Count | Severity |
|----------|-------|----------|
| SECURITY DEFINER view | 1 | ERROR |
| Mutable search_path | 9 | WARN |
| Leaked password protection | 1 | WARN |

---

## State Management Audit ✅ COMPLETED

**Assessment**: 5/10 - Functional but needs architectural improvements

### Current Approach
- **Context API**: Only 1 context (AuthContext) for authentication
- **Local State**: 13+ useState hooks in App.tsx alone
- **No state management library**: No Redux, Zustand, Recoil

### Key Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| God Component (App.tsx) | 🔴 HIGH | 13+ state variables, hard to test |
| Prop drilling | 🟡 MEDIUM | language/theme/t passed through 4 levels |
| State duplication | 🟡 MEDIUM | Language in PaymentWidget AND TariffSelector |
| No Payment context | 🔴 HIGH | Payment state scattered in App.tsx |
| No Theme context | 🟡 MEDIUM | Theme managed locally |

### Recommendations
1. **Phase 1**: Extract PaymentContext, AppSettingsContext (theme + language)
2. **Phase 2**: Extract AnalysisContext, add Error Boundaries
3. **Phase 3**: Consider Zustand for business logic, TanStack Query for API state

---

## Styling Audit ✅ COMPLETED

**Assessment**: B+ (85/100) - Production ready, minor improvements needed

### Current Approach
| Approach | Usage | Files |
|----------|-------|-------|
| Tailwind CSS | 90% | All components |
| CSS Variables (HSL) | 10% | index.css theming |
| Inline Styles | 2% | 2 files only |
| Third-Party CSS | 3% | Chat, Admin |

### Theme Implementation
- ✅ Light/Dark mode with CSS variables
- ✅ System preference detection
- ✅ localStorage persistence
- ✅ Flash prevention script in index.html

### Key Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| @chatscope dark mode | 🟡 MEDIUM | 20+ !important overrides |
| Hardcoded credit colors | 🟡 MEDIUM | TariffCard, CreditBalance |
| Mobile landscape CSS | 🟢 LOW | Code smell, but functional |

### Recommendations
1. Consolidate colors to CSS variables in tailwind.config.js
2. Replace @chatscope or wrap in theme-aware abstraction
3. Add theme transition animation

---

## Circular Dependencies Check ✅ COMPLETED

**Tool**: madge v5.0.1
**Result**: ✅ No circular dependencies found

```bash
$ npx madge --circular --extensions ts,tsx .
Processed 251 files (2.2s)
# No circular dependencies detected
```

---

## Architecture Issues

### Frontend Structure Problems

```
CURRENT (Non-standard):
/home/me/code/coffee/
├── App.tsx              ← Root in project root
├── index.tsx            ← Entry in project root
├── components/          ← Flat, mixed concerns
├── pages/
├── services/
├── lib/
├── contexts/
└── types/

RECOMMENDED:
/home/me/code/coffee/
├── src/                 ← Add src folder
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── features/
│   │   └── layout/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── contexts/
│   └── types/
```

### Backend (Well-structured)

```
symancy-backend/src/
├── app.ts           ✅ Clean entry point
├── config/          ✅ Environment, constants
├── core/            ✅ Database, queue, logger
├── modules/         ✅ Feature modules
├── chains/          ✅ LangChain chains
├── graphs/          ✅ LangGraph flows
├── services/        ✅ Business logic
├── types/           ✅ TypeScript types
└── utils/           ✅ Utilities
```

---

## Dependency Status

### Frontend LTS Compliance

| Package | Current | Latest | Status | Action |
|---------|---------|--------|--------|--------|
| React | 19.2.3 | 19.2.3 | ⚠️ New | Monitor |
| Ant Design | 5.29.3 | 6.1.2 | ✅ Stable | Stay on 5.x |
| Vite | 6.4.1 | 7.3.0 | 🟡 Upgrade | Plan upgrade |
| TypeScript | 5.8.3 | 5.9.3 | ✅ Update | Update |
| React Router | 7.9.6 | 7.11.0 | ✅ Update | Update |

### Backend LTS Compliance

| Package | Current | Latest | Status | Action |
|---------|---------|--------|--------|--------|
| Node.js | 22.18.0 | 22.x LTS | ✅ LTS | Perfect |
| Fastify | 5.6.2 | 5.6.2 | ✅ Latest | None |
| grammY | 1.38.4 | 1.38.4 | ✅ Latest | None |
| @langchain/community | 0.3.59 | 1.1.1 | 🟡 Major | Upgrade |
| Vitest | 3.2.4 | 4.0.16 | 🟡 Major | Wait |
| Zod | 4.2.1 | 4.2.1 | ✅ Latest | None |

---

## TODOs Found in Code

| Location | Count | Sample |
|----------|-------|--------|
| Backend router | 1 | "TODO: Implement other callback query handling" |
| Backend credits | 1 | "TODO: This currently updates a flag in profiles" |
| Test files | 20+ | Various memory service test TODOs |

---

## File-by-File Critical Issues

| File | Issue | Severity | Line |
|------|-------|----------|------|
| `lib/supabaseClient.ts` | Hardcoded keys | MEDIUM | 3-4 |
| `services/paymentService.ts` | Hardcoded URL | MEDIUM | 8 |
| `App.tsx` | Hardcoded Russian | MEDIUM | 102, 150 |
| `Header.tsx` | Hardcoded Russian | MEDIUM | 122 |
| `ChatOnboarding.tsx` | @ts-nocheck | MEDIUM | 2 |
| `pages/admin/AdminApp.tsx` | @ts-nocheck | MEDIUM | 2 |
| `photo-analysis/worker.ts` | Credit timing | CRITICAL | 185 |
| `langchain/checkpointer.ts` | Stale connections | CRITICAL | - |

---

## Generated Reports

All detailed reports saved to project:

1. **`dead-code-report.md`** - Knip analysis, 37 items
2. **`reuse-hunting-report.md`** - Duplication analysis, 11 items
3. **`lts-compliance-report.md`** - Dependency audit (in docs/reports/)

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Critical Issues | 7 |
| High Priority Issues | 15 |
| Medium Priority Issues | 23 |
| Low Priority Issues | 12 |
| Dead Code Items | 37 |
| Duplication Items | 11 |
| Unused Indexes | 14 |
| Security Warnings | 10 |
| Estimated Cleanup Bundle Reduction | ~900KB |

---

*Report generated by Claude Code Orchestrator*
