import React from 'react';

export const HistoryItemSkeleton: React.FC = () => {
  return (
    <div className="p-4 border rounded-lg bg-background/50">
      <div className="flex justify-between items-start animate-pulse">
        <div className="w-full">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
          <div className="h-3 bg-muted rounded w-full mt-4"></div>
          <div className="h-3 bg-muted rounded w-5/6 mt-2"></div>
        </div>
        <div className="ml-4 flex-shrink-0 h-9 bg-muted rounded w-28"></div>
      </div>
    </div>
  );
};
