# Styling Guide

This document describes the styling approach used in the "Coffee Cup Psychologist" project.

---

## Tailwind CSS

The project uses **Tailwind CSS** as its primary styling framework. This allows for the rapid development of responsive and consistent interfaces using utility classes.

### Configuration

The Tailwind CSS configuration is located directly in the `index.html` file within a `<script>` tag for simplicity.

- **Dark Mode**: Enabled using `darkMode: 'class'`. This means the dark theme is applied by adding the `.dark` class to the `<html>` element.
- **Fonts**: Custom font families have been added:
    - `sans`: 'Inter' (for body text)
    - `display`: 'Playfair Display' (for headings)

## Theming with CSS Variables

The project uses a theming system inspired by `shadcn-ui`, which relies on CSS variables for colors, border radius, and other properties. This makes it easy to maintain a consistent look and feel and to manage themes.

The color variables are defined in a `@layer base` block in `index.html` for both `:root` (light theme) and `.dark` (dark theme).

### Color Palette ("Coffee Theme")

The color scheme is built on warm, "coffee-inspired" tones to create a cozy and thematic atmosphere.

- **Light Theme ("Latte")**:
    - **Background**: `stone-50`
    - **Card/Content Background**: `stone-50` with a backdrop blur effect
    - **Text**: `stone-950`
    - **Accent**: `amber-500`

- **Dark Theme ("Espresso")**:
    - **Background**: `stone-950`
    - **Card/Content Background**: `stone-900` with a backdrop blur effect
    - **Text**: `stone-50`
    - **Accent**: `amber-500` (remains bright for contrast)

## Animations

The application uses Tailwind's built-in transition utilities for smooth animations on hover, focus, and theme changes. More complex animations, if needed, are defined in the `tailwind.config` object under the `keyframes` and `animation` keys.

## Custom Styles

- **Scrollbar**: The browser scrollbar is custom-styled to match the application's color palette in both light and dark themes. These styles are defined in `index.html`.
