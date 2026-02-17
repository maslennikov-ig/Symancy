import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { initTelegramCssVariables } from './utils/telegramTheme';
import { initSentry } from './lib/sentry';

// Initialize error tracking FIRST (before any other code)
initSentry();

/**
 * Early Telegram WebApp initialization
 * Runs BEFORE React mounts to prevent flash of unstyled content
 *
 * MEDIUM-QUALITY-1 FIX: Uses shared utility for CSS binding
 */
function initTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  // Add tg-webapp class immediately for CSS targeting
  document.documentElement.classList.add('tg-webapp');

  // Set dark/light class based on Telegram's colorScheme
  if (tg.colorScheme === 'dark') {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }

  // Signal to Telegram that the WebApp is ready
  tg.ready();

  // Expand to full height
  if (!tg.isExpanded) {
    tg.expand();
  }

  // MEDIUM-QUALITY-1 FIX: Use shared utility for CSS variable binding
  initTelegramCssVariables(tg);
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
