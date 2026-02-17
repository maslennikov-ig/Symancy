import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getScoreColor } from '../../lib/moodUtils';
import type { MoodEntry } from '../../types/mood';

interface MoodTrendChartProps {
  entries: MoodEntry[];
  t: (key: string) => string;
}

interface ChartDataPoint {
  date: string;
  score: number;
  fullDate: string;
}

const PRIMARY_COLOR = 'hsl(262, 83%, 58%)';

function MoodTrendChartComponent({ entries, t }: MoodTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [themeColors, setThemeColors] = useState({
    text: '#888',
    textMuted: '#aaa',
    gridStroke: '#e5e5e5',
    cardBg: '#fff',
    border: '#e5e5e5',
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    setThemeColors({
      text: styles.getPropertyValue('--color-foreground').trim() || styles.color || '#888',
      textMuted: styles.getPropertyValue('--color-muted-foreground').trim() || '#aaa',
      gridStroke: styles.getPropertyValue('--color-border').trim() || '#e5e5e5',
      cardBg: styles.getPropertyValue('--color-card').trim() || '#fff',
      border: styles.getPropertyValue('--color-border').trim() || '#e5e5e5',
    });
  }, []);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (entries.length === 0) return [];

    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return sorted.map((entry) => {
      const d = new Date(entry.date + 'T00:00:00');
      return {
        date: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        score: entry.score,
        fullDate: entry.date,
      };
    });
  }, [entries]);

  const avgScore = useMemo(() => {
    if (entries.length === 0) return 0;
    return entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {t('mood.insights.trendTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('mood.insights.noData')}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('mood.insights.trendTitle')}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('mood.insights.period30')}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="moodScoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.4} />
              <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={themeColors.gridStroke}
            opacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: themeColors.textMuted }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[1, 10]}
            tick={{ fontSize: 10, fill: themeColors.textMuted }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const data = payload[0].payload as ChartDataPoint;
              return (
                <div
                  className="bg-card border border-border rounded-lg shadow-lg px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">{data.date}</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: getScoreColor(data.score) }}
                  >
                    {data.score}/10
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={avgScore}
            stroke={themeColors.textMuted}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{
              value: `${t('mood.insights.avgLabel')}: ${avgScore.toFixed(1)}`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: themeColors.textMuted,
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={PRIMARY_COLOR}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#moodScoreGradient)"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: ChartDataPoint;
              };
              return (
                <circle
                  key={`dot-${payload.fullDate}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={getScoreColor(payload.score)}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{
              r: 5,
              stroke: PRIMARY_COLOR,
              strokeWidth: 2,
              fill: '#fff',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const MoodTrendChart = React.memo(MoodTrendChartComponent);
