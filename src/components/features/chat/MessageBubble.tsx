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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

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

    // Basic markdown support: **bold**, *italic*
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Match **bold** and *italic*
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let match;

    while ((match = regex.exec(sanitized)) !== null) {
      // Add text before match (escaped to prevent XSS)
      if (match.index > lastIndex) {
        parts.push(escapeHtml(sanitized.substring(lastIndex, match.index)));
      }

      // Add formatted text (escaped to prevent XSS)
      if (match[2]) {
        // **bold**
        parts.push(
          <strong key={`bold-${key++}`} style={{ fontWeight: 700 }}>
            {escapeHtml(match[2])}
          </strong>
        );
      } else if (match[3]) {
        // *italic*
        parts.push(
          <em key={`italic-${key++}`} style={{ fontStyle: 'italic' }}>
            {escapeHtml(match[3])}
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
                alt="User uploaded"
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
              Analysis Result
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
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          alignSelf: 'flex-end',
          borderBottomRightRadius: '4px',
        };

      case 'assistant':
        return {
          ...baseStyles,
          backgroundColor: 'hsl(var(--secondary))',
          color: 'hsl(var(--foreground))',
          alignSelf: 'flex-start',
          borderBottomLeftRadius: '4px',
        };

      case 'system':
        return {
          ...baseStyles,
          backgroundColor: 'hsl(var(--muted))',
          color: 'hsl(var(--muted-foreground))',
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
          color: 'hsl(var(--muted-foreground))',
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
