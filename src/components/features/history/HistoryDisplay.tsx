import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHistory, HistoryItem } from '../../../services/historyService';
import { Button } from '../../ui/button';
import { Lang } from '../../../lib/i18n';
import { HistoryItemSkeleton } from './HistoryItemSkeleton';

// Helper function to convert simple HTML tags to Markdown
const parseHtmlToMarkdown = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/gi, '**$1**')
    .replace(/&lt;strong&gt;([\s\S]*?)&lt;\/strong&gt;/gi, '**$1**')
    .replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/gi, '*$1*')
    .replace(/&lt;em&gt;([\s\S]*?)&lt;\/em&gt;/gi, '*$1*')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n');
};

/**
 * Strip HTML tags and markdown asterisks for plain text preview
 */
function stripHtmlAndMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>?/gm, '') // Strip literal HTML tags
    .replace(/&lt;[^&]*&gt;/gm, '') // Strip escaped HTML tags
    .replace(/\*\*/g, '') // Strip bold markdown
    .replace(/\*/g, ''); // Strip italic markdown
}

interface HistoryDisplayProps {
  t: (key: string) => string;
  language: Lang;
  initialExpandedId?: string | null;
}

const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ t, language, initialExpandedId }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId || null);

  useEffect(() => {
    if (initialExpandedId) {
      setExpandedId(initialExpandedId);
    }
  }, [initialExpandedId]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const historyData = await getHistory();
        setHistory(historyData);
      } catch (err) {
        setError(t('history.error'));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [t]);

  const getFocusAreaTranslation = (focusArea: string) => {
    const key = `imageReady.focus.${focusArea}` as const;
    return t(key);
  }

  const getSourceIcon = (source: 'telegram' | 'web') => {
    return source === 'telegram' ? '📱' : '🌐';
  }

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedId(prev => prev === id ? null : id);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <HistoryItemSkeleton />
        <HistoryItemSkeleton />
        <HistoryItemSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-foreground">
          {t('history.empty.title')}
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('history.empty.subtitle')}
        </p>
      </div>
    );
  }

  // History list
  return (
    <div className="space-y-3">
      {history.map((item) => {
        const isExpanded = expandedId === item.id;
        // Preview text for collapsed state
        const rawPreview = item.analysis.intro || item.analysis.sections?.[0]?.content || '';
        const previewText = stripHtmlAndMarkdown(rawPreview);
        
        return (
          <div
            key={item.id}
            className={`p-4 border rounded-lg transition-colors cursor-pointer ${
              isExpanded ? 'bg-card border-primary/50 shadow-sm' : 'bg-card hover:bg-accent/50'
            }`}
            onClick={(e) => toggleExpand(item.id, e)}
          >
            {/* Header (Always visible) */}
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                  <span>{getSourceIcon(item.source)}</span>
                  <span>{getFocusAreaTranslation(item.focus_area)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.created_at).toLocaleDateString(language, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                
                {/* Collapsed Preview */}
                {!isExpanded && (
                  <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                    {previewText}
                  </p>
                )}
              </div>
              
              {/* Expand Toggle Button */}
              <Button
                size="sm"
                variant="ghost"
                className={`flex-shrink-0 transition-transform duration-200 text-muted-foreground hover:text-foreground hover:bg-transparent ${
                  isExpanded ? 'rotate-90' : ''
                }`}
                onClick={(e) => toggleExpand(item.id, e)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                →
              </Button>
            </div>

            {/* Expanded Content (Markdown Analysis) */}
            {isExpanded && (
              <div 
                className="mt-4 pt-4 border-t border-border animate-fade-in-up"
                onClick={(e) => e.stopPropagation()} // Prevent collapse when interacting with content
              >
                <div className="font-sans text-foreground leading-relaxed prose prose-sm sm:prose dark:prose-invert prose-stone max-w-none">
                  {item.analysis.intro && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {parseHtmlToMarkdown(item.analysis.intro)}
                    </ReactMarkdown>
                  )}
                  {item.analysis.sections?.map((section, index) => (
                    <div key={index} className="mt-6">
                      <h3 className="font-display text-base font-bold text-foreground mb-2">
                        {section.title}
                      </h3>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {parseHtmlToMarkdown(section.content)}
                      </ReactMarkdown>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HistoryDisplay;
