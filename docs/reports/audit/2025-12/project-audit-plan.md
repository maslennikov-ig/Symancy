# Project Structure Audit Plan

## Objective
Analyze the Symancy project structure, identify issues, outdated components, and propose a unified architecture following best practices.

---

## Phase 1: Current State Analysis

### 1.1 Directory Structure Mapping
- [ ] Document current folder structure for all packages
- [ ] Identify frontend locations (scattered components)
- [ ] Identify backend location (`symancy-backend/`)
- [ ] Map shared code and dependencies
- [ ] List all package.json files and their purposes

### 1.2 Technology Stack Inventory
- [ ] List all frameworks and their versions
- [ ] Identify React version and related packages
- [ ] Check Node.js/TypeScript versions across packages
- [ ] Document database and external service integrations
- [ ] List build tools (Vite, TSC, etc.)

### 1.3 Dependency Analysis
- [ ] Run `pnpm outdated` on all packages
- [ ] Identify deprecated packages
- [ ] Check for duplicate dependencies across packages
- [ ] Identify security vulnerabilities (`pnpm audit`)
- [ ] Document peer dependency conflicts

---

## Phase 2: Code Quality Assessment

### 2.1 Dead Code Detection
- [ ] Run Knip or similar tool for unused exports
- [ ] Identify unused files and components
- [ ] Find commented-out code blocks
- [ ] Detect unreachable code paths

### 2.2 Duplication Analysis
- [ ] Identify duplicated types/interfaces
- [ ] Find duplicated utility functions
- [ ] Check for duplicated Zod schemas
- [ ] Locate duplicated constants

### 2.3 Architecture Review
- [ ] Evaluate module boundaries
- [ ] Check for circular dependencies
- [ ] Review import patterns
- [ ] Assess code organization within modules

---

## Phase 3: Frontend Audit

### 3.1 Component Structure
- [ ] Map all React components and their locations
- [ ] Identify orphaned/unused components
- [ ] Check component naming conventions
- [ ] Review component hierarchy

### 3.2 State Management
- [ ] Document current state management approach
- [ ] Identify global vs local state usage
- [ ] Check for prop drilling issues
- [ ] Review context providers

### 3.3 Styling Audit
- [ ] List styling approaches used (CSS, Tailwind, inline, etc.)
- [ ] Check for inconsistent styling patterns
- [ ] Identify unused CSS/styles
- [ ] Review theme implementation

---

## Phase 4: Backend Audit

### 4.1 API Structure
- [ ] Document all endpoints
- [ ] Check route organization
- [ ] Review middleware chain
- [ ] Assess error handling patterns

### 4.2 Database Layer
- [ ] Review Supabase table structure
- [ ] Check RLS policies
- [ ] Identify missing indexes
- [ ] Review migration history

### 4.3 External Integrations
- [ ] Document Telegram bot integration
- [ ] Review LangChain/LangGraph usage
- [ ] Check payment integration (YooKassa)
- [ ] Assess queue system (pg-boss)

---

## Phase 5: Recommendations

### 5.1 Proposed Structure
Based on findings, propose:
- [ ] Monorepo structure (if applicable)
- [ ] Package boundaries
- [ ] Shared code organization
- [ ] Naming conventions

### 5.2 Migration Plan
- [ ] Prioritize changes by impact/effort
- [ ] Create step-by-step migration tasks
- [ ] Identify breaking changes
- [ ] Estimate effort for each task

### 5.3 Cleanup Tasks
- [ ] List files to delete
- [ ] List packages to remove
- [ ] List packages to upgrade
- [ ] List code to consolidate

---

## Deliverables

1. **audit-report.md** - Detailed findings with file paths and line numbers
2. **proposed-structure.md** - New directory structure diagram
3. **migration-tasks.md** - Prioritized task list with estimates
4. **cleanup-checklist.md** - Immediate cleanup actions

---

## Tools to Use

- `pnpm outdated` - Check outdated packages
- `pnpm audit` - Security vulnerabilities
- `knip` - Dead code detection
- `madge` - Circular dependency detection
- `Glob/Grep` - Pattern searching
- `cloc` - Lines of code statistics

---

## Notes

- Focus on actionable findings
- Prioritize security and stability issues
- Consider backward compatibility
- Document all assumptions
