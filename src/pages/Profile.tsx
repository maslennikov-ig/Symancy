/**
 * Profile Page - Telegram Mini App User Profile
 *
 * Displays user information, settings, and account management for Telegram Mini App users.
 *
 * Features:
 * - User info section (avatar, name, username, premium badge)
 * - Balance row (click to navigate to Credits)
 * - Statistics preview (analyses count, messages count)
 * - Settings section with toggles (language, theme, notifications)
 * - Account linking status
 * - Help & About links
 *
 * @module pages/Profile
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useCloudStorage, type Language, type ThemeOption } from '../hooks/useCloudStorage';
import { useAuth } from '../contexts/AuthContext';
import { getUserCredits } from '../services/paymentService';
import { getUserStats, type UserStats } from '../services/statsService';
import { Card, CardContent } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { LoaderIcon } from '../components/icons/LoaderIcon';
import { TelegramLinkPrompt } from '../components/features/auth/TelegramLinkPrompt';
import { translations, Lang, t as i18n_t } from '../lib/i18n';
import type { UserCredits } from '../types/payment';

// Build-time constant from vite.config.ts
declare const __APP_VERSION__: string;

// ============================================================================
// Types
// ============================================================================

interface ProfileProps {
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

// ============================================================================
// Icon Components
// ============================================================================

function ChevronRightIcon(): React.ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StarIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * User Avatar component with fallback
 */
function UserAvatar({
  photoUrl,
  name,
  size = 64,
}: {
  photoUrl?: string;
  name: string;
  size?: number;
}): React.ReactElement {
  const [imageError, setImageError] = useState(false);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl && !imageError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        onError={() => setImageError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid var(--tg-theme-button-color, hsl(var(--primary)))',
        }}
      />
    );
  }

  // Fallback to initials
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: 'var(--tg-theme-button-color, hsl(var(--primary)))',
        color: 'var(--tg-theme-button-text-color, hsl(var(--primary-foreground)))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size / 2.5,
        fontWeight: 600,
        border: '3px solid var(--tg-theme-button-color, hsl(var(--primary)))',
      }}
    >
      {initials}
    </div>
  );
}

/**
 * Settings row item
 */
function SettingsRow({
  label,
  value,
  onClick,
  rightElement,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
          fontSize: '15px',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
        }}
      >
        {value && <span style={{ fontSize: '14px' }}>{value}</span>}
        {rightElement}
        {onClick && <ChevronRightIcon />}
      </div>
    </div>
  );
}

/**
 * Language selector with options
 */
function LanguageSelector({
  currentLanguage,
  onSelect,
  t,
}: {
  currentLanguage: Language;
  onSelect: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
  ];

  const currentLang = languages.find((l) => l.code === currentLanguage);

  const handleSelect = (lang: Language) => {
    onSelect(lang);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, lang: Language) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(lang);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('profile.language')}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <SettingsRow
          label={t('profile.language')}
          value={`${currentLang?.flag} ${currentLang?.name}`}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      {isOpen && (
        <div
          role="listbox"
          aria-label={t('profile.language')}
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
            border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            minWidth: '160px',
            overflow: 'hidden',
          }}
        >
          {languages.map((lang) => (
            <div
              key={lang.code}
              role="option"
              aria-selected={lang.code === currentLanguage}
              tabIndex={0}
              onClick={() => handleSelect(lang.code)}
              onKeyDown={(e) => handleOptionKeyDown(e, lang.code)}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor:
                  lang.code === currentLanguage
                    ? 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))'
                    : 'transparent',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
              {lang.code === currentLanguage && (
                <span style={{ color: 'var(--tg-theme-button-color, hsl(var(--primary)))' }} aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Theme selector with options
 */
function ThemeSelector({
  currentTheme,
  onSelect,
  t,
}: {
  currentTheme: ThemeOption;
  onSelect: (theme: ThemeOption) => void;
  t: (key: keyof typeof translations.en) => string;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const themes: { code: ThemeOption; labelKey: keyof typeof translations.en }[] = [
    { code: 'light', labelKey: 'profile.theme.light' },
    { code: 'dark', labelKey: 'profile.theme.dark' },
    { code: 'auto', labelKey: 'profile.theme.auto' },
  ];

  const currentThemeLabel = themes.find((th) => th.code === currentTheme);

  const handleSelect = (theme: ThemeOption) => {
    onSelect(theme);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, theme: ThemeOption) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(theme);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('profile.theme')}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <SettingsRow
          label={t('profile.theme')}
          value={currentThemeLabel ? t(currentThemeLabel.labelKey) : currentTheme}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      {isOpen && (
        <div
          role="listbox"
          aria-label={t('profile.theme')}
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
            border: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            minWidth: '140px',
            overflow: 'hidden',
          }}
        >
          {themes.map((theme) => (
            <div
              key={theme.code}
              role="option"
              aria-selected={theme.code === currentTheme}
              tabIndex={0}
              onClick={() => handleSelect(theme.code)}
              onKeyDown={(e) => handleOptionKeyDown(e, theme.code)}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                backgroundColor:
                  theme.code === currentTheme
                    ? 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))'
                    : 'transparent',
              }}
            >
              <span>{t(theme.labelKey)}</span>
              {theme.code === currentTheme && (
                <span style={{ color: 'var(--tg-theme-button-color, hsl(var(--primary)))' }} aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Profile page for Telegram Mini App
 */
export function Profile({ language, t }: ProfileProps): React.ReactElement {
  const navigate = useNavigate();
  const { user: telegramUser, hapticFeedback, isWebApp } = useTelegramWebApp();
  const { user, unifiedUser, isTelegramUser } = useAuth();
  const {
    preferences,
    isLoading: prefsLoading,
    updatePreferences,
  } = useCloudStorage();

  // State
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({ analysesCount: 0, messagesCount: 0, creditsUsed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch credits function - extracted for reuse on Telegram link
  const fetchCredits = useCallback(async () => {
    try {
      setCreditsLoading(true);
      const result = await getUserCredits();
      setCredits(result);
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  // Fetch credits on mount
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Handler for when Telegram is successfully linked
  const handleTelegramLinked = useCallback(() => {
    // Refresh credits after linking (credits are merged on backend)
    fetchCredits();
  }, [fetchCredits]);

  // Fetch real stats from Supabase
  useEffect(() => {
    async function fetchStats() {
      try {
        setStatsLoading(true);
        const realStats = await getUserStats(unifiedUser?.id);
        setStats(realStats);
      } catch (error) {
        console.error('[Profile] Failed to fetch stats:', error);
        // Keep default values on error
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
  }, [unifiedUser?.id]);

  // Handlers
  const handleLanguageChange = useCallback(
    async (lang: Language) => {
      hapticFeedback.selection();
      await updatePreferences({ language: lang });
      // The language change will be reflected via preferences
    },
    [hapticFeedback, updatePreferences]
  );

  const handleThemeChange = useCallback(
    async (theme: ThemeOption) => {
      hapticFeedback.selection();
      await updatePreferences({ theme });
    },
    [hapticFeedback, updatePreferences]
  );

  const handleNotificationsToggle = useCallback(
    async (enabled: boolean) => {
      hapticFeedback.selection();
      await updatePreferences({ notificationsEnabled: enabled });
    },
    [hapticFeedback, updatePreferences]
  );

  const handleNavigateToCredits = useCallback(() => {
    hapticFeedback.impact('light');
    navigate('/profile/credits');
  }, [hapticFeedback, navigate]);

  const handleNavigateToHelp = useCallback(() => {
    hapticFeedback.impact('light');
    // Navigate to contacts page (in-app) instead of external link
    navigate('/contacts');
  }, [hapticFeedback, navigate]);

  const handleNavigateToAbout = useCallback(() => {
    hapticFeedback.impact('light');
    navigate('/terms');
  }, [hapticFeedback, navigate]);

  // Get user display info - support both Telegram and Web users
  const isWebUser = !isTelegramUser && !!user;
  const displayName = isWebUser
    ? (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || t('profile.title'))
    : (telegramUser?.first_name || unifiedUser?.display_name || t('profile.title'));
  const fullName = isWebUser
    ? displayName
    : (telegramUser ? `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}` : displayName);
  const username = isWebUser ? user?.email : telegramUser?.username;
  const isPremium = !isWebUser && telegramUser?.is_premium;
  const photoUrl = isWebUser ? user?.user_metadata?.avatar_url : telegramUser?.photo_url;

  // Calculate total credits
  const totalCredits = credits
    ? credits.basic_credits + credits.pro_credits + credits.cassandra_credits
    : 0;

  // App version (from package.json via vite.config.ts define)
  const appVersion = __APP_VERSION__ || '0.5.13';

  // Loading state
  if (prefsLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--background)))',
        }}
      >
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--background)))',
        paddingBottom: '80px', // Space for BottomNav
      }}
    >
      {/* User Info Section */}
      <div
        style={{
          backgroundColor: 'var(--tg-theme-bg-color, hsl(var(--card)))',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <UserAvatar photoUrl={photoUrl} name={fullName} size={72} />

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
              }}
            >
              {fullName}
            </h1>
            {isPremium && (
              <span
                style={{
                  color: '#FFD700',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Telegram Premium"
              >
                <StarIcon />
              </span>
            )}
          </div>
          {username && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
              }}
            >
              @{username}
            </p>
          )}
        </div>
      </div>

      {/* Balance Row */}
      <Card
        className="mx-4 mt-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleNavigateToCredits}
      >
        <CardContent className="p-4">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
              }}
            >
              {t('profile.balance')}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {creditsLoading ? (
                <LoaderIcon className="w-4 h-4 animate-spin" />
              ) : (
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  }}
                >
                  {totalCredits}
                </span>
              )}
              <ChevronRightIcon />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Preview */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-4">
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
            }}
          >
            {t('profile.statistics')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {statsLoading ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : (
                  stats.analysesCount
                )}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                  marginTop: '4px',
                }}
              >
                {t('profile.statistics.analyses')}
              </div>
            </div>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, hsl(var(--accent)))',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {statsLoading ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : (
                  stats.messagesCount
                )}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                  marginTop: '4px',
                }}
              >
                {t('profile.statistics.messages')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Section */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-4">
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
            }}
          >
            {t('profile.settings')}
          </h2>

          <LanguageSelector
            currentLanguage={preferences.language}
            onSelect={handleLanguageChange}
            t={t}
          />

          <ThemeSelector
            currentTheme={preferences.theme}
            onSelect={handleThemeChange}
            t={t}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
            }}
          >
            <span
              style={{
                color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                fontSize: '15px',
              }}
            >
              {t('profile.notifications')}
            </span>
            <Switch
              checked={preferences.notificationsEnabled}
              onCheckedChange={handleNotificationsToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Account Linking Section */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-4">
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
            }}
          >
            {t('profile.accountLinking')}
          </h2>

          {/* Show TelegramLinkPrompt for web users without linked Telegram */}
          {isWebUser && !unifiedUser?.is_telegram_linked && (
            <TelegramLinkPrompt
              language={language}
              t={t}
              onLinked={handleTelegramLinked}
              variant="inline"
            />
          )}

          {/* Telegram linked status - for Telegram users or web users with linked Telegram */}
          {(isTelegramUser || unifiedUser?.is_telegram_linked) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: isWebUser ? '1px solid var(--tg-theme-hint-color, hsl(var(--border)))' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </span>
                <span
                  style={{
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                    fontSize: '15px',
                  }}
                >
                  Telegram
                </span>
              </div>
              <span
                style={{
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <CheckIcon />
              </span>
            </div>
          )}

          {/* Email status for web users */}
          {isWebUser && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <span
                  style={{
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                    fontSize: '15px',
                  }}
                >
                  {user?.email || 'Email'}
                </span>
              </div>
              <span
                style={{
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <CheckIcon />
              </span>
            </div>
          )}

          {/* Email linking for Telegram users (not web users) */}
          {isTelegramUser && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderTop: '1px solid var(--tg-theme-hint-color, hsl(var(--border)))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <span
                  style={{
                    color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                    fontSize: '15px',
                  }}
                >
                  Email
                </span>
              </div>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--tg-theme-button-color, hsl(var(--primary)))',
                  backgroundColor: 'transparent',
                  color: 'var(--tg-theme-button-color, hsl(var(--primary)))',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  hapticFeedback.impact('light');
                  // TODO: Implement email linking
                }}
              >
                <PlusIcon />
                <span>Link</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help & About Section */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-4">
          <SettingsRow label={t('profile.help')} onClick={handleNavigateToHelp} />
          <SettingsRow label={t('profile.about')} onClick={handleNavigateToAbout} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
            }}
          >
            <span
              style={{
                color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                fontSize: '15px',
              }}
            >
              {t('profile.version')}
            </span>
            <span
              style={{
                fontSize: '14px',
                color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
              }}
            >
              v{appVersion}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Profile;
