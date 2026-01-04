/**
 * DailyInsightCard Component
 *
 * Displays a daily insight teaser with coffee-themed gradient background.
 * Fetches personalized insights from API when available, falls back to
 * CloudStorage cache or static pool.
 * "Learn more" button:
 * - In Telegram Mini App: hidden (user can ask in native bot chat)
 * - On Web: navigates to in-app chat with insight context
 *
 * @module components/features/home/DailyInsightCard
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import type { DailyInsightCache } from '../../../hooks/useCloudStorage';
import { getInsightContent } from '../../../services/dailyInsightService';
import { useTelegramWebApp } from '../../../hooks/useTelegramWebApp';
import { supabase } from '../../../lib/supabaseClient';

/** API insight response */
interface InsightApiResponse {
  hasInsight: boolean;
  type: 'morning' | 'evening' | null;
  content: string | null;
  shortContent: string | null;
}

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
  const { isWebApp, hapticFeedback } = useTelegramWebApp();

  // State for API-fetched insight
  const [apiInsight, setApiInsight] = useState<{
    content: string;
    type: 'morning' | 'evening';
  } | null>(null);

  // Fetch personalized insight from API
  useEffect(() => {
    async function fetchInsight() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          return; // No auth, use static fallback
        }

        const response = await fetch('/api/insights/today', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          return; // API error, use static fallback
        }

        const data: InsightApiResponse = await response.json();

        if (data.hasInsight && data.content && data.type) {
          setApiInsight({
            content: data.content,
            type: data.type,
          });
        }
      } catch {
        // API fetch failed, use static fallback
      }
    }

    fetchInsight();
  }, []);

  // Use API content if available, otherwise fall back to static
  const staticContent = useMemo(() => {
    return getInsightContent(language, 'arina', dailyInsightCache);
  }, [language, dailyInsightCache]);

  const displayContent = apiInsight?.content || staticContent;

  // Truncate insight for teaser (first 100 chars)
  const teaserText = displayContent.length > 100
    ? displayContent.substring(0, 100) + '...'
    : displayContent;

  // Determine title and icon based on type
  const insightType = apiInsight?.type;
  const icon = insightType === 'evening' ? '\u{1F319}' : '\u2600\uFE0F'; // moon or sun
  const titleKey = insightType === 'evening' ? 'home.eveningInsight' :
                   insightType === 'morning' ? 'home.morningInsight' : 'home.dailyInsight';

  const handleLearnMore = () => {
    // On web, navigate to in-app chat with insight context
    navigate('/chat', {
      state: {
        initialMessage: displayContent,
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
            <span className="text-xl">{icon}</span>
            <h3 className="text-base font-semibold text-white">
              {t(titleKey)}
            </h3>
          </div>

          {/* Insight teaser */}
          <p className="text-sm text-white/90 leading-relaxed">
            {teaserText}
          </p>

          {/* Learn more button - hidden in WebApp mode */}
          {!isWebApp && (
            <Button
              onClick={handleLearnMore}
              variant="secondary"
              size="sm"
              className="self-start bg-white/20 hover:bg-white/30 text-white border-0"
              aria-label={t('home.dailyInsight.learnMore')}
            >
              {t('home.dailyInsight.learnMore')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const DailyInsightCard = React.memo(DailyInsightCardComponent);
