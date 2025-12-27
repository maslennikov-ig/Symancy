import React, { useState, useEffect } from 'react';
import { getHistory, HistoryItem } from '../../../services/historyService';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { ScrollArea } from '../../ui/scroll-area';
import { Lang } from '../../../lib/i18n';
import { HistoryItemSkeleton } from './HistoryItemSkeleton';

interface HistoryDisplayProps {
  onSelectAnalysis: (item: HistoryItem) => void;
  onClose: () => void;
  t: (key: string) => string;
  language: Lang;
}

const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ onSelectAnalysis, onClose, t, language }) => {
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <ScrollArea className="h-[60vh] p-1">
            <div className="space-y-4 p-3">
                <HistoryItemSkeleton />
                <HistoryItemSkeleton />
                <HistoryItemSkeleton />
            </div>
        </ScrollArea>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-700 dark:text-red-400 p-4">
          <p>{error}</p>
        </div>
      );
    }

    if (history.length === 0) {
      return (
        <div className="text-center p-8">
          <h3 className="text-xl font-semibold">{t('history.empty.title')}</h3>
          <p className="text-muted-foreground mt-2">{t('history.empty.subtitle')}</p>
        </div>
      );
    }

    return (
        <ScrollArea className="h-[60vh] p-1">
            <div className="space-y-4 p-3">
                {history.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg bg-background/50 hover:bg-accent/50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="w-full overflow-hidden">
                                <p className="text-sm font-semibold text-primary truncate">
                                    {`${t('history.focusAreaLabel')}: ${getFocusAreaTranslation(item.focus_area)}`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(item.created_at).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                </p>
                                <p className="text-sm text-foreground/80 mt-3 line-clamp-2">
                                    {item.analysis.intro}
                                </p>
                            </div>
                             <Button size="sm" variant="outline" className="ml-4 flex-shrink-0" onClick={() => onSelectAnalysis(item)}>
                                {t('history.viewAnalysis')}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
  };

  return (
    <Card className="w-full shadow-2xl transition-all duration-500 backdrop-blur-xl bg-card/70">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-2xl font-display">{t('history.title')}</CardTitle>
                <CardDescription>{t('header.subtitle')}</CardDescription>
            </div>
            <Button variant="ghost" onClick={onClose}>{t('history.back')}</Button>
        </CardHeader>
        <CardContent>
            {renderContent()}
        </CardContent>
    </Card>
  );
};

export default HistoryDisplay;