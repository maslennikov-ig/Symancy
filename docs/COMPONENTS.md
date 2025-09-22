# Component Documentation

This document describes the key React components used in the "Coffee Cup Psychologist" application.

---

### Core Components

#### `App.tsx`

- **Purpose**: The root component of the application. It manages the main state (uploaded file, analysis result, loading status, errors, selected theme) and contains the primary logic for interacting with services.
- **Key States**:
    - `imageFile`: The file uploaded by the user.
    - `analysis`: The analysis result from the Gemini API.
    - `isLoading`: A flag indicating the analysis is in progress.
    - `error`: An error message string.
    - `focusArea`: The selected topic for analysis ('General Well-being', 'Career', 'Relationships').
    - `theme`: The current theme ('light' or 'dark').
- **Usage**: Rendered in `index.tsx` and serves as the application's entry point.

---

#### `Header.tsx`

- **Purpose**: Displays the application title, logo, and theme toggle switch.
- **Props**:
    - `onToggleTheme: () => void`: A function to toggle the theme.
    - `currentTheme: 'light' | 'dark'`: The currently active theme.
- **Usage**: `<Header onToggleTheme={toggleTheme} currentTheme={theme} />`

---

#### `ImageUploader.tsx`

- **Purpose**: Provides the interface for uploading an image (drag-and-drop and file selection). Includes tips for achieving the best results.
- **Props**:
    - `onImageSelect: (file: File) => void`: A callback function that is invoked when a file is selected.
- **Usage**: `<ImageUploader onImageSelect={handleImageSelect} />`

---

#### `ResultDisplay.tsx`

- **Purpose**: Displays the analysis result received from the Gemini API. Uses `react-markdown` to safely render formatted content. Includes a "Share" button to generate and share an image of the results.
- **Props**:
    - `analysis: string`: The analysis text, potentially in Markdown format.
    - `onReset: () => void`: A function to reset the state and return to the upload screen.
    - `theme: 'light' | 'dark'`: The current theme, passed to the image generator service.
- **Usage**: `<ResultDisplay analysis={analysis} onReset={handleReset} theme={theme} />`

---

### UI Components (`components/ui/`)

This directory contains `shadcn-ui` inspired base components that form the application's design system.

- **`button.tsx`**: A versatile button component with variants (default, outline, ghost) and sizes.
- **`card.tsx`**: A set of components (`Card`, `CardHeader`, `CardTitle`, etc.) for creating styled containers.
- **`scroll-area.tsx`**: A container with a custom-themed scrollbar.
- **`toggle-group.tsx`**: A component for creating a radio-group-like selection, used for the focus area.

---

### Icon Components

All icons are simple React components wrapping SVG paths from the `lucide` icon set for consistency.

- **`CoffeeIcon.tsx`**: Icon for the "Analyze" button.
- **`LoaderIcon.tsx`**: A spinning loader icon.
- **`LogoIcon.tsx`**: The main application logo.
- **`MoonIcon.tsx` / `SunIcon.tsx`**: Icons for the `ThemeToggle`.
- **`ShareIcon.tsx`**: Icon for the "Share" button.
- **`UploadIcon.tsx`**: Icon for the image dropzone.

---

### Helper Components

- **`BackgroundPattern.tsx`**: A decorative component that renders a repeating background SVG pattern.
- **`Logo.tsx`**: A simple wrapper component for the `LogoIcon`.
- **`ThemeToggle.tsx`**: The button for switching between light and dark themes.
