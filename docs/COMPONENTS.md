# Component Documentation

This document describes the key React components used in the "Coffee Cup Psychologist" application.

---

### Core Components

#### `App.tsx`

- **Purpose**: The root component of the application. It manages the main state (uploaded file, analysis result, loading status, errors, selected theme and language) and contains the primary logic for interacting with services.
- **Key States**:
    - `imageFile`: The file uploaded by the user.
    - `analysis`: The analysis result from the Gemini API.
    - `isLoading`: A flag indicating the analysis is in progress.
    - `error`: An error message string.
    - `focusArea`: The selected topic for analysis ('wellbeing', 'career', 'relationships').
    - `theme`: The current theme ('light' or 'dark').
    - `language`: The current language ('en', 'ru', 'zh').
- **Usage**: Rendered in `index.tsx` and serves as the application's entry point.

---

#### `Header.tsx`

- **Purpose**: Displays the application title, logo, and user controls. It is fully responsive. On mobile devices, it features a classic "sandwich" menu for accessing language and theme settings. On larger screens (tablets and desktops), these controls are consolidated into a single, elegant "Settings" dropdown menu.
- **Props**:
    - `onToggleTheme: () => void`: A function to toggle the theme.
    - `currentTheme: 'light' | 'dark'`: The currently active theme.
    - `language: Lang`: The current language code.
    - `setLanguage: (lang: Lang) => void`: A function to set the application language.
    - `t: (key: string) => string`: The translation function.
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

- **Purpose**: Displays the analysis result received from the Gemini API. Uses `react-markdown` to safely render formatted content. Includes a "Share" button to generate and share an image of the results.
- **Props**:
    - `analysis: string`: The analysis text, potentially in Markdown format.
    - `onReset: () => void`: A function to reset the state and return to the upload screen.
    - `theme: 'light' | 'dark'`: The current theme, passed to the image generator service.
    - `t: (key: string) => string`: The translation function.
- **Usage**: `<ResultDisplay analysis={analysis} onReset={handleReset} theme={theme} t={t} />`

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
- **`LogoIcon.tsx`**: The main application logo.
- **`MoonIcon.tsx` / `SunIcon.tsx`**: Icons for the `ThemeToggle`.
- **`ShareIcon.tsx`**: Icon for the "Share" button.
- **`UploadIcon.tsx`**: Icon for the image dropzone.
- **`GlobeIcon.tsx`**: Icon for the language switcher.
- **`ChevronDownIcon.tsx`**: Dropdown indicator for the language switcher.
- **`MenuIcon.tsx`**: Hamburger menu icon for the mobile header.

---

### Helper Components

- **`BackgroundPattern.tsx`**: A decorative component that renders a repeating background SVG pattern.
- **`Logo.tsx`**: A simple wrapper component for the `LogoIcon`.
- **`ThemeToggle.tsx`**: The button for switching between light and dark themes.