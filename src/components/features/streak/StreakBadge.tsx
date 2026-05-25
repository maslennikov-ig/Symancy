/**
 * StreakBadge Component
 *
 * Displays the user's current daily-usage streak (🔥 N days) on the Profile
 * screen. Reads from the `user_streaks` table via streakService.
 *
 * Feature: Streak tracker (sym-tb3, gamification).
 *
 * Theming: uses Telegram theme CSS variables with hsl(var(--...)) fallbacks so
 * it renders correctly in both light and dark themes.
 *
 * i18n: expects the following keys (added separately to src/lib/i18n.ts):
 *   - streak.title
 *   - streak.days       (interpolated with {count})
 *   - streak.best       (interpolated with {count})
 *   - streak.empty
 *
 * @module components/features/streak/StreakBadge
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { LoaderIcon } from '../../icons/LoaderIcon';
import { getUserStreak, type UserStreak } from '../../../services/streakService';
import type { translations } from '../../../lib/i18n';

interface StreakBadgeProps {
  /** Unified user id (for Telegram users); optional for Supabase Auth users */
  unifiedUserId?: string;
  /**
   * Translation function. Uses the same narrow key type as the rest of the
   * app (keyof translations.en). The `streak.*` keys are added to i18n.ts
   * separately — until then, the calls below will report "missing key" type
   * errors only.
   */
  t: (key: keyof typeof translations.en) => string;
  /** Optional className passthrough */
  className?: string;
}

/**
 * Replace a {count} placeholder in a translated string.
 */
function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

function StreakBadgeComponent({
  unifiedUserId,
  t,
  className,
}: StreakBadgeProps): React.ReactElement {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const result = await getUserStreak(unifiedUserId);
        if (!cancelled) {
          setStreak(result);
        }
      } catch {
        if (!cancelled) {
          setStreak(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [unifiedUserId]);

  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const hasStreak = current > 0;

  return (
    <Card className={className ?? 'mx-4 mt-3'}>
      <CardContent className="p-4">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              aria-hidden="true"
              style={{
                fontSize: '28px',
                lineHeight: 1,
                // Dim the flame when there's no active streak yet.
                filter: hasStreak ? 'none' : 'grayscale(1)',
                opacity: hasStreak ? 1 : 0.5,
              }}
            >
              🔥
            </span>
            <div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                }}
              >
                {t('streak.title')}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--tg-theme-text-color, hsl(var(--foreground)))',
                  minHeight: '22px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isLoading ? (
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                ) : hasStreak ? (
                  withCount(t('streak.days'), current)
                ) : (
                  t('streak.empty')
                )}
              </div>
            </div>
          </div>

          {!isLoading && longest > 0 && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--tg-theme-hint-color, hsl(var(--muted-foreground)))',
                textAlign: 'right',
                whiteSpace: 'nowrap',
              }}
            >
              {withCount(t('streak.best'), longest)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Memoized StreakBadge to avoid unnecessary re-renders in the Profile screen.
 */
export const StreakBadge = React.memo(StreakBadgeComponent);

export default StreakBadge;
