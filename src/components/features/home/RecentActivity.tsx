/**
 * RecentActivity Component
 *
 * Shows the last analysis or conversation summary.
 * "Open" button to view details.
 * Shows "No activity yet" if empty.
 *
 * @module components/features/home/RecentActivity
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { getHistory, HistoryItem } from '../../../services/historyService';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../contexts/AuthContext';

interface RecentActivityProps {
  /** Translation function */
  t: (key: string) => string;
  /** Optional className for container */
  className?: string;
}

/**
 * Format relative time (e.g., "2 hours ago", "yesterday")
 */
function formatRelativeTime(dateString: string, t: (key: string) => string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return t('time.justNow') || 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * RecentActivity - Last activity card
 */
function RecentActivityComponent({ t, className }: RecentActivityProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [lastItem, setLastItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecentActivity() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const history = await getHistory();
        setLastItem(history.length > 0 ? history[0] : null);
      } catch (err) {
        console.error('Failed to fetch recent activity:', err);
        // Don't show error state for history - just show empty
        setLastItem(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRecentActivity();
  }, [isAuthenticated]);

  const handleOpen = () => {
    if (lastItem) {
      // Navigate to history detail
      navigate('/history', {
        state: {
          selectedAnalysis: lastItem,
        },
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-4 flex items-center justify-center">
          <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!lastItem) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            {t('home.recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <span className="text-3xl mb-2">&#9749;</span>
            <p className="text-sm text-muted-foreground">
              {t('home.recentActivity.empty')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get analysis summary - AnalysisResponse has intro and sections
  const analysisSummary = lastItem.analysis?.intro?.substring(0, 80) ||
    (lastItem.analysis?.sections?.[0]?.content?.substring(0, 80)) ||
    lastItem.focus_area ||
    t('home.recentActivity.analysisCompleted');

  const timeAgo = formatRelativeTime(lastItem.created_at, t);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span>{t('home.recentActivity')}</span>
          <span className="text-xs text-muted-foreground font-normal">{timeAgo}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-start gap-3">
          {/* Activity icon */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">&#128302;</span>
          </div>

          {/* Activity content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {lastItem.focus_area || t('home.recentActivity.defaultTitle')}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {analysisSummary}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 pb-3 px-3">
        <Button onClick={handleOpen} variant="outline" size="sm" className="w-full font-medium shadow-sm hover:bg-accent/50">
          {t('home.recentActivity.open')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export const RecentActivity = React.memo(RecentActivityComponent);
