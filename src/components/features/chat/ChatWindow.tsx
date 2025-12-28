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
}

export function ChatWindow({
  messages,
  onSendMessage,
  isConnected,
  isLoading = false,
  language,
  t,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Inject spinner keyframes for button animation
  useEffect(() => {
    if (!document.getElementById('spinner-keyframes')) {
      const style = document.createElement('style');
      style.id = 'spinner-keyframes';
      style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  }, []);

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
        backgroundColor: 'var(--color-bg-primary)',
        position: 'relative',
      }}
    >
      {/* Connection warning banner */}
      {!isConnected && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderBottom: '1px solid #fde68a',
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
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} t={t} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div
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
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
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
          padding: '16px',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-primary)',
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
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
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
              backgroundColor:
                !inputValue.trim() || isSending || !isConnected
                  ? 'var(--color-bg-tertiary)'
                  : 'var(--color-accent)',
              color: '#fff',
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
                    borderTopColor: 'white',
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

      {/* Typing animation styles */}
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
        `}
      </style>
    </div>
  );
}
