/**
 * DailyInsightCard Component
 *
 * Displays a daily insight teaser with coffee-themed gradient background.
 * Uses CloudStorage cache if available for the insight content.
 * "Learn more" button:
 * - In Telegram Mini App: closes app to return to native bot chat
 * - On Web: navigates to in-app chat with insight context
 *
 * @module components/features/home/DailyInsightCard
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import type { DailyInsightCache } from '../../../hooks/useCloudStorage';
import { getInsightContent } from '../../../services/dailyInsightService';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';

interface DailyInsightCardProps {
  /** Translation function */
  t: (key: string) => string;
  /** Current language code */
  language: 'ru' | 'en' | 'zh';
  /** Cached daily insight from CloudStorage */
  dailyInsightCache: DailyInsightCache | null;
  /** Optional className for container */
  className?: string;
}


/**
 * DailyInsightCard - Daily insight teaser with gradient background
 */
function DailyInsightCardComponent({
  t,
  language,
  dailyInsightCache,
  className,
}: DailyInsightCardProps) {
  const navigate = useNavigate();
  const { isWebApp, close, hapticFeedback } = useTelegramWebApp();

  // Use cached insight if valid, or generate new one using the service
  const insightContent = useMemo(() => {
    return getInsightContent(language, 'arina', dailyInsightCache);
  }, [language, dailyInsightCache]);

  // Truncate insight for teaser (first 100 chars)
  const teaserText = insightContent.length > 100
    ? insightContent.substring(0, 100) + '...'
    : insightContent;

  const handleLearnMore = () => {
    if (isWebApp) {
      // In Telegram Mini App, close to return to native bot chat
      // User can ask about the insight directly in Telegram
      hapticFeedback.impact('light');
      close();
      return;
    }
    // On web, navigate to in-app chat with insight context
    navigate('/chat', {
      state: {
        initialMessage: insightContent,
        context: 'daily_insight',
      },
    });
  };

  return (
    <Card
      className={cn(
        'w-full overflow-hidden',
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #D2691E 100%)',
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-xl">&#9749;</span>
            <h3 className="text-base font-semibold text-white">
              {t('home.dailyInsight')}
            </h3>
          </div>

          {/* Insight teaser */}
          <p className="text-sm text-white/90 leading-relaxed">
            {teaserText}
          </p>

          {/* Learn more button */}
          <Button
            onClick={handleLearnMore}
            variant="secondary"
            size="sm"
            className="self-start bg-white/20 hover:bg-white/30 text-white border-0"
            aria-label={t('home.dailyInsight.learnMore')}
          >
            {t('home.dailyInsight.learnMore')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export const DailyInsightCard = React.memo(DailyInsightCardComponent);
