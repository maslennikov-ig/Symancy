import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface ChartCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode; // Optional - not required when isEmpty is true
  className?: string;
  action?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  isLoading?: boolean;
  height?: string;
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
  isEmpty = false,
  emptyMessage = 'No data available',
  isLoading = false,
  height = 'h-72',
}: ChartCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <div className="h-5 bg-muted rounded w-32 animate-pulse" />
            <div className="h-4 bg-muted rounded w-48 animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(height, 'bg-muted/50 rounded-lg animate-pulse')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-lg', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div
            className={cn(
              height,
              'flex items-center justify-center text-muted-foreground rounded-lg bg-muted/30 border border-dashed border-border'
            )}
          >
            {emptyMessage}
          </div>
        ) : (
          <div className={height}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChartCardSkeleton({ height = 'h-72' }: { height?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <div className="h-5 bg-muted rounded w-32 animate-pulse" />
          <div className="h-4 bg-muted rounded w-48 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn(height, 'bg-muted/50 rounded-lg animate-pulse')} />
      </CardContent>
    </Card>
  );
}
