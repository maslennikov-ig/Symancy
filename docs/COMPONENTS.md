# Component Documentation

This document describes the key React components used in the "Coffee Cup Psychologist" application.

---

### Core Components

#### `App.tsx`

- **Purpose**: The root component of the application. It manages the main state (uploaded file, analysis result, loading status, errors, selected theme and language) and contains the primary logic for interacting with services.
- **Key States**:
    - `imageFile`: The file uploaded by the user.
    - `analysis`: A structured object containing the analysis result from the Gemini API.
    - `isLoading`: A flag indicating the analysis is in progress.
    - `error`: An error message string.
    - `focusArea`: The selected topic for analysis ('wellbeing', 'career', 'relationships').
    - `theme`: The current theme ('light' or 'dark').
    - `language`: The current language ('en', 'ru', 'zh').
    - `currentView`: The currently active view ('uploader' or 'history').
- **Usage**: Rendered in `index.tsx` and serves as the application's entry point. It handles the logic for saving analysis results for logged-in users and switching between the main uploader/result view and the history view.

---

#### `Header.tsx`

- **Purpose**: Displays the application title, logo, and a unified user/settings menu. The icon in the top-right corner serves as a single entry point for all user-related actions and application settings, following modern UI/UX best practices.
- **Functionality**:
    - **Unified Dropdown**: Clicking the icon opens a dropdown menu.
    - **Guest View**: For logged-out users, the menu provides a prominent "Sign In" button which opens the `AuthModal`.
    - **Authenticated View**: For logged-in users, the menu displays the user's email, a "My History" button, theme and language selectors, and a "Sign Out" button.
- **Props**:
    - `logoComponent`: The SVG component to be used as the main logo.
    - `onToggleTheme: () => void`: A function to toggle the theme.
    - `currentTheme: 'light' | 'dark'`: The currently active theme.
    - `language: Lang`: The current language code.
    - `setLanguage: (lang: Lang) => void`: A function to set the application language.
    - `t: (key: string) => string`: The translation function.
    - `onShowHistory: () => void`: A callback function that switches the main view to the history display.
- **Usage**: `<Header {...props} />`

---

#### `ImageUploader.tsx`

- **Purpose**: Provides the interface for uploading an image (drag-and-drop and file selection). Includes tips for achieving the best results.
- **Props**:
    - `onImageSelect: (file: File) => void`: A callback function that is invoked when a file is selected.
    - `t: (key: string) => string`: The translation function.
- **Usage**: `<ImageUploader onImageSelect={handleImageSelect} t={t} />`

---

#### `ResultDisplay.tsx`

- **Purpose**: Displays the structured analysis result received from the Gemini API. It directly renders the introduction and sections from the analysis object and uses `react-markdown` to safely render formatted content. Includes a "Share" button to generate and share an image of the results.
- **Props**:
    - `analysis: AnalysisResponse`: The structured analysis object.
    - `onReset: () => void`: A function to reset the state and return to the upload screen.
    - `theme: 'light' | 'dark'`: The current theme, passed to the image generator service.
    - `t: (key: string) => string`: The translation function.
- **Usage**: `<ResultDisplay analysis={analysis} onReset={handleReset} theme={theme} t={t} />`

---

#### `HistoryDisplay.tsx`

- **Purpose**: Displays a list of past analysis results for the logged-in user.
- **Functionality**:
    - Fetches the user's analysis history from the `historyService`.
    - Manages its own loading, error, and empty states.
    - Renders a scrollable list of past analyses, showing the focus area, date, and a snippet of the introduction.
    - Allows a user to click a "View Analysis" button to load a past result into the main view.
- **Props**:
    - `onSelectAnalysis: (item: HistoryItem) => void`: A callback that passes the selected history item back to `App.tsx` to be displayed.
    - `onClose: () => void`: A function to switch the view back to the uploader.
    - `t: (key: string) => string`: The translation function.
    - `language: Lang`: The current language for date formatting.
- **Usage**: `<HistoryDisplay {...props} />`

---

### Authentication Components

#### `AuthModal.tsx`

- **Purpose**: A modal dialog that provides a streamlined and intelligent user interface for authentication.
- **Functionality**:
    - **Default Providers**: Displays the most popular sign-in options (**Google** and **Apple**) by default on all devices for a consistent experience.
    - **"Show More" Toggle**: Other providers (like Facebook) are hidden behind a "Show other ways to sign in" button to keep the interface clean.
    - **Magic Link**: Allows users to request a passwordless "magic link" by entering their email address.
- **Props**:
    - `onClose: () => void`: A function to close the modal.
    - `t: (key: string) => string`: The translation function.
- **Usage**: Displayed when a guest user clicks the "Sign In" button.

---

### Contexts

#### `contexts/AuthContext.tsx`

- **Purpose**: A React Context provider that manages and distributes the global authentication state throughout the application.
- **Functionality**:
    - Initializes the Supabase client and checks for an existing session.
    - Provides the current `user` object and `session` details.
    - Exposes methods for signing in with various providers (`signInWithProvider`) and signing out (`signOut`).
    - Wraps the entire application in `index.tsx` to make auth state accessible to all components via the `useAuth` hook.

---

### UI Components (`components/ui/`)

This directory contains `shadcn-ui` inspired base components that form the application's design system.

- **`button.tsx`**: A versatile button component with variants (default, outline, ghost) and sizes.
- **`card.tsx`**: A set of components (`Card`, `CardHeader`, `CardTitle`, etc.) for creating styled containers.
- **`scroll-area.tsx`**: A container with a custom-themed scrollbar.
- **`toggle-group.tsx`**: A component for creating a radio-group-like selection, used for the focus area.

---

### Icon Components

All icons are simple React components wrapping SVG paths for consistency.

- **`CoffeeIcon.tsx`**: Icon for the "Analyze" button.
- **`LoaderIcon.tsx`**: A spinning loader icon.
- **`OfficialLogo.tsx`**: The main application logo.
- **`MoonIcon.tsx` / `SunIcon.tsx`**: Icons for the `ThemeToggle`.
- **`ShareIcon.tsx`**: Icon for the "Share" button.
- **`UploadIcon.tsx`**: Icon for the image dropzone.
- **`ProfileIcon.tsx`**: Icon for the user profile/settings menu.
- **`LogoutIcon.tsx`**: Icon for the sign-out button.
- **`HistoryIcon.tsx`**: Icon for the "My History" menu item.
- **`GoogleIcon.tsx`**: Icon for the Google sign-in button.
- **`AppleIcon.tsx`**: Icon for the Apple sign-in button.
- **`FacebookIcon.tsx`**: Icon for the Facebook sign-in button.


---

### Helper Components

- **`MysticalBackground.tsx`**: A decorative component that renders a dynamic, interactive particle background.
- **`ThemeToggle.tsx`**: The button for switching between light and dark themes.