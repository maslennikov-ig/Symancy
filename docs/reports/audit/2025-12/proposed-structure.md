# Proposed Project Structure

**Generated**: 2025-12-27
**Version**: 1.0.0
**Status**: PROPOSED

---

## Executive Summary

This document proposes a reorganized project structure for Symancy to improve maintainability, scalability, and developer experience. The current structure has frontend files scattered in the project root, making it difficult to navigate and maintain.

---

## Current Structure (Problems)

```
/home/me/code/coffee/
├── App.tsx                    ❌ Root level (should be in src/)
├── index.tsx                  ❌ Root level (should be in src/)
├── index.css                  ❌ Root level (should be in src/)
├── vite.config.ts             ✅ OK (build config)
├── components/                ❌ Root level (should be in src/)
├── pages/                     ❌ Root level (should be in src/)
├── services/                  ❌ Root level (should be in src/)
├── lib/                       ❌ Root level (should be in src/)
├── contexts/                  ❌ Root level (should be in src/)
├── types/                     ❌ Root level (should be in src/)
├── symancy-backend/           ✅ OK (separate package)
├── docs/                      ⚠️  Mixed content, needs organization
├── .claude/                   ✅ OK (Claude Code config)
├── .tmp/                      ✅ OK (temporary files)
├── specs/                     ⚠️  Could move to docs/specs/
├── supabase/                  ✅ OK (Supabase config)
├── n8n/                       ✅ OK (n8n workflows)
├── mcp/                       ✅ OK (MCP config)
├── .github/                   ✅ OK (GitHub workflows)
├── patches/                   ✅ OK (pnpm patches)
├── dead-code-report.md        ⚠️  Should be in docs/reports/
├── reuse-hunting-report.md    ⚠️  Should be in docs/reports/
└── [20+ other root files]     ⚠️  Cluttered root
```

### Key Problems

1. **Frontend code in root**: App.tsx, index.tsx, components/, pages/, etc. are in project root
2. **No src/ directory**: Standard React/Vite projects use src/
3. **Scattered documentation**: MD files in root, docs/, symancy-backend/docs/, .tmp/
4. **Reports in wrong locations**: dead-code-report.md, reuse-hunting-report.md in root
5. **Mixed concerns in docs/**: Technical specs, user docs, legal docs all mixed

---

## Proposed Structure

```
/home/me/code/coffee/
│
├── src/                           # Frontend (React + Vite)
│   ├── main.tsx                   # Entry point (renamed from index.tsx)
│   ├── App.tsx                    # Root component
│   ├── index.css                  # Global styles
│   │
│   ├── components/                # React components
│   │   ├── ui/                    # Base UI components (buttons, inputs)
│   │   ├── layout/                # Layout components (Header, Footer)
│   │   ├── features/              # Feature-specific components
│   │   │   ├── auth/              # Auth components
│   │   │   ├── payment/           # Payment components
│   │   │   ├── history/           # History components
│   │   │   └── analysis/          # Analysis components
│   │   └── icons/                 # Icon components
│   │
│   ├── pages/                     # Page components
│   │   ├── admin/                 # Admin pages
│   │   └── ...
│   │
│   ├── services/                  # API services
│   │   ├── analysisService.ts
│   │   ├── paymentService.ts
│   │   └── ...
│   │
│   ├── lib/                       # Utilities and config
│   │   ├── supabaseClient.ts
│   │   ├── i18n.ts
│   │   └── utils.ts
│   │
│   ├── contexts/                  # React contexts
│   │   └── AuthContext.tsx
│   │
│   ├── hooks/                     # Custom React hooks (NEW)
│   │   └── useAuth.ts
│   │
│   └── types/                     # TypeScript types
│       ├── payment.ts
│       └── index.ts
│
├── symancy-backend/               # Backend (Node.js + Fastify)
│   └── ... (unchanged)
│
├── docs/                          # Documentation (REORGANIZED)
│   ├── README.md                  # Docs index
│   │
│   ├── architecture/              # Technical architecture
│   │   ├── TECHNICAL_DESIGN.md
│   │   ├── MASTER_SPECIFICATION.md
│   │   └── BACKEND_MIGRATION_SPEC.md
│   │
│   ├── api/                       # API documentation
│   │   ├── SERVICES.md
│   │   └── yookassa-openapi-specification.yaml
│   │
│   ├── guides/                    # How-to guides
│   │   ├── PROVIDER_SETUP.md
│   │   ├── PAYMENT-TESTING-GUIDE.md
│   │   ├── TESTING-GUIDE-v0.4.1.md
│   │   └── BOTFATHER-SETUP.md
│   │
│   ├── specs/                     # Project specifications
│   │   ├── 001-landing-n8n-improvements/
│   │   ├── 002-pre-mvp-payments/
│   │   └── 003-backend-migration/
│   │
│   ├── research/                  # Research documents
│   │   ├── DeepResearch/
│   │   └── DeepThink/
│   │
│   ├── reports/                   # Generated reports
│   │   ├── audit/                 # Audit reports
│   │   │   ├── 2025-12/
│   │   │   │   ├── audit-report.md
│   │   │   │   ├── dead-code-report.md
│   │   │   │   ├── reuse-hunting-report.md
│   │   │   │   └── lts-compliance-report.md
│   │   │   └── ...
│   │   └── code-review/
│   │
│   ├── legal/                     # Legal documents
│   │   └── PRIVACY_POLICY.md
│   │
│   ├── internal/                  # Internal docs (Russian)
│   │   ├── client-feedback-analysis-ru.md
│   │   ├── TZ_*.md
│   │   └── ...
│   │
│   └── agents/                    # Agent ecosystem docs
│       ├── AGENT-ORCHESTRATION.md
│       ├── ARCHITECTURE.md
│       └── ...
│
├── .claude/                       # Claude Code configuration
│   ├── agents/
│   ├── commands/
│   ├── skills/
│   └── ...
│
├── supabase/                      # Supabase configuration
│   ├── functions/
│   └── migrations/
│
├── n8n/                           # n8n workflows
│
├── mcp/                           # MCP configuration
│
├── .github/                       # GitHub configuration
│   └── workflows/
│
├── patches/                       # pnpm patches
│
├── .tmp/                          # Temporary files (gitignored)
│   └── current/
│
├── dist/                          # Build output (gitignored)
│
├── node_modules/                  # Dependencies (gitignored)
│
├── package.json                   # Root package config
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── knip.json
├── CLAUDE.md                      # Claude instructions
├── README.md                      # Project README
├── CHANGELOG.md                   # Changelog
└── RELEASE_NOTES.md               # Release notes
```

---

## Migration Steps

### Phase 1: Create src/ structure (LOW RISK)

1. Create `src/` directory
2. Move frontend files:
   - `index.tsx` → `src/main.tsx` (rename)
   - `App.tsx` → `src/App.tsx`
   - `index.css` → `src/index.css`
   - `components/` → `src/components/`
   - `pages/` → `src/pages/`
   - `services/` → `src/services/`
   - `lib/` → `src/lib/`
   - `contexts/` → `src/contexts/`
   - `types/` → `src/types/`

3. Update `vite.config.ts`:
   ```ts
   export default defineConfig({
     root: '.',
     build: {
       outDir: 'dist',
     },
     // Entry point will be index.html which references src/main.tsx
   })
   ```

4. Update `index.html`:
   ```html
   <script type="module" src="/src/main.tsx"></script>
   ```

5. Update `tsconfig.json`:
   ```json
   {
     "include": ["src/**/*"],
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     }
   }
   ```

### Phase 2: Reorganize components (LOW RISK)

1. Create subdirectories in `src/components/`:
   - `ui/` - ChevronDownIcon, LoaderIcon, ThemeToggle
   - `layout/` - Header
   - `features/auth/` - from `auth/`
   - `features/payment/` - from `payment/`
   - `icons/` - All icon components

2. Update imports across the codebase

### Phase 3: Reorganize documentation (LOW RISK)

1. Create new docs structure
2. Move files to appropriate locations
3. Update any internal links

### Phase 4: Cleanup (SAFE)

1. Delete empty component files
2. Remove unused dependencies
3. Move reports to `docs/reports/`

---

## Configuration Updates Required

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### knip.json

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx", "vite.config.ts"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["**/*.d.ts", "dist/**"]
}
```

---

## Benefits of New Structure

| Aspect | Before | After |
|--------|--------|-------|
| **Navigation** | Files scattered in root | Clear src/ structure |
| **Discoverability** | Hard to find components | Organized by feature |
| **Documentation** | Mixed, scattered | Categorized by type |
| **Onboarding** | Confusing for new devs | Standard React/Vite layout |
| **IDE Support** | Path aliases broken | Proper @ imports |
| **Build** | Works | Works (no change) |
| **Scaling** | Difficult | Easy to add features |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Import paths break | HIGH | MEDIUM | Update all imports, verify build |
| Vite config issues | LOW | HIGH | Test dev server after changes |
| CI/CD breaks | LOW | MEDIUM | Update workflow paths |
| Git history loss | NONE | N/A | Use git mv for moves |

---

## Rollback Plan

If issues occur:
1. All changes are file moves (no code changes)
2. Git history preserved with `git mv`
3. Can revert with `git revert` if needed
4. Keep backup branch before migration

---

## Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Phase 1: src/ structure | ~15 files | 30 min |
| Phase 2: Component reorg | ~25 files | 45 min |
| Phase 3: Docs reorg | ~60 files | 60 min |
| Phase 4: Cleanup | ~15 files | 20 min |
| **Total** | **~115 files** | **~2.5 hours** |

---

*Document generated as part of Project Audit Phase 5.1*
