# Release Notes

User-facing release notes for all versions.

## v0.6.5

_Released on 2026-01-11_

### 🐛 Bug Fixes

- **lib**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.6.4

_Released on 2026-01-09_

### 🐛 Bug Fixes

- **admin**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.6.3

_Released on 2026-01-09_

### 🐛 Bug Fixes

- **lib**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.6.2

_Released on 2026-01-09_

### 🐛 Bug Fixes

- **telegram**: Suppress expected errors for CloudStorage and SDK init

---

_This release was automatically generated from 1 commits._

## v0.6.1

_Released on 2026-01-09_

### 🐛 Bug Fixes

- **hooks**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.6.0

_Released on 2026-01-09_

### ✨ New Features

- **credits**: Implement typed credit system (basic/pro/cassandra)

### 🐛 Bug Fixes

- **lib**: Update 2 source file(s)
- **deps**: Add nanoid for file-id-cache
- **photo**: Use short IDs in callback_data to fix BUTTON_DATA_INVALID

---

_This release was automatically generated from 5 commits._

## v0.5.53

_Released on 2026-01-08_

### 🐛 Bug Fixes

- **admin**: Update 1 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.52

_Released on 2026-01-06_

### 🐛 Bug Fixes

- **lib**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.51

_Released on 2026-01-06_

### 🐛 Bug Fixes

- **admin**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.50

_Released on 2026-01-06_

### 🐛 Bug Fixes

- **symancy-backend/tests/unit/modules/credits.test.ts**: Update 3 source file(s), update 1 test(s)
- **profile**: Check auth_id before showing Email link button
- **link**: Use atomic PostgreSQL function to prevent unique constraint violation

---

_This release was automatically generated from 5 commits._

## v0.5.49

_Released on 2026-01-06_

### ✨ New Features

- **photo-analysis**: Add topic selection for Basic vs Pro readings

---

_This release was automatically generated from 1 commits._

## v0.5.48

_Released on 2026-01-06_

### ✨ New Features

- **admin**: Add 4 source file(s), update 11 source file(s), +3 more

---

_This release was automatically generated from 1 commits._

## v0.5.47

_Released on 2026-01-06_

### 🐛 Bug Fixes

- **admin**: Update 5 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.46

_Released on 2026-01-05_

### ✨ New Features

- **admin**: Add 3 source file(s), update 4 source file(s)

### 🐛 Bug Fixes

- **backend**: Add missing queue constants for insight dispatcher
- **backend**: Register engagement workers before scheduler
- **deploy**: Use sudo to kill processes owned by root
- **deploy**: Add PM2 restart backoff and port debugging
- **deploy**: Delete PM2 dump file directly and stop systemd service
- **deploy**: Clear PM2 dump to prevent auto-resurrect of old process
- **deploy**: Combine PM2 commands into single SSH session
- **deploy**: Avoid pkill -f killing SSH session
- **deploy**: Use multiple methods to kill stale processes
- **deploy**: Kill stale processes and enforce version verification
- **chains**: Use process.cwd() for symlink-safe prompt paths

---

_This release was automatically generated from 12 commits._

## v0.5.45

_Released on 2026-01-05_

### ✨ New Features

- **engagement**: Add timezone support for daily insights

### 🔧 Improvements

- **engagement**: Fix remaining low-priority code review issues

### 🐛 Bug Fixes

- **chat**: Send error message only on last retry attempt
- **engagement**: Create engagement_log table and fix column references
- **engagement**: Address code review issues for timezone support

---

_This release was automatically generated from 6 commits._

## v0.5.44

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **Interface**: Make history detail view full-width, remove narrow box

---

_This release was automatically generated from 1 commits._

## v0.5.43

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **share**: Use native navigator.share when available

---

_This release was automatically generated from 1 commits._

## v0.5.42

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **share**: Increase share text limit to 3800 characters

---

_This release was automatically generated from 1 commits._

## v0.5.41

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **share**: Increase share text limit from 500 to 2000 characters

---

_This release was automatically generated from 1 commits._

## v0.5.40

_Released on 2026-01-04_

### 🔧 Improvements

- **share**: Share text instead of image, copy to clipboard in WebApp

---

_This release was automatically generated from 1 commits._

## v0.5.39

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **share**: On desktop WebApp download image instead of navigator.share() which opens Windows system dialog

---

_This release was automatically generated from 1 commits._

## v0.5.38

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **history**: Share button uses intro when no sections, analyze-another closes WebApp or navigates

---

_This release was automatically generated from 1 commits._

## v0.5.37

_Released on 2026-01-04_

---

_This release was automatically generated from 1 commits._

## v0.5.36

_Released on 2026-01-04_

### ✨ New Features

- **history**: Add source indicator (telegram/web) in history list

---

_This release was automatically generated from 1 commits._

## v0.5.35

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **auth/link**: Migrate analysis_history and conversations during account merge

---

_This release was automatically generated from 1 commits._

## v0.5.34

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **historyService**: Transform DB schema to UI format for analysis history

---

_This release was automatically generated from 1 commits._

## v0.5.33

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **historyService**: Add Telegram JWT support for analysis history

---

_This release was automatically generated from 1 commits._

## v0.5.32

_Released on 2026-01-04_

### ✨ New Features

- **symancy-backend/src/services/proactive/ProactiveMessageService.ts**: Add 3 source file(s), update 6 source file(s), +1 more

---

_This release was automatically generated from 1 commits._

## v0.5.31

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **components**: Update 1 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.30

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **services**: Update 1 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.29

_Released on 2026-01-04_

### ✨ New Features

- **symancy-backend/src/api/auth/link.ts**: Add 1 source file(s), update 4 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.28

_Released on 2026-01-04_

### 🐛 Bug Fixes

- **src/App.tsx**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.27

_Released on 2026-01-03_

### 🐛 Bug Fixes

- **i18n**: Replace hardcoded text with translations
- **telegram**: Rename menu button to 'Symancy' and open Home by default

---

_This release was automatically generated from 2 commits._

## v0.5.26

_Released on 2026-01-03_

### 🐛 Bug Fixes

- **components**: Update 3 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.25

_Released on 2026-01-03_

### 🐛 Bug Fixes

- **components**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.24

_Released on 2026-01-03_

### ✨ New Features

- **components**: Add 2 source file(s), update 5 source file(s), +2 more

### 🐛 Bug Fixes

- Redesign History page, fix balance RLS policy
- Dark theme cards, scroll, and smaller BottomNav icons

---

_This release was automatically generated from 4 commits._

## v0.5.23

_Released on 2026-01-03_

### 🐛 Bug Fixes

- Layout issues, credits query, and dark theme

---

_This release was automatically generated from 3 commits._

## v0.5.22

_Released on 2026-01-01_

### 🐛 Bug Fixes

- Detect Telegram context by initData instead of WebApp object

---

_This release was automatically generated from 1 commits._

## v0.5.21

_Released on 2026-01-01_

### 🐛 Bug Fixes

- **lib**: Update 2 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.20

_Released on 2026-01-01_

### ✨ New Features

- **telegram-miniapp**: Implement Phase 4 Growth features
- **telegram-miniapp**: Implement complete UX (Phase 1-3)

### 🐛 Bug Fixes

- **components**: Update 13 source file(s), update docs

---

_This release was automatically generated from 3 commits._

## v0.5.19

_Released on 2025-12-31_

### 🐛 Bug Fixes

- **symancy-backend/src/api/messages/send-message.ts**: Update 1 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.18

_Released on 2025-12-31_

### ✨ New Features

- **symancy-backend/src/app.ts**: Add 2 source file(s), update 1 source file(s)
- **models**: Load LLM models from dynamic config (system_config table)

### 🔧 Improvements

- **Authentication**: Use TMA.js SDK retrieveRawInitData for Telegram auth

### 🐛 Bug Fixes

- Add Telegram WebApp SDK script to index.html
- **Authentication**: Wait for Telegram WebApp to be injected before auth check
- **chat**: Wait for AuthContext loading before checking user state
- **vision**: Update MODEL_VISION to grok-4.1-fast

---

_This release was automatically generated from 9 commits._

## v0.5.17

_Released on 2025-12-31_

### 🐛 Bug Fixes

- **src/main.tsx**: Update 3 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.16

_Released on 2025-12-31_

### 🐛 Bug Fixes

- **utils**: Update 1 source file(s)

---

_This release was automatically generated from 1 commits._

## v0.5.15

_Released on 2025-12-31_

### 🐛 Bug Fixes

- **utils**: Update 1 source file(s)
- **telegram**: Use HEX colors directly from Telegram theme

---

_This release was automatically generated from 2 commits._

## v0.5.14

_Released on 2025-12-31_

### ✨ New Features

- **admin**: Add 8 source file(s), update 6 source file(s), +1 more

---

_This release was automatically generated from 1 commits._

## v0.5.13

_Released on 2025-12-31_

### ✨ New Features

- **vision**: Switch to x-ai/grok-vision-beta model
- **admin**: Track Vision model costs separately from Interpretation model

---

_This release was automatically generated from 2 commits._

## v0.5.12

_Released on 2025-12-31_

### 🐛 Bug Fixes

- **src/main.tsx**: Update 3 source file(s), update docs

---

_This release was automatically generated from 1 commits._

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
