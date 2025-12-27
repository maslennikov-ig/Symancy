# Migration Tasks

**Generated**: 2025-12-27
**Version**: 1.0.0
**Status**: READY FOR EXECUTION

---

## Overview

Prioritized task list for project restructuring and audit completion. Tasks are ordered by priority and dependency.

**Legend**:
- 🔴 CRITICAL - Must be done first
- 🟠 HIGH - Important, do after critical
- 🟡 MEDIUM - Nice to have, do when time permits
- 🟢 LOW - Optional improvements

---

## Phase 0: Pre-Migration Verification

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-0.1 | Create backup branch `backup/pre-restructure` | 🔴 | [ ] | MAIN |
| M-0.2 | Verify all tests pass before changes | 🔴 | [ ] | MAIN |
| M-0.3 | Run `pnpm build` to verify current state | 🔴 | [ ] | MAIN |

---

## Phase 1: Frontend Restructuring (src/)

### 1.1 Create Directory Structure

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-1.1.1 | Create `src/` directory | 🔴 | [ ] | MAIN |
| M-1.1.2 | Create `src/components/ui/` | 🔴 | [ ] | MAIN |
| M-1.1.3 | Create `src/components/layout/` | 🔴 | [ ] | MAIN |
| M-1.1.4 | Create `src/components/features/` | 🔴 | [ ] | MAIN |
| M-1.1.5 | Create `src/components/icons/` | 🔴 | [ ] | MAIN |
| M-1.1.6 | Create `src/hooks/` | 🔴 | [ ] | MAIN |

### 1.2 Move Core Files

| ID | Task | Priority | Status | Executor | Source | Destination |
|----|------|----------|--------|----------|--------|-------------|
| M-1.2.1 | Move entry point | 🔴 | [ ] | MAIN | `index.tsx` | `src/main.tsx` |
| M-1.2.2 | Move App component | 🔴 | [ ] | MAIN | `App.tsx` | `src/App.tsx` |
| M-1.2.3 | Move global styles | 🔴 | [ ] | MAIN | `index.css` | `src/index.css` |

### 1.3 Move Directories

| ID | Task | Priority | Status | Executor | Source | Destination |
|----|------|----------|--------|----------|--------|-------------|
| M-1.3.1 | Move services | 🔴 | [ ] | MAIN | `services/` | `src/services/` |
| M-1.3.2 | Move lib | 🔴 | [ ] | MAIN | `lib/` | `src/lib/` |
| M-1.3.3 | Move contexts | 🔴 | [ ] | MAIN | `contexts/` | `src/contexts/` |
| M-1.3.4 | Move types | 🔴 | [ ] | MAIN | `types/` | `src/types/` |
| M-1.3.5 | Move pages | 🔴 | [ ] | MAIN | `pages/` | `src/pages/` |

### 1.4 Reorganize Components

| ID | Task | Priority | Status | Executor | Source | Destination |
|----|------|----------|--------|----------|--------|-------------|
| M-1.4.1 | Move Header | 🟠 | [ ] | MAIN | `components/Header.tsx` | `src/components/layout/Header.tsx` |
| M-1.4.2 | Move auth components | 🟠 | [ ] | MAIN | `components/auth/` | `src/components/features/auth/` |
| M-1.4.3 | Move payment components | 🟠 | [ ] | MAIN | `components/payment/` | `src/components/features/payment/` |
| M-1.4.4 | Move UI components | 🟠 | [ ] | MAIN | `components/ui/` | `src/components/ui/` |
| M-1.4.5 | Move icon components | 🟠 | [ ] | MAIN | `components/*Icon.tsx` | `src/components/icons/` |
| M-1.4.6 | Move other components | 🟠 | [ ] | MAIN | `components/*.tsx` | `src/components/features/` |

### 1.5 Update Configuration

| ID | Task | Priority | Status | Executor | File |
|----|------|----------|--------|----------|------|
| M-1.5.1 | Update vite.config.ts (paths) | 🔴 | [ ] | MAIN | `vite.config.ts` |
| M-1.5.2 | Update tsconfig.json (include, paths) | 🔴 | [ ] | MAIN | `tsconfig.json` |
| M-1.5.3 | Update index.html (script src) | 🔴 | [ ] | MAIN | `index.html` |
| M-1.5.4 | Update knip.json (entry, project) | 🟠 | [ ] | MAIN | `knip.json` |

### 1.6 Fix Imports

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-1.6.1 | Update all relative imports in moved files | 🔴 | [ ] | react-vite-specialist |
| M-1.6.2 | Verify no broken imports | 🔴 | [ ] | MAIN |
| M-1.6.3 | Run `pnpm build` to verify | 🔴 | [ ] | MAIN |

---

## Phase 2: Documentation Reorganization

### 2.1 Create Documentation Structure

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-2.1.1 | Create `docs/architecture/` | 🟠 | [ ] | MAIN |
| M-2.1.2 | Create `docs/api/` | 🟠 | [ ] | MAIN |
| M-2.1.3 | Create `docs/guides/` | 🟠 | [ ] | MAIN |
| M-2.1.4 | Create `docs/reports/audit/2025-12/` | 🟠 | [ ] | MAIN |
| M-2.1.5 | Create `docs/research/` | 🟠 | [ ] | MAIN |
| M-2.1.6 | Create `docs/legal/` | 🟠 | [ ] | MAIN |
| M-2.1.7 | Create `docs/internal/` | 🟠 | [ ] | MAIN |

### 2.2 Move Architecture Docs

| ID | Task | Priority | Status | Source | Destination |
|----|------|----------|--------|--------|-------------|
| M-2.2.1 | Move TECHNICAL_DESIGN.md | 🟠 | [ ] | `docs/` | `docs/architecture/` |
| M-2.2.2 | Move MASTER_SPECIFICATION.md | 🟠 | [ ] | `docs/` | `docs/architecture/` |
| M-2.2.3 | Move BACKEND_MIGRATION_SPEC.md | 🟠 | [ ] | `docs/` | `docs/architecture/` |
| M-2.2.4 | Move ADMIN_PANEL_SPEC.md | 🟠 | [ ] | `docs/` | `docs/architecture/` |

### 2.3 Move Guide Docs

| ID | Task | Priority | Status | Source | Destination |
|----|------|----------|--------|--------|-------------|
| M-2.3.1 | Move PROVIDER_SETUP.md | 🟠 | [ ] | `docs/` | `docs/guides/` |
| M-2.3.2 | Move PAYMENT-TESTING-GUIDE.md | 🟠 | [ ] | `docs/` | `docs/guides/` |
| M-2.3.3 | Move TESTING-GUIDE-v0.4.1.md | 🟠 | [ ] | `docs/` | `docs/guides/` |
| M-2.3.4 | Move BOTFATHER-SETUP.md | 🟠 | [ ] | `docs/` | `docs/guides/` |

### 2.4 Move Reports

| ID | Task | Priority | Status | Source | Destination |
|----|------|----------|--------|--------|-------------|
| M-2.4.1 | Move dead-code-report.md | 🟠 | [ ] | root | `docs/reports/audit/2025-12/` |
| M-2.4.2 | Move reuse-hunting-report.md | 🟠 | [ ] | root | `docs/reports/audit/2025-12/` |
| M-2.4.3 | Move audit-report.md | 🟠 | [ ] | `.tmp/current/` | `docs/reports/audit/2025-12/` |
| M-2.4.4 | Copy lts-compliance-report.md | 🟠 | [ ] | `symancy-backend/docs/` | `docs/reports/audit/2025-12/` |

### 2.5 Move Research Docs

| ID | Task | Priority | Status | Source | Destination |
|----|------|----------|--------|--------|-------------|
| M-2.5.1 | Move DeepResearch/ | 🟡 | [ ] | `docs/DeepResearch/` | `docs/research/DeepResearch/` |
| M-2.5.2 | Move DeepThink/ | 🟡 | [ ] | `docs/DeepThink/` | `docs/research/DeepThink/` |

### 2.6 Move Specs

| ID | Task | Priority | Status | Source | Destination |
|----|------|----------|--------|--------|-------------|
| M-2.6.1 | Move specs/ to docs/ | 🟡 | [ ] | `specs/` | `docs/specs/` |

### 2.7 Create Index Files

| ID | Task | Priority | Status | File |
|----|------|----------|--------|------|
| M-2.7.1 | Update docs/README.md with new structure | 🟠 | [ ] | `docs/README.md` |

---

## Phase 3: Dead Code Cleanup

### 3.1 Delete Empty Files

| ID | Task | Priority | Status | File |
|----|------|----------|--------|------|
| M-3.1.1 | Delete BackgroundPattern.tsx | 🟠 | [ ] | `components/BackgroundPattern.tsx` |
| M-3.1.2 | Delete CoffeeCupIcon.tsx | 🟠 | [ ] | `components/CoffeeCupIcon.tsx` |
| M-3.1.3 | Delete GlobeIcon.tsx | 🟠 | [ ] | `components/GlobeIcon.tsx` |
| M-3.1.4 | Delete Loader.tsx | 🟠 | [ ] | `components/Loader.tsx` |
| M-3.1.5 | Delete Logo.tsx | 🟠 | [ ] | `components/Logo.tsx` |
| M-3.1.6 | Delete LogoIcon.tsx | 🟠 | [ ] | `components/LogoIcon.tsx` |
| M-3.1.7 | Delete LogoLab.tsx | 🟠 | [ ] | `components/LogoLab.tsx` |
| M-3.1.8 | Delete MenuIcon.tsx | 🟠 | [ ] | `components/MenuIcon.tsx` |
| M-3.1.9 | Delete SettingsIcon.tsx | 🟠 | [ ] | `components/SettingsIcon.tsx` |
| M-3.1.10 | Delete YandexIcon.tsx | 🟠 | [ ] | `components/auth/YandexIcon.tsx` |

### 3.2 Remove Unused Dependencies

| ID | Task | Priority | Status | Package |
|----|------|----------|--------|---------|
| M-3.2.1 | Remove @ant-design/icons | 🟠 | [ ] | frontend |
| M-3.2.2 | Remove @chatscope/chat-ui-kit-react | 🟠 | [ ] | frontend |
| M-3.2.3 | Remove @chatscope/chat-ui-kit-styles | 🟠 | [ ] | frontend |
| M-3.2.4 | Remove @refinedev/antd | 🟠 | [ ] | frontend |
| M-3.2.5 | Remove @refinedev/core | 🟠 | [ ] | frontend |
| M-3.2.6 | Remove @refinedev/react-router | 🟠 | [ ] | frontend |
| M-3.2.7 | Remove @refinedev/supabase | 🟠 | [ ] | frontend |
| M-3.2.8 | Remove antd | 🟠 | [ ] | frontend |
| M-3.2.9 | Remove browser-image-compression | 🟠 | [ ] | frontend |
| M-3.2.10 | Remove react-markdown | 🟠 | [ ] | frontend |
| M-3.2.11 | Remove remark-gfm | 🟠 | [ ] | frontend |

### 3.3 Review Before Removal (MANUAL)

| ID | Task | Priority | Status | Package | Reason |
|----|------|----------|--------|---------|--------|
| M-3.3.1 | Review @supabase/supabase-js | 🟡 | [ ] | frontend | May be needed for client |
| M-3.3.2 | Review react-yoomoneycheckoutwidget | 🟡 | [ ] | frontend | Has patchedDependency |
| M-3.3.3 | Review @langchain/community | 🟡 | [ ] | backend | May need integrations |

---

## Phase 4: Audit Completion

### 4.1 State Management Audit

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-4.1.1 | Document current state management approach | 🟡 | [ ] | Explore agent |
| M-4.1.2 | Identify global vs local state usage | 🟡 | [ ] | Explore agent |
| M-4.1.3 | Check for prop drilling issues | 🟡 | [ ] | Explore agent |
| M-4.1.4 | Review context providers | 🟡 | [ ] | Explore agent |

### 4.2 Styling Audit

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-4.2.1 | List styling approaches used | 🟡 | [ ] | Explore agent |
| M-4.2.2 | Check for inconsistent patterns | 🟡 | [ ] | Explore agent |
| M-4.2.3 | Identify unused CSS/styles | 🟡 | [ ] | Explore agent |
| M-4.2.4 | Review theme implementation | 🟡 | [ ] | Explore agent |

### 4.3 Circular Dependencies Check

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-4.3.1 | Install madge if needed | 🟡 | [ ] | MAIN |
| M-4.3.2 | Run madge on frontend | 🟡 | [ ] | MAIN |
| M-4.3.3 | Run madge on backend | 🟡 | [ ] | MAIN |
| M-4.3.4 | Document findings | 🟡 | [ ] | MAIN |

---

## Phase 5: Post-Migration Verification

| ID | Task | Priority | Status | Executor |
|----|------|----------|--------|----------|
| M-5.1 | Run `pnpm install` | 🔴 | [ ] | MAIN |
| M-5.2 | Run `pnpm build` frontend | 🔴 | [ ] | MAIN |
| M-5.3 | Run `pnpm build` backend | 🔴 | [ ] | MAIN |
| M-5.4 | Run `pnpm type-check` | 🔴 | [ ] | MAIN |
| M-5.5 | Run frontend tests | 🔴 | [ ] | MAIN |
| M-5.6 | Run backend tests | 🔴 | [ ] | MAIN |
| M-5.7 | Test dev server | 🔴 | [ ] | MAIN |
| M-5.8 | Verify all imports resolve | 🔴 | [ ] | MAIN |
| M-5.9 | Update CLAUDE.md if needed | 🟠 | [ ] | MAIN |
| M-5.10 | Commit changes | 🔴 | [ ] | MAIN |

---

## Execution Order

```
Phase 0 (Pre-Migration)
    ↓
Phase 1.1-1.3 (Create dirs, move core files)
    ↓
Phase 1.5 (Update config)
    ↓
Phase 1.4 (Reorganize components)
    ↓
Phase 1.6 (Fix imports)
    ↓
Phase 3.1 (Delete empty files) - can run parallel with Phase 1.6
    ↓
Phase 5.1-5.4 (Verify build)
    ↓
Phase 3.2 (Remove deps)
    ↓
Phase 5.5-5.8 (Final verification)
    ↓
Phase 2 (Docs reorganization) - can run parallel
    ↓
Phase 4 (Audit completion) - can run parallel
    ↓
Phase 5.9-5.10 (Commit)
```

---

## Risk Mitigation

1. **Always use `git mv`** for moves to preserve history
2. **Run build after each phase** to catch issues early
3. **Keep backup branch** for rollback
4. **Commit after each major phase** with descriptive messages

---

## Commands Quick Reference

```bash
# Create backup
git checkout -b backup/pre-restructure
git checkout main

# Create directories
mkdir -p src/{components/{ui,layout,features/{auth,payment},icons},services,lib,contexts,hooks,types,pages}

# Move with git (example)
git mv index.tsx src/main.tsx
git mv App.tsx src/App.tsx
git mv index.css src/index.css
git mv components/* src/components/
git mv services src/
git mv lib src/
git mv contexts src/
git mv types src/
git mv pages src/

# Remove unused deps
pnpm remove @ant-design/icons @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles @refinedev/antd @refinedev/core @refinedev/react-router @refinedev/supabase antd browser-image-compression react-markdown remark-gfm

# Delete empty files
rm src/components/BackgroundPattern.tsx src/components/CoffeeCupIcon.tsx ...

# Verify
pnpm install
pnpm build
pnpm type-check
```

---

*Document generated as part of Project Audit Phase 5.2*
