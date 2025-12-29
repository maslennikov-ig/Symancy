import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@tremor/react';
import { TableRow, TableCell } from '@/components/ui/table';

/**
 * Skeleton loader for stat cards on the dashboard
 * Mimics the structure of tremor Card with decoration
 */
export function StatCardSkeleton() {
  return (
    <Card className="animate-pulse" decoration="top" decorationColor="slate">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3" />
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16" />
    </Card>
  );
}

interface TableRowSkeletonProps {
  /** Number of columns to render */
  columns?: number;
}

/**
 * Single row skeleton for tables
 */
export function TableRowSkeleton({ columns = 5 }: TableRowSkeletonProps) {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

interface TableSkeletonProps {
  /** Number of rows to render */
  rows?: number;
  /** Number of columns per row */
  columns?: number;
}

/**
 * Multiple row skeleton for table loading states
 */
export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  );
}

/**
 * Generic loading skeleton for user info sections
 */
export function UserInfoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-44" />
    </div>
  );
}

interface ListSkeletonProps {
  /** Number of items to render */
  items?: number;
  /** Height of each skeleton item */
  itemHeight?: string;
}

/**
 * Generic list loading skeleton
 */
export function ListSkeleton({ items = 5, itemHeight = 'h-12' }: ListSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className={`${itemHeight} w-full`} />
      ))}
    </div>
  );
}
