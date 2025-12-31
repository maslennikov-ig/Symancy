import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

/**
 * Early Telegram WebApp initialization
 * Runs BEFORE React mounts to prevent flash of unstyled content
 */
function initTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg?.initData) return;

  // Add tg-webapp class immediately for CSS targeting
  document.documentElement.classList.add('tg-webapp');

  // Signal to Telegram that the WebApp is ready
  tg.ready();

  // Expand to full height
  if (!tg.isExpanded) {
    tg.expand();
  }

  // Bind theme params to CSS variables immediately
  const themeParams = tg.themeParams;
  const root = document.documentElement;

  if (themeParams.bg_color) root.style.setProperty('--tg-bg-color', themeParams.bg_color);
  if (themeParams.text_color) root.style.setProperty('--tg-text-color', themeParams.text_color);
  if (themeParams.hint_color) root.style.setProperty('--tg-hint-color', themeParams.hint_color);
  if (themeParams.link_color) root.style.setProperty('--tg-link-color', themeParams.link_color);
  if (themeParams.button_color) root.style.setProperty('--tg-button-color', themeParams.button_color);
  if (themeParams.button_text_color) root.style.setProperty('--tg-button-text-color', themeParams.button_text_color);
  if (themeParams.secondary_bg_color) root.style.setProperty('--tg-secondary-bg-color', themeParams.secondary_bg_color);
  if (themeParams.header_bg_color) root.style.setProperty('--tg-header-bg-color', themeParams.header_bg_color);
  if (themeParams.accent_text_color) root.style.setProperty('--tg-accent-text-color', themeParams.accent_text_color);
  if (themeParams.section_bg_color) root.style.setProperty('--tg-section-bg-color', themeParams.section_bg_color);
  if (themeParams.section_header_text_color) root.style.setProperty('--tg-section-header-text-color', themeParams.section_header_text_color);
  if (themeParams.subtitle_text_color) root.style.setProperty('--tg-subtitle-text-color', themeParams.subtitle_text_color);
  if (themeParams.destructive_text_color) root.style.setProperty('--tg-destructive-text-color', themeParams.destructive_text_color);

  // Bind safe area insets
  const safeArea = tg.safeAreaInset;
  if (safeArea) {
    root.style.setProperty('--tg-safe-area-top', `${safeArea.top || 0}px`);
    root.style.setProperty('--tg-safe-area-bottom', `${safeArea.bottom || 0}px`);
    root.style.setProperty('--tg-safe-area-left', `${safeArea.left || 0}px`);
    root.style.setProperty('--tg-safe-area-right', `${safeArea.right || 0}px`);
  }

  // Set initial viewport height
  root.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
  root.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
}

// Initialize Telegram WebApp BEFORE React mounts
initTelegramWebApp();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);