import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  isLoading?: boolean;
}

const variantStyles = {
  blue: {
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accentBar: 'bg-gradient-to-r from-blue-500 to-blue-400',
  },
  violet: {
    gradient: 'from-violet-500/10 via-violet-500/5 to-transparent dark:from-violet-500/20 dark:via-violet-500/10',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    accentBar: 'bg-gradient-to-r from-violet-500 to-violet-400',
  },
  emerald: {
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accentBar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  },
  amber: {
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentBar: 'bg-gradient-to-r from-amber-500 to-amber-400',
  },
  rose: {
    gradient: 'from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-500/20 dark:via-rose-500/10',
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    accentBar: 'bg-gradient-to-r from-rose-500 to-rose-400',
  },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'blue',
  isLoading = false,
}: StatsCardProps) {
  const styles = variantStyles[variant];

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20">
      {/* Accent bar at top */}
      <div className={cn('absolute top-0 left-0 right-0 h-1', styles.accentBar)} />

      {/* Gradient overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300 group-hover:opacity-70',
          styles.gradient
        )}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
              styles.iconBg
            )}
          >
            <Icon className={cn('h-6 w-6', styles.iconColor)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// LOW-2: Improved skeleton to match actual StatsCard structure
export function StatsCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-6">
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted" />
      <div className="flex items-start justify-between">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-8 bg-muted rounded w-32" />
        </div>
        <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
