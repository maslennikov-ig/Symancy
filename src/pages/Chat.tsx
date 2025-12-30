import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChatWindow } from '../components/features/chat/ChatWindow';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { translations, Lang, t as i18n_t } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import { LoaderIcon } from '../components/icons/LoaderIcon';
import { getStoredToken } from '../services/authService';
import { TelegramLinkPrompt } from '../components/features/auth/TelegramLinkPrompt';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';

interface ChatProps {
  language?: Lang;
  t?: (key: keyof typeof translations.en) => string;
}

/**
 * Chat page - full-screen chat interface with realtime messaging
 *
 * Features:
 * - Get conversationId from URL params or localStorage
 * - Create new conversation if none exists
 * - Use useRealtimeChat hook for messages and sendMessage
 * - Full-height layout with header and chat window
 *
 * URL: /chat?conversation=<uuid>
 */
const Chat: React.FC<ChatProps> = ({ language: propLanguage, t: propT }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, unifiedUser, isTelegramUser, session } = useAuth();

  // Detect if running in Telegram Mini App and get viewport height
  const { isWebApp: isTelegramMiniApp, viewportHeight } = useTelegramWebApp();

  const language = propLanguage || 'ru';
  const t = propT || ((key: keyof typeof translations.en) => i18n_t(key, language));

  // Show Telegram link prompt for web-only users (not already dismissed)
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(() => {
    // Only show for authenticated, non-Telegram users who haven't dismissed
    const dismissed = localStorage.getItem('telegramLinkPromptDismissed') === 'true';
    return !dismissed;
  });

  // Determine if user is a web-only user (authenticated but not via Telegram)
  const isWebOnlyUser = user && !isTelegramUser;

  // Get or create conversation ID
  const [conversationId, setConversationId] = useState<string | null>(
    searchParams.get('conversation') || localStorage.getItem('activeConversationId')
  );
  const [isLoading, setIsLoading] = useState(!conversationId);
  const [error, setError] = useState<string | null>(null);

  // Compute auth token - custom JWT for Telegram users, or Supabase session token for web users
  const authToken = isTelegramUser
    ? getStoredToken() || undefined
    : session?.access_token || undefined;

  // Create conversation if needed
  useEffect(() => {
    if (!conversationId && (user || unifiedUser)) {
      createConversation();
    }
  }, [conversationId, user, unifiedUser]);

  const createConversation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const endpoint = `${apiUrl}/api/conversations`;

      const token = authToken;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          persona: 'arina', // Default persona
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Failed to create conversation',
        }));
        throw new Error(errorData.message || 'Failed to create conversation');
      }

      const conversation = await response.json();
      setConversationId(conversation.id);
      localStorage.setItem('activeConversationId', conversation.id);

      // Update URL with conversation ID
      navigate(`/chat?conversation=${conversation.id}`, { replace: true });
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // Use realtime chat hook
  const {
    messages,
    sendMessage,
    isConnected,
    error: chatError,
  } = useRealtimeChat(conversationId || '', authToken);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!conversationId) return;
      await sendMessage(content, 'browser');
    },
    [conversationId, sendMessage]
  );

  // Show loading state if creating conversation
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t('chat.loading')}</p>
      </div>
    );
  }

  // Show error if conversation creation failed
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-6 rounded-lg border border-red-300 dark:border-red-700 max-w-md">
          <p className="font-bold mb-2">{t('error.title')}</p>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('pricing.button.return')}
          </button>
        </div>
      </div>
    );
  }

  // Show error if chat hook failed
  if (chatError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-6 rounded-lg border border-red-300 dark:border-red-700 max-w-md">
          <p className="font-bold mb-2">{t('error.title')}</p>
          <p className="mb-4">{chatError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('error.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-background"
      style={{
        // Use full viewport in Telegram, h-screen otherwise
        height: isTelegramMiniApp
          ? `${viewportHeight || window.innerHeight}px`
          : '100vh',
      }}
    >
      {/* Header - hide in Telegram Mini App (Telegram shows its own) */}
      {!isTelegramMiniApp && (
        <header className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="text-2xl text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-accent"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-semibold text-foreground">{t('chat.title')}</h1>
        </header>
      )}

      {/* Telegram Link Prompt for web-only users - never show in Telegram Mini App */}
      {!isTelegramMiniApp && isWebOnlyUser && showTelegramPrompt && (
        <div className="px-4 py-2 bg-accent/30">
          <TelegramLinkPrompt
            language={language}
            t={t}
            variant="inline"
            onDismiss={() => setShowTelegramPrompt(false)}
            onLinked={() => {
              setShowTelegramPrompt(false);
              // Optionally refresh to update auth state
            }}
          />
        </div>
      )}

      {/* Chat window - takes remaining space */}
      <div className="flex-1 min-h-0">
        <ChatWindow
          messages={messages}
          onSendMessage={handleSendMessage}
          isConnected={isConnected}
          isLoading={false}
          language={language}
          t={t}
          isTelegramMiniApp={isTelegramMiniApp}
        />
      </div>
    </div>
  );
};

export default Chat;
