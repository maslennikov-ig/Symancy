import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChannelIndicator } from './ChannelIndicator';
import { translations, Lang } from '../../../lib/i18n';
import type { Message } from '../../../types/omnichannel';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<void>;
  isConnected: boolean;
  isLoading?: boolean;
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
  /** Whether running in Telegram Mini App context */
  isTelegramMiniApp?: boolean;
}

export function ChatWindow({
  messages,
  onSendMessage,
  isConnected,
  isLoading = false,
  language,
  t,
  isTelegramMiniApp = false,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    const container = messagesContainerRef.current;
    const endElement = messagesEndRef.current;

    if (!container || !endElement) return;

    // MED-3 FIX: Use percentage of viewport instead of hardcoded 100px
    const scrollThreshold = Math.max(100, container.clientHeight * 0.2);
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;

    if (isNearBottom) {
      endElement.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !isConnected) {
      return;
    }

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      await onSendMessage(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits, Shift+Enter adds new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        // Use Telegram theme color with fallback
        backgroundColor: 'var(--tg-bg-color, hsl(var(--background)))',
        position: 'relative',
      }}
    >
      {/* Connection warning banner */}
      {!isConnected && (
        <div
          className="chat-connection-warning"
          style={{
            // Compact padding in Telegram
            padding: isTelegramMiniApp ? '8px 12px' : '12px 16px',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 500,
            // Use Telegram theme colors with fallback
            backgroundColor: 'var(--tg-section-bg-color, #fef3c7)',
            color: 'var(--tg-section-header-text-color, #92400e)',
            borderBottom: '1px solid var(--tg-subtitle-text-color, #fde68a)',
          }}
        >
          {t('chat.connectionLost')}
        </div>
      )}

      {/* Messages list */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          // Compact padding in Telegram
          padding: isTelegramMiniApp ? '8px 0' : '16px 0',
          display: 'flex',
          flexDirection: 'column',
          // Add safe area padding at bottom for iOS
          paddingBottom: `calc(${isTelegramMiniApp ? '8px' : '16px'} + var(--tg-safe-area-bottom, 0px))`,
        }}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} t={t} />
        ))}

        {/* Typing indicator - LOW-4 FIX: Added accessibility attributes */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('chat.assistantTyping')}
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              padding: '4px 16px',
              margin: '4px 0',
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '16px',
                // Use Telegram theme colors with fallback
                backgroundColor: 'var(--tg-secondary-bg-color, hsl(var(--secondary)))',
                color: 'var(--tg-subtitle-text-color, hsl(var(--muted-foreground)))',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span className="typing-dot" style={{ animation: 'typing 1.4s infinite' }}>
                  •
                </span>
                <span
                  className="typing-dot"
                  style={{ animation: 'typing 1.4s infinite 0.2s' }}
                >
                  •
                </span>
                <span
                  className="typing-dot"
                  style={{ animation: 'typing 1.4s infinite 0.4s' }}
                >
                  •
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          // Compact padding in Telegram
          padding: isTelegramMiniApp ? '8px 12px' : '16px',
          // Add safe area padding at bottom for iOS home indicator
          paddingBottom: `calc(${isTelegramMiniApp ? '8px' : '16px'} + var(--tg-safe-area-bottom, 0px))`,
          borderTop: '1px solid var(--tg-hint-color, hsl(var(--border)))',
          // Use Telegram theme color with fallback
          backgroundColor: 'var(--tg-bg-color, hsl(var(--background)))',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            aria-label={t('chat.inputLabel')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.sendPlaceholder')}
            disabled={isSending || !isConnected}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '20px',
              border: '1px solid var(--tg-hint-color, hsl(var(--border)))',
              // Use Telegram theme colors with fallback
              backgroundColor: 'var(--tg-secondary-bg-color, hsl(var(--secondary)))',
              color: 'var(--tg-text-color, hsl(var(--foreground)))',
              fontSize: '1rem',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              minHeight: '44px',
              maxHeight: '120px',
              overflow: 'auto',
            }}
          />
          <button
            aria-label={t('chat.send')}
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || !isConnected}
            style={{
              padding: '12px 24px',
              borderRadius: '20px',
              border: 'none',
              // Use Telegram theme colors with fallback
              backgroundColor:
                !inputValue.trim() || isSending || !isConnected
                  ? 'var(--tg-hint-color, hsl(var(--muted)))'
                  : 'var(--tg-button-color, hsl(var(--primary)))',
              color: 'var(--tg-button-text-color, #fff)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor:
                !inputValue.trim() || isSending || !isConnected
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isSending ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid transparent',
                    borderTopColor: 'var(--tg-button-text-color, white)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>{t('chat.sending')}</span>
              </>
            ) : (
              '→'
            )}
          </button>
        </div>
      </div>

      {/* Typing animation and connection warning styles */}
      <style>
        {`
          @keyframes typing {
            0%, 60%, 100% {
              opacity: 0.3;
              transform: scale(1);
            }
            30% {
              opacity: 1;
              transform: scale(1.2);
            }
          }

          /* MED-2 FIX: Moved from useEffect injection */
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* LOW-6 FIX: Connection warning with dark mode support */
          .chat-connection-warning {
            background-color: #fef3c7;
            color: #92400e;
            border-bottom: 1px solid #fde68a;
          }

          .dark .chat-connection-warning {
            background-color: rgba(120, 53, 15, 0.3);
            color: #fcd34d;
            border-bottom: 1px solid rgba(252, 211, 77, 0.3);
          }
        `}
      </style>
    </div>
  );
}
