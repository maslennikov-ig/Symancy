# Cleanup Checklist

**Generated**: 2025-12-27
**Version**: 1.0.0
**Status**: READY FOR EXECUTION

---

## Quick Actions (Can Execute Now)

### 1. Delete Empty Component Files (10 files, ~0 bytes)

```bash
cd /home/me/code/coffee

# Delete all empty component files
rm components/BackgroundPattern.tsx
rm components/CoffeeCupIcon.tsx
rm components/GlobeIcon.tsx
rm components/Loader.tsx
rm components/Logo.tsx
rm components/LogoIcon.tsx
rm components/LogoLab.tsx
rm components/MenuIcon.tsx
rm components/SettingsIcon.tsx
rm components/auth/YandexIcon.tsx
```

**Verification**:
```bash
# Should show no results (files deleted)
find components -size 0 -name "*.tsx"
```

---

### 2. Remove Unused Frontend Dependencies (11 packages)

```bash
cd /home/me/code/coffee

# Remove all confirmed unused dependencies in one command
pnpm remove \
  @ant-design/icons \
  @chatscope/chat-ui-kit-react \
  @chatscope/chat-ui-kit-styles \
  @refinedev/antd \
  @refinedev/core \
  @refinedev/react-router \
  @refinedev/supabase \
  antd \
  browser-image-compression \
  react-markdown \
  remark-gfm
```

**Verification**:
```bash
# Should build without errors
pnpm build
```

**Estimated bundle reduction**: ~900KB

---

### 3. Move Reports to Proper Location

```bash
cd /home/me/code/coffee

# Create reports directory
mkdir -p docs/reports/audit/2025-12

# Move audit reports
mv dead-code-report.md docs/reports/audit/2025-12/
mv reuse-hunting-report.md docs/reports/audit/2025-12/
cp .tmp/current/audit-report.md docs/reports/audit/2025-12/

# Copy backend LTS report
cp symancy-backend/docs/reports/dependencies/2025-12/lts-compliance-report.md docs/reports/audit/2025-12/
```

**Verification**:
```bash
ls -la docs/reports/audit/2025-12/
# Should show: audit-report.md, dead-code-report.md, reuse-hunting-report.md, lts-compliance-report.md
```

---

## Review Before Action (Manual Verification Required)

### 4. Frontend Dependencies Requiring Review

| Package | Reason to Review | Action |
|---------|-----------------|--------|
| `@supabase/supabase-js` | Frontend may need direct Supabase access | Check if used in services/ |
| `react-yoomoneycheckoutwidget` | Has patchedDependency in pnpm config | Check if payment feature is active |

**How to verify**:
```bash
# Check if @supabase/supabase-js is imported
grep -r "@supabase/supabase-js" --include="*.ts" --include="*.tsx" .

# Check if react-yoomoneycheckoutwidget is imported
grep -r "react-yoomoneycheckoutwidget" --include="*.ts" --include="*.tsx" .
```

---

### 5. Backend Dependencies Requiring Review

| Package | Reason to Review | Action |
|---------|-----------------|--------|
| `@langchain/community` | May need community integrations | Check imports in chains/ |

**How to verify**:
```bash
cd symancy-backend
grep -r "@langchain/community" --include="*.ts" src/
```

---

## Backend Cleanup (After Review)

### 6. Remove Unused Mock Files (Low Priority)

**Files to review**:
- `symancy-backend/tests/setup/mocks/openrouter.mock.ts`
- `symancy-backend/tests/setup/mocks/supabase.mock.ts`
- `symancy-backend/tests/setup/mocks/telegram.mock.ts`

**Check if needed**:
```bash
cd symancy-backend
grep -r "openrouter.mock" tests/
grep -r "supabase.mock" tests/
grep -r "telegram.mock" tests/
```

If no results, safe to delete:
```bash
rm tests/setup/mocks/openrouter.mock.ts
rm tests/setup/mocks/supabase.mock.ts
rm tests/setup/mocks/telegram.mock.ts
```

---

### 7. Handle Example File

**File**: `symancy-backend/src/modules/onboarding/keyboards.example.ts` (204 lines)

**Options**:
1. Delete if examples are already documented
2. Move to docs if useful as reference

```bash
# Option 1: Delete
rm symancy-backend/src/modules/onboarding/keyboards.example.ts

# Option 2: Move to docs
mv symancy-backend/src/modules/onboarding/keyboards.example.ts docs/examples/onboarding-keyboards.ts
```

---

### 8. Clean Unused Test Exports (Low Priority)

**Files with unused exports**:
- `symancy-backend/tests/setup/test-scenarios.ts`
- `symancy-backend/tests/setup/test-constants.ts`
- `symancy-backend/tests/setup/memory-test-helpers.ts`

**Action**: Review if these are new utilities to be integrated or old utilities to be removed.

---

## Documentation Cleanup

### 9. Remove Duplicate Docs

Check for duplicates:
```bash
# These appear to be duplicates
ls -la docs/TECHNICAL-DEBT.md docs/TECHNICAL_DEBT.md
```

If duplicates, keep one:
```bash
# Compare content
diff docs/TECHNICAL-DEBT.md docs/TECHNICAL_DEBT.md

# Keep the newer one, delete older
rm docs/TECHNICAL_DEBT.md  # (older, underscores)
```

---

### 10. Clean .tmp Directory (Optional)

Keep only current work, remove old:
```bash
# Remove old mem0-spike if not needed
rm -rf .tmp/mem0-spike

# Keep current work
ls .tmp/current/
```

---

## Full Cleanup Script

**CAUTION**: Run individual sections first, verify, then commit.

```bash
#!/bin/bash
set -e

echo "=== Symancy Cleanup Script ==="
echo "Run sections individually first!"
echo ""

# === SECTION 1: Delete Empty Components ===
echo "Deleting empty component files..."
rm -f components/BackgroundPattern.tsx
rm -f components/CoffeeCupIcon.tsx
rm -f components/GlobeIcon.tsx
rm -f components/Loader.tsx
rm -f components/Logo.tsx
rm -f components/LogoIcon.tsx
rm -f components/LogoLab.tsx
rm -f components/MenuIcon.tsx
rm -f components/SettingsIcon.tsx
rm -f components/auth/YandexIcon.tsx
echo "Done: Empty files deleted"

# === SECTION 2: Remove Unused Deps ===
echo "Removing unused dependencies..."
pnpm remove \
  @ant-design/icons \
  @chatscope/chat-ui-kit-react \
  @chatscope/chat-ui-kit-styles \
  @refinedev/antd \
  @refinedev/core \
  @refinedev/react-router \
  @refinedev/supabase \
  antd \
  browser-image-compression \
  react-markdown \
  remark-gfm
echo "Done: Dependencies removed"

# === SECTION 3: Organize Reports ===
echo "Organizing reports..."
mkdir -p docs/reports/audit/2025-12
mv dead-code-report.md docs/reports/audit/2025-12/ 2>/dev/null || true
mv reuse-hunting-report.md docs/reports/audit/2025-12/ 2>/dev/null || true
cp .tmp/current/audit-report.md docs/reports/audit/2025-12/ 2>/dev/null || true
cp symancy-backend/docs/reports/dependencies/2025-12/lts-compliance-report.md docs/reports/audit/2025-12/ 2>/dev/null || true
echo "Done: Reports organized"

# === VERIFICATION ===
echo ""
echo "=== Verification ==="
pnpm install
pnpm build
echo ""
echo "If build passed, cleanup complete!"
```

---

## Post-Cleanup Verification Checklist

- [ ] `pnpm install` runs without errors
- [ ] `pnpm build` runs without errors
- [ ] `pnpm type-check` passes
- [ ] Dev server starts (`pnpm dev`)
- [ ] No TypeScript errors in IDE
- [ ] All components render correctly
- [ ] Payment flow still works (if applicable)

---

## Git Commit Template

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: cleanup dead code and unused dependencies

- Remove 10 empty component placeholder files
- Remove 11 unused frontend dependencies (~900KB reduction)
- Organize audit reports to docs/reports/audit/2025-12/

Packages removed:
- @ant-design/icons, antd
- @chatscope/chat-ui-kit-react, @chatscope/chat-ui-kit-styles
- @refinedev/antd, @refinedev/core, @refinedev/react-router, @refinedev/supabase
- browser-image-compression, react-markdown, remark-gfm

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Category | Items | Impact |
|----------|-------|--------|
| Empty files to delete | 10 | Cleaner codebase |
| Unused deps to remove | 11 | ~900KB bundle reduction |
| Reports to organize | 4 | Better documentation |
| Files requiring review | 6 | Manual verification needed |

**Total cleanup time**: ~15 minutes (excluding reviews)

---

*Document generated as part of Project Audit Phase 5.3*
