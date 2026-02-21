import React from 'react';
import DOMPurify from 'dompurify';
import type { Message } from '../../../types/omnichannel';
import { ChannelIndicator } from './ChannelIndicator';
import { translations } from '../../../lib/i18n';

interface ImageMessageMetadata {
  telegram_file_id?: string;
  telegram_file_unique_id?: string;
  image_url?: string;
  image_storage_path?: string;
  analysis_id?: string;
}

interface MessageBubbleProps {
  message: Message;
  showChannelIndicator?: boolean;
  t: (key: keyof typeof translations.en) => string;
}

export function MessageBubble({ message, showChannelIndicator = false, t }: MessageBubbleProps) {
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);

    // HIGH-2 FIX: Guard against invalid dates
    if (isNaN(date.getTime())) {
      return t('time.invalidDate');
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // HIGH-2 FIX: Guard against negative time (future dates)
    if (diffMs < 0) {
      return t('time.future');
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // HIGH-3 FIX: Use i18n translations instead of hardcoded English
    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return t('time.minutesAgo').replace('{n}', String(diffMins));
    if (diffHours < 24) return t('time.hoursAgo').replace('{n}', String(diffHours));
    if (diffDays < 7) return t('time.daysAgo').replace('{n}', String(diffDays));

    // Fallback to HH:MM
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Security: HIGH-4 FIX - HTML escape function to prevent XSS attacks
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const renderTextContent = (text: string): React.ReactNode => {
    // Security: HIGH-4 FIX - Sanitize content to prevent XSS attacks
    // DOMPurify removes all HTML tags and dangerous content, leaving only plain text
    const sanitized = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
    });

    // Basic markdown and HTML support: **bold**, *italic*, <b>bold</b>, <i>italic</i>
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Match **bold**, *italic*, <b>bold</b>, <i>italic</i>, <strong>bold</strong>, <em>italic</em>
    // We match literal HTML or escaped HTML since it might come from DOMPurify
    const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|<b>(.*?)<\/b>|&lt;b&gt;(.*?)&lt;\/b&gt;|<i>(.*?)<\/i>|&lt;i&gt;(.*?)&lt;\/i&gt;|<strong>(.*?)<\/strong>|&lt;strong&gt;(.*?)&lt;\/strong&gt;|<em>(.*?)<\/em>|&lt;em&gt;(.*?)&lt;\/em&gt;)/gi;
    let match;

    while ((match = regex.exec(sanitized)) !== null) {
      // Add text before match (escaped to prevent XSS)
      if (match.index > lastIndex) {
        parts.push(escapeHtml(sanitized.substring(lastIndex, match.index)));
      }

      // Add formatted text (escaped to prevent XSS)
      // group 2 = **bold**, group 3 = *italic*
      // group 4 = <b>, group 5 = &lt;b&gt;, group 6 = <i>, group 7 = &lt;i&gt;
      // group 8 = <strong>, group 9 = &lt;strong&gt;, group 10 = <em>, group 11 = &lt;em&gt;
      const boldText = match[2] || match[4] || match[5] || match[8] || match[9];
      const italicText = match[3] || match[6] || match[7] || match[10] || match[11];

      if (boldText) {
        parts.push(
          <strong key={`bold-${key++}`} style={{ fontWeight: 700 }}>
            {escapeHtml(boldText)}
          </strong>
        );
      } else if (italicText) {
        parts.push(
          <em key={`italic-${key++}`} style={{ fontStyle: 'italic' }}>
            {escapeHtml(italicText)}
          </em>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text (escaped to prevent XSS)
    if (lastIndex < sanitized.length) {
      parts.push(escapeHtml(sanitized.substring(lastIndex)));
    }

    return parts.length > 0 ? parts : escapeHtml(sanitized);
  };

  const renderContent = () => {
    switch (message.content_type) {
      case 'text':
        return (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderTextContent(message.content)}
          </div>
        );

      case 'image': {
        const metadata = message.metadata as ImageMessageMetadata | undefined;
        const imageUrl = metadata?.image_url;

        return (
          <div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={t('chat.userUploadedImage')}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: 'calc(var(--radius-md) * 0.75)',
                  marginBottom: '8px',
                  objectFit: 'contain',
                }}
              />
            )}
            {message.content && (
              <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderTextContent(message.content)}
              </div>
            )}
          </div>
        );
      }

      case 'analysis':
        return (
          <div
            style={{
              padding: '12px',
              borderRadius: 'calc(var(--radius-md) * 0.75)',
              backgroundColor: 'hsl(var(--accent))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {t('chat.analysisResult')}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {renderTextContent(message.content)}
            </div>
          </div>
        );

      default:
        return (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        );
    }
  };

  const getBubbleStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      maxWidth: '80%',
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      fontSize: '14px',
      lineHeight: '1.5',
      wordWrap: 'break-word',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    };

    switch (message.role) {
      case 'user':
        return {
          ...baseStyles,
          // Use Telegram theme colors with fallback to our CSS variables
          backgroundColor: 'var(--tg-button-color, hsl(var(--primary)))',
          color: 'var(--tg-button-text-color, hsl(var(--primary-foreground)))',
          alignSelf: 'flex-end',
          borderBottomRightRadius: '4px',
        };

      case 'assistant':
        return {
          ...baseStyles,
          // Use Telegram theme colors with fallback to our CSS variables
          backgroundColor: 'var(--tg-secondary-bg-color, hsl(var(--secondary)))',
          color: 'var(--tg-text-color, hsl(var(--foreground)))',
          alignSelf: 'flex-start',
          borderBottomLeftRadius: '4px',
        };

      case 'system':
        return {
          ...baseStyles,
          // Use Telegram theme colors with fallback to our CSS variables
          backgroundColor: 'var(--tg-section-bg-color, hsl(var(--muted)))',
          color: 'var(--tg-subtitle-text-color, hsl(var(--muted-foreground)))',
          alignSelf: 'center',
          fontSize: '13px',
          fontStyle: 'italic',
          maxWidth: '90%',
          textAlign: 'center',
          borderRadius: 'calc(var(--radius-md) * 0.75)',
        };

      default:
        return baseStyles;
    }
  };

  const getContainerStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      marginBottom: '12px',
      paddingLeft: '8px',
      paddingRight: '8px',
    };

    switch (message.role) {
      case 'user':
        return {
          ...baseStyles,
          alignItems: 'flex-end',
        };

      case 'assistant':
        return {
          ...baseStyles,
          alignItems: 'flex-start',
        };

      case 'system':
        return {
          ...baseStyles,
          alignItems: 'center',
        };

      default:
        return baseStyles;
    }
  };

  return (
    <div style={getContainerStyles()}>
      <div style={getBubbleStyles()}>
        {renderContent()}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px',
          fontSize: '11px',
          // Use Telegram theme colors with fallback
          color: 'var(--tg-subtitle-text-color, hsl(var(--muted-foreground)))',
        }}
      >
        <span>{formatTimestamp(message.created_at)}</span>

        {showChannelIndicator && (message.channel === 'telegram' || message.channel === 'web') && (
          <ChannelIndicator channel={message.channel} t={t} />
        )}
      </div>
    </div>
  );
}
