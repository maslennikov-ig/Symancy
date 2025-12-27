import React, { useEffect, useState } from 'react';
import { getUserCredits } from '../../../services/paymentService';
import { UserCredits } from '../../../types/payment';
import { cn } from '../../../lib/utils';

/**
 * Compact credit badge for Header display.
 * Shows total available credits (basic + pro) for regular analysis.
 * Cassandra credits are shown separately if present.
 */
interface CreditBadgeProps {
  /** Optional className for container */
  className?: string;
  /** Callback when clicked (to open tariff selector) */
  onClick?: () => void;
}

export function CreditBadge({ className, onClick }: CreditBadgeProps) {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCredits() {
      try {
        setLoading(true);
        const result = await getUserCredits();
        setCredits(result);
      } catch (err) {
        console.error('Failed to fetch credits:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  // Loading state - show skeleton
  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted animate-pulse', className)}>
        <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
        <span className="w-4 h-3 rounded bg-muted-foreground/30" />
      </div>
    );
  }

  // No credits data (not logged in or no record)
  if (!credits) {
    return null;
  }

  const totalBasicCredits = credits.basic_credits + credits.pro_credits;
  const hasCassandra = credits.cassandra_credits > 0;
  const isEmpty = totalBasicCredits === 0 && !hasCassandra;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
        isEmpty
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'bg-primary/10 text-primary hover:bg-primary/20',
        className
      )}
      title={`${totalBasicCredits} анализов${hasCassandra ? `, ${credits.cassandra_credits} Кассандра` : ''}`}
    >
      {/* Coffee cup icon */}
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
      </svg>
      <span>{totalBasicCredits}</span>
      {hasCassandra && (
        <>
          <span className="w-px h-3 bg-current opacity-30" />
          {/* Eye icon for Cassandra */}
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
          </svg>
          <span>{credits.cassandra_credits}</span>
        </>
      )}
    </button>
  );
}
