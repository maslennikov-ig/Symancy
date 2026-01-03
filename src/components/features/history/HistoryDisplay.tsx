import React, { useState, useEffect } from 'react';
import { getHistory, HistoryItem } from '../../../services/historyService';
import { Button } from '../../ui/button';
import { Lang } from '../../../lib/i18n';
import { HistoryItemSkeleton } from './HistoryItemSkeleton';

interface HistoryDisplayProps {
  onSelectAnalysis: (item: HistoryItem) => void;
  t: (key: string) => string;
  language: Lang;
  /** Optional callback when closing history view (for web version) */
  onClose?: () => void;
}

const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ onSelectAnalysis, t, language }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {history.map((item) => (
        <div
          key={item.id}
          className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => onSelectAnalysis(item)}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">
                {getFocusAreaTranslation(item.focus_area)}
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
              <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                {item.analysis.intro}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnalysis(item);
              }}
            >
              →
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryDisplay;
