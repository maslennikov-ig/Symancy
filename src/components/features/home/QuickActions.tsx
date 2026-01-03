/**
 * QuickActions Component
 *
 * Two large action buttons for quick access to main features:
 * - New Analysis: Camera icon, navigates to analysis/chat with photo upload
 * - Start Chat: Chat icon, navigates to chat
 *
 * Includes haptic feedback on tap for Telegram Mini App.
 *
 * @module components/features/home/QuickActions
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';

interface QuickActionsProps {
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * Camera Icon SVG
 */
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

/**
 * Chat Icon SVG
 */
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/**
 * QuickActions - Two side-by-side action buttons
 */
function QuickActionsComponent({ t, className }: QuickActionsProps) {
  const navigate = useNavigate();
  const { hapticFeedback, isWebApp, close } = useTelegramWebApp();

  const handleNewAnalysis = () => {
    // Trigger haptic feedback on Telegram
    if (isWebApp) {
      hapticFeedback.impact('medium');
      // In Telegram Mini App, close to return to bot chat for photo upload
      close();
      return;
    }
    // On web, navigate to chat with camera intent
    navigate('/chat', {
      state: {
        openCamera: true,
        context: 'new_analysis',
      },
    });
  };

  const handleStartChat = () => {
    // Trigger haptic feedback on Telegram
    if (isWebApp) {
      hapticFeedback.impact('light');
      // In Telegram Mini App, close to return to native bot chat
      close();
      return;
    }
    // On web, navigate to in-app chat
    navigate('/chat');
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-2 gap-3">
        {/* New Analysis Button */}
        <Button
          onClick={handleNewAnalysis}
          variant="outline"
          className="h-auto py-4 px-3 flex flex-col items-center gap-2 bg-card hover:bg-accent"
          aria-label={t('home.newAnalysis')}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <CameraIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {t('home.newAnalysis')}
          </span>
        </Button>

        {/* Start Chat Button */}
        <Button
          onClick={handleStartChat}
          variant="outline"
          className="h-auto py-4 px-3 flex flex-col items-center gap-2 bg-card hover:bg-accent"
          aria-label={t('home.startChat')}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <ChatIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {t('home.startChat')}
          </span>
        </Button>
      </div>
    </div>
  );
}

export const QuickActions = React.memo(QuickActionsComponent);
