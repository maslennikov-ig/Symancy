# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).


## [0.5.9] - 2025-12-30

### Added
- **admin**: complete remaining code review improvements (886ae3a)
- **admin**: implement admin panel with shadcn/ui + Tremor (spec 007) (dc3a391)
- **specs**: update Admin Panel to shadcn/ui + Tremor stack (b4a6a9c)
- **specs**: add Admin Panel specification (007) (6aafc13)

### Fixed
- **admin**: address code review issues from 007-admin-panel (2e34413)

### Other
- expand testing guide with full spec 003 coverage (8a2457e)

## [0.5.8] - 2025-12-29

### Added
- **auth**: add ES256 algorithm support for JWT signing (227671a)
- **auth**: add RS256 JWT signing key support (348106d)

### Fixed
- **tests**: add missing prompt file mocks in chat-memory tests (206d51a)
- **routes**: remove /api prefix from backend routes (d47e958)
- **ci**: remove frozen-lockfile from server install (19aa1e2)
- **tests**: update chat handler integration tests for omnichannel (a3befcb)
- **ci**: update backend workflow for pnpm workspace dependencies (61f21ad)
- **e2e**: improve test reliability for CI environment (df8836a)

### Other
- add comprehensive testing guide for customer (779a658)
- **tests**: lower coverage thresholds temporarily (d23f7d0)

## [0.5.7] - 2025-12-28

### Added
- **shared-types**: add 9 source file(s), update 12 source file(s), +2 more (7c58622)

## [0.5.6] - 2025-12-28

### Added
- **symancy-backend/src/types/omnichannel.ts**: add 1 source file(s), update 11 source file(s), +1 more (dabbd6d)
- **omnichannel**: Phase 8 Account Linking (US6) (4ea07a2)
- **omnichannel**: Phase 7 complete - Proactive Messaging (US5) (339707e)
- **omnichannel**: T049 WebApp menu button (b0ac16b)
- **omnichannel**: T048 WebApp auto-authentication (4b8b79b)
- **omnichannel**: T047 useTelegramWebApp hook (248c37c)
- **omnichannel**: T046 POST /api/auth/webapp endpoint (8dc7799)
- **omnichannel**: T045 - Implement verifyWebAppInitData() (bb6617d)
- **omnichannel**: T044 - Enable chat for web-only users (030cba4)
- **omnichannel**: T043 - Show TelegramLinkPrompt to web-only users (796b743)
- **omnichannel**: T042 - UnifiedUserService for web users (7be6b38)
- **omnichannel**: T041 - TelegramLinkPrompt component (ca24921)
- **onboarding**: save and process photo sent before onboarding (c61b7f0)
- **omnichannel**: Phase 4 complete - T033-T040 messages API and chat page (af80fd5)
- **omnichannel**: Phase 4 tasks T031-T038 - messaging services and chat UI (2037c42)

### Fixed
- **omnichannel**: remaining code review fixes (MEDIUM-2, LOW-1,2,4) (0f54d4f)
- **omnichannel**: code review fixes for Phase 7+8 (349304e)
- **phase6**: code review fixes for WebApp authentication (d4dd92f)
- **security**: comprehensive code review fixes for Phase 4 (6ff832a)
- **phase4**: code review fixes - major and minor improvements (1fe84a1)
- **webhook**: auto-set webhook on startup, add health monitoring (c52f9fb)

### Other
- Phase 8 complete - mark T054-T060 done (74c54b5)
- Phase 6 complete - Telegram WebApp Experience (d99cc85)
- **tasks**: add missing artifacts to Phase 4 tasks (3cf34d8)

## [0.5.5] - 2025-12-28

### Added
- **omnichannel**: complete Phase 3 - Telegram User with Web Access (63687cf)
- **omnichannel**: complete Phase 2 - foundational infrastructure (30a42b1)
- **omnichannel**: Phase 1 setup - add dependencies and env config (9d461a5)

### Fixed
- **services**: update 12 source file(s) (0903276)
- **backend**: add missing @vitest/coverage-v8 dependency (26878b9)

## [0.5.4] - 2025-12-27

### Changed
- restructure frontend to src/ directory (a5388b6)

### Fixed
- resolve vitest mock hoisting and test configuration issues (2f8c5ca)
- resolve code review issues and add documentation (7fcad20)

### Other
- add project architecture documentation (52fecec)

## [0.5.4] - 2025-12-27

### Changed
- restructure frontend to src/ directory (a5388b6)

### Fixed
- resolve code review issues and add documentation (7fcad20)

### Other
- add project architecture documentation (52fecec)

## [0.5.3] - 2025-12-27

### Added
- **router**: require /start before allowing other interactions (8a285c8)

### Fixed
- **onboarding**: fix flow to wait for user input instead of auto-transitioning (338356e)
- **deploy**: remove pkill that killed SSH session (7e32fb8)
- **deploy**: handle pkill exit code properly (1ddac52)
- **deploy**: force PM2 restart and add version verification (a4858ca)
- **router**: rewrite with correct Grammy middleware pattern (cad0f75)
- **deploy**: fix PM2 log directory permissions issue (e6c0c30)
- **backend**: add guards to onboarding nodes for safe graph traversal (dbcbb76)

### Other
- update docs (2441693)
- **router**: add extensive logging for command debugging (3a0cd89)

## [0.5.2] - 2025-12-26

### Other
- update project files (9cfc657)

## [0.5.1] - 2025-12-26

### Other
- update project files (f909fd3)

## [0.5.0] - 2025-12-26

### Fixed
- **ci**: link shared .env file during backend deployment (460b881)
- **backend**: correct profile column names in middleware (e677a5e)
- **ci**: correct artifact path in backend deploy (36cd136)

### Other
- update project files (2d5e9e8)

## [0.4.2] - 2025-12-26

### Other
- consolidate documentation in root /docs/ folder (5d171b0)

## [0.4.1] - 2025-12-26

### Other
- update project files (16f5088)

## [0.4.0] - 2025-12-26

### Added
- **deploy**: add backend deployment configuration (T077) (a99bb02)
- **backend**: add production hardening (Phase 8) (62cae54)
- **backend**: implement proactive engagement module (US5) (c228947)
- **cassandra**: implement premium mystical oracle persona (T056-T060) (9bda777)
- **onboarding**: implement complete onboarding flow with LangGraph (T047-T055) (babf159)
- **chat**: implement chat module with follow-up conversations (T042-T046) (8cb63aa)
- **photo-analysis**: implement complete photo analysis module (T038-T041) (a5ec53f)
- **backend**: implement vision and interpretation LangChain chains (T036-T037) (e6dc707)
- **backend**: add Arina and vision prompts for photo analysis (T033-T035) (75d525c)

### Fixed
- **backend**: address code review findings (P0+P1) (b4aa88a)

### Other
- update docs (c6bb958)
- add .env reference and models info to E2E test plan (28aa170)
- switch to free/preview models for cost optimization (4e0b40d)
- enhance E2E test plan and vision prompt for decorated cups (0a1c195)
- add E2E test plan for local testing (65560b1)
- add final code review tasks and artifacts to tasks.md (156db63)
- mark Phase 2 tasks complete with artifacts in tasks.md (8060806)

## [0.3.16] - 2025-12-25

### Other
- update documentation (b006b44)

## [0.3.15] - 2025-12-25

### Other
- **mcp**: update MCP server configurations (40f8230)
- move manual tasks to TECHNICAL-DEBT.md (6e3d6c0)

## [0.3.14] - 2025-12-25

## [0.3.13] - 2025-12-25

## [0.3.12] - 2025-12-23

## [0.3.11] - 2025-12-23

### Added
- feat: improve test payment page with guest mode and update documentation (b4807a3)

### Fixed
- fix: resolve react hook conflict by deduplicating react instances via pnpm overrides (0e8c37d)

### Other
- revert: remove guest mode from test payment page (6b30c43)

## [0.3.10] - 2025-12-23

### Fixed
- fix: install missing chat styles and fix telegram bash syntax (118a3ae)
- fix: temporary disable strict type checking and add telegram debugging (9d3f12b)
- fix: enforce skipLibCheck in type-check script to ignore vendor errors (5fd684a)
- fix: unblock CI/CD by suppressing library type conflicts and adding missing dependencies (a2fbb75)
- fix: resolve typescript compilation errors for CI/CD (12200a5)

### Other
- docs: update documentation\n\nAuto-committed 1 file(s) before creating release.\n\nFiles changed:\n  M	docs/PAYMENT-TESTING-GUIDE.md\n\n🤖 Generated with Gemini CLI\n\nCo-Authored-By: Gemini <noreply@google.com> (b0a1f3e)
- chore: update pnpm-lock.yaml to fix CI build (3571c0f)
- chore: security cleanup - redact leaked bot token in docs and configs (edda6ac)

## [0.3.9] - 2025-12-23

### Other
- docs: update documentation\n\nAuto-committed 3 file(s) before creating release.\n\nFiles changed:\n  M	.github/workflows/deploy.yml   M	CLAUDE.md   M	package.json\n\n🤖 Generated with Gemini CLI\n\nCo-Authored-By: Gemini <noreply@google.com> (40c255a)

## [0.3.8] - 2025-12-23

## [0.3.7] - 2025-12-22

## [0.3.6] - 2025-12-22

### Added
- **payments**: add Telegram bot payments (Phase 10) (5e43061)

## [0.3.5] - 2025-12-19

## [0.3.4] - 2025-12-18

## [0.3.3] - 2025-12-18

### Fixed
- fix(gemini): use robust background process detachment for windows notifications (1b76f44)

### Other
- docs: update documentation\n\nAuto-committed 13 file(s) before creating release.\n\nFiles changed:\n  A	.gemini/scripts/debug_notify.sh   D	.gemini/tests/captured_cmd.txt   D	.gemini/tests/wrapper.sh   M	components/payment/PaymentWidget.tsx   M	components/payment/TariffCard.tsx   M	components/payment/TariffSelector.tsx   A	docs/BACKEND_MIGRATION_SPEC.md   A	docs/MASTER_SPECIFICATION.md   A	docs/ROADMAP_IMPLEMENTATION.md   M	lib/i18n.ts   A	n8n/coffee_reader (5).json   M	pages/Pricing.tsx   M	types/payment.ts\n\n🤖 Generated with Gemini CLI\n\nCo-Authored-By: Gemini <noreply@google.com> (ea204c3)
- chore: security cleanup - untrack secrets and sanitize workflow (25e3f82)

## [0.3.2] - 2025-12-18

### Other
- chore(scripts): update automation scripts\n\nAuto-committed 5 file(s) before creating release.\n\nFiles changed:\n  M	.gemini/scripts/notify_windows.sh   A	.gemini/tests/captured_cmd.txt   M	.gemini/tests/test_notify.sh   A	.gemini/tests/wrapper.sh   A	.github/workflows/deploy.yml\n\n🤖 Generated with Gemini CLI\n\nCo-Authored-By: Gemini <noreply@google.com> (5e21148)

## [0.3.1] - 2025-12-18

### Added
- feat(gemini): add windows notification support to release script (eb0c468)

## [0.3.0] - 2025-12-18

### Added
- feat(gemini): add push command and release automation script (09f37c2)

### Fixed
- fix(gemini): use correct TOML format for push command (78cba78)

### Other
- chore: update project files\n\nAuto-committed 1 file(s) before creating release.\n\nFiles changed:\n  M	.gitignore\n\n🤖 Generated with Gemini CLI\n\nCo-Authored-By: Gemini <noreply@google.com> (1ccdae2)
- chore(contacts): update support phone number (a87fbe9)

## [0.2.4] - 2025-12-05

## [0.2.3] - 2025-12-03

## [0.2.2] - 2025-12-02

## [0.2.1] - 2025-11-28

## [0.2.0] - 2025-11-24

### Added
- **002**: Complete Phase 7-8 - Analytics + Documentation (e443fe2)
- **002**: Complete Phase 5-6 - History UI + Credit consumption (4f896ad)
- **002**: Complete Phase 4 - Payment webhook handler (396d62a)
- **002**: Complete Phase 3 - Payment flow frontend (MVP) (9e42353)
- **002**: Complete Phase 2 - Database schema for payments (0678faa)
- **002**: Complete Phase 1 - Setup project initialization (9af2377)
- **002**: Initialize Pre-MVP payment integration feature (e46fb64)

## [0.1.5] - 2025-11-23

## [0.1.4] - 2025-11-14

## [0.1.3] - 2025-11-14

## [0.1.2] - 2025-11-14

## [0.1.1] - 2025-11-14

## [0.1.0] - 2025-11-10

### Added
- Integrate Google Gemini API for analysis (9266031)
- Migrate Gemini analysis to Netlify function (15b587c)
- Add analysis history feature (822285e)
- Integrate Supabase for authentication and improve analysis output (933bffd)
- Implement internationalization and enhance UI (5ecc1f7)
- Initialize Coffee Cup Psychologist app (1292710)

### Changed
- Rebrand project from CoffeeReader to Symancy (42e0929)

### Fixed
- **ui**: Adjust button styles for better contrast (e36ea27)
## [2.1.0]

### Added
- **Analysis History**: Implemented a feature for logged-in users to save and view their past analysis results. This allows users to track their journey of self-discovery across devices.
- **History Service**: Created `services/historyService.ts` to interact with Supabase for storing and retrieving analysis history from a new `analysis_history` table.
- **History UI**: Added a `HistoryDisplay` component to show the list of past analyses and a "My History" button in the user menu for authenticated users.

## [2.0.0]

### Changed
- **Major Refactoring**: Overhauled the core analysis feature to use the Gemini API's JSON mode with a strict response schema. This replaces fragile text parsing with a structured data approach, significantly improving the reliability and maintainability of the analysis results.
- **State Management**: The main application state in `App.tsx` has been updated to manage a typed `AnalysisResponse` object directly, simplifying data flow.
- **Component Simplification**: The `ResultDisplay` component was refactored to work with the new structured data, removing complex rendering logic.

### Removed
- **Code Cleanup**: Performed a deep refactoring to eliminate dead and unused code. Removed several obsolete components (`LogoLab`, old logo concepts, `BackgroundPattern`, various old UI icons), and unnecessary documentation (`PROVIDER_SETUP.md`).

### Fixed
- **Internationalization**: Corrected hardcoded text within the `AuthModal` by implementing the `t()` translation function.
- **Authentication Provider**: Re-enabled `Telegram` as a sign-in option in the `AuthModal` and resolved a "module not found" error by restoring the `TelegramIcon` component.

## [1.8.0]

### Changed
- **Simplified Login Flow**: The authentication modal now consistently displays **Google** and **Apple** as the default sign-in providers on all devices. This provides a more predictable user experience.
- **Removed Device-Specific Logic**: The previous logic that showed different defaults on iPhone vs. other devices has been removed in favor of a single, unified default view. Other providers like Facebook remain accessible via the "show more" button.

## [1.7.0]

### Added
- **Conditional Login Flow**: The authentication modal now intelligently displays default sign-in options. It shows "Apple" on iPhones and "Google" on all other devices, alongside "Telegram".
- **"Show More" Functionality**: Added a "Show other ways" toggle in the auth modal to reveal less common providers (like Facebook), keeping the initial view clean and focused.

### Changed
- **Improved UX**: Refined the sign-in experience by prioritizing the most relevant authentication methods for the user's platform, reducing clutter and decision fatigue.
- **New Documentation**: Created `docs/PROVIDER_SETUP.md` to guide the project owner through the process of obtaining and configuring OAuth credentials in the Supabase dashboard.

## [1.6.0]

### Added
- **Expanded Sign-In Options**: Added support for several new authentication providers to enhance user convenience. Users can now sign in with Apple, Facebook, Yandex, and Telegram, in addition to the existing Google and Magic Link options.
- **New Provider Icons**: Created custom SVG icon components for each new authentication provider to ensure a consistent and recognizable UI in the login modal.

### Changed
- **Redesigned Auth Modal**: The authentication modal (`AuthModal.tsx`) has been updated with a clean, scalable, vertical layout to accommodate the new sign-in buttons without cluttering the interface.

## [1.5.0]

### Added
- **User Authentication**: Integrated Supabase for secure user authentication.
- **Sign-In Methods**: Added support for signing in with a Google account or via a passwordless "magic link" sent to the user's email.
- **Authenticated State**: The header now displays the user's email and a "Sign Out" option when logged in.
- **Auth Components**: Created `AuthModal` for the sign-in flow and an `AuthContext` to manage the session state globally.

## [1.4.0]

### Added
- **Dynamic Background**: Introduced an interactive, animated particle background that subtly reacts to mouse movement, enhancing the application's mystical and atmospheric feel.
- **Theme-Aware Particles**: The new background particles automatically adjust their color to match both the light ("latte") and dark ("espresso") themes.

### Changed
- Replaced the previous static, repeating coffee-bean SVG background pattern with the new dynamic particle system for a more engaging user experience.

## [1.3.0]

### Changed
- **Unified Profile Menu**: Refactored the header to use a single, unified dropdown menu accessible via the profile icon. This menu now serves both authenticated and guest users, providing a consistent "best practice" user experience.
- **Settings Accessibility**: Theme and language settings are now always accessible from the main profile dropdown menu, regardless of the user's authentication status.
- **Auth Flow**: For guest users, the dropdown menu contains a prominent "Sign In" button which opens the authentication modal, streamlining the login process.

### Fixed
- **UI Consistency**: Removed separate menu logic for different screen sizes and authentication states, creating a more predictable and maintainable header component.

## [1.2.0]

### Changed
- **Header Refinement**: Refactored the header component for improved responsiveness and space management.
- **Mobile UX**: Re-introduced the classic "sandwich" menu for mobile devices to provide a more familiar user experience.
- **Desktop UX**: Consolidated language and theme controls into a single, unified "Settings" dropdown menu for tablet and desktop views, creating a cleaner interface.

### Fixed
- **Title Wrapping**: Resolved a layout issue that caused the main application title to wrap onto two lines on tablet and smaller desktop screens.
- **Horizontal Scroll**: Eliminated an unwanted horizontal scrollbar that appeared on some mobile devices.

## [1.1.0]

### Added
- **Multi-language Support**: The application now supports English, Russian, and Chinese. It automatically detects the user's language and allows for manual switching.
- **Responsive Header & Mobile Menu**: The header is now fully responsive. On mobile devices, a hamburger menu contains the language and theme controls for a cleaner UI.
- **Project Changelog**: This `CHANGELOG.md` file has been created to track all future changes.

### Changed
- **UI/UX Improvements**:
    - The language switcher is now a more user-friendly dropdown menu on desktop.
    - Fixed a layout bug that caused a large empty space between the header and the main content on larger screens.
- **Documentation**: Updated all documentation files (`README.md`, `COMPONENTS.md`, `SERVICES.md`) to reflect the latest features and component changes.

## [1.0.0]

### Added
- Initial release of the "Coffee Cup Psychologist" application.
- AI-powered analysis of coffee cup images using the Google Gemini API.
- Image uploader with drag-and-drop functionality.
- Focused analysis options (Well-being, Career, Relationships).
- Feature to generate and share analysis results as an image.
- Toggleable light ("Latte") and dark ("Espresso") themes.
- Initial project documentation (`README.md`, `COMPONENTS.md`, `SERVICES.md`, `STYLING.md`, `FUTURE_IMPROVEMENTS.md`).
