# Release Notes

User-facing release notes for all versions.

## v0.5.11

_Released on 2025-12-30_

### ✨ New Features

- **admin**: Add theme toggle and language selector to admin header

---

_This release was automatically generated from 1 commits._

## v0.5.10

_Released on 2025-12-30_

### ✨ New Features

- **components**: Add 3 source file(s), update 6 source file(s)
- **admin**: Add admin users management to system config page

### 🐛 Bug Fixes

- **admin**: Add missing i18n translations for Costs, UserDetail, Messages pages
- **admin**: Show proper subtitle on login page instead of error message
- **admin**: Use Tailwind v4 Vite plugin for proper CSS detection
- **deploy**: Add VITE env variables to build step
- **tailwind**: Include src/admin in content paths

---

_This release was automatically generated from 8 commits._

## v0.5.9

_Released on 2025-12-30_

### ✨ New Features

- **admin**: Complete remaining code review improvements
- **admin**: Implement admin panel with shadcn/ui + Tremor (spec 007)
- **specs**: Update Admin Panel to shadcn/ui + Tremor stack
- **specs**: Add Admin Panel specification (007)

### 🐛 Bug Fixes

- **admin**: Address code review issues from 007-admin-panel

---

_This release was automatically generated from 6 commits._

## v0.5.8

_Released on 2025-12-29_

### ✨ New Features

- **Authentication**: Add ES256 algorithm support for JWT signing
- **Authentication**: Add RS256 JWT signing key support

### 🐛 Bug Fixes

- **tests**: Add missing prompt file mocks in chat-memory tests
- **routes**: Remove /api prefix from backend routes
- **CI/CD**: Remove frozen-lockfile from server install
- **tests**: Update chat handler integration tests for omnichannel
- **CI/CD**: Update backend workflow for pnpm workspace dependencies
- **e2e**: Improve test reliability for CI environment

---

_This release was automatically generated from 10 commits._

## v0.5.7

_Released on 2025-12-28_

### ✨ New Features

- **shared-types**: Add 9 source file(s), update 12 source file(s), +2 more

---

_This release was automatically generated from 1 commits._

## v0.5.6

_Released on 2025-12-28_

### ✨ New Features

- **symancy-backend/src/types/omnichannel.ts**: Add 1 source file(s), update 11 source file(s), +1 more
- **omnichannel**: Phase 8 Account Linking (US6)
- **omnichannel**: Phase 7 complete - Proactive Messaging (US5)
- **omnichannel**: T049 WebApp menu button
- **omnichannel**: T048 WebApp auto-authentication
- **omnichannel**: T047 useTelegramWebApp hook
- **omnichannel**: T046 POST /api/auth/webapp endpoint
- **omnichannel**: T045 - Implement verifyWebAppInitData()
- **omnichannel**: T044 - Enable chat for web-only users
- **omnichannel**: T043 - Show TelegramLinkPrompt to web-only users
- **omnichannel**: T042 - UnifiedUserService for web users
- **omnichannel**: T041 - TelegramLinkPrompt component
- **onboarding**: Save and process photo sent before onboarding
- **omnichannel**: Phase 4 complete - T033-T040 messages API and chat page
- **omnichannel**: Phase 4 tasks T031-T038 - messaging services and chat UI

### 🐛 Bug Fixes

- **omnichannel**: Remaining code review fixes (MEDIUM-2, LOW-1,2,4)
- **omnichannel**: Code review fixes for Phase 7+8
- **phase6**: Code review fixes for WebApp authentication
- **Security**: Comprehensive code review fixes for Phase 4
- **phase4**: Code review fixes - major and minor improvements
- **webhook**: Auto-set webhook on startup, add health monitoring

---

_This release was automatically generated from 24 commits._

## v0.5.5

_Released on 2025-12-28_

### ✨ New Features

- **omnichannel**: Complete Phase 3 - Telegram User with Web Access
- **omnichannel**: Complete Phase 2 - foundational infrastructure
- **omnichannel**: Phase 1 setup - add dependencies and env config

### 🐛 Bug Fixes

- **services**: Update 12 source file(s)
- **backend**: Add missing @vitest/coverage-v8 dependency

---

_This release was automatically generated from 5 commits._

## v0.5.4

_Released on 2025-12-27_

### 🔧 Improvements

- Restructure frontend to src/ directory

### 🐛 Bug Fixes

- Resolve vitest mock hoisting and test configuration issues
- Resolve code review issues and add documentation

---

_This release was automatically generated from 4 commits._

## v0.5.4

_Released on 2025-12-27_

### 🔧 Improvements

- Restructure frontend to src/ directory

### 🐛 Bug Fixes

- Resolve code review issues and add documentation

---

_This release was automatically generated from 3 commits._

## v0.5.3

_Released on 2025-12-27_

### ✨ New Features

- **router**: Require /start before allowing other interactions

### 🐛 Bug Fixes

- **onboarding**: Fix flow to wait for user input instead of auto-transitioning
- **deploy**: Remove pkill that killed SSH session
- **deploy**: Handle pkill exit code properly
- **deploy**: Force PM2 restart and add version verification
- **router**: Rewrite with correct Grammy middleware pattern
- **deploy**: Fix PM2 log directory permissions issue
- **backend**: Add guards to onboarding nodes for safe graph traversal

---

_This release was automatically generated from 10 commits._

## v0.5.2

_Released on 2025-12-26_

---

_This release was automatically generated from 1 commits._

## v0.5.1

_Released on 2025-12-26_

---

_This release was automatically generated from 1 commits._

## v0.5.0

_Released on 2025-12-26_

### 🐛 Bug Fixes

- **CI/CD**: Link shared .env file during backend deployment
- **backend**: Correct profile column names in middleware
- **CI/CD**: Correct artifact path in backend deploy

---

_This release was automatically generated from 4 commits._

## v0.4.2

_Released on 2025-12-26_

---

_This release was automatically generated from 1 commits._

## v0.4.1

_Released on 2025-12-26_

---

_This release was automatically generated from 1 commits._

## v0.4.0

_Released on 2025-12-26_

### ✨ New Features

- **deploy**: Add backend deployment configuration (T077)
- **backend**: Add production hardening (Phase 8)
- **backend**: Implement proactive engagement module (US5)
- **cassandra**: Implement premium mystical oracle persona (T056-T060)
- **onboarding**: Implement complete onboarding flow with LangGraph (T047-T055)
- **chat**: Implement chat module with follow-up conversations (T042-T046)
- **photo-analysis**: Implement complete photo analysis module (T038-T041)
- **backend**: Implement vision and interpretation LangChain chains (T036-T037)
- **backend**: Add Arina and vision prompts for photo analysis (T033-T035)

### 🐛 Bug Fixes

- **backend**: Address code review findings (P0+P1)

---

_This release was automatically generated from 17 commits._
