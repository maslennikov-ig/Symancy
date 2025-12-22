# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).


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
