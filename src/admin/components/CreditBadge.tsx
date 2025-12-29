import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CreditType = 'basic' | 'pro' | 'cassandra';

interface CreditBadgeProps {
  type: CreditType;
  amount: number;
  className?: string;
}

const CREDIT_COLORS = {
  basic: 'bg-slate-600 hover:bg-slate-600',
  pro: 'bg-blue-600 hover:bg-blue-600',
  cassandra: 'bg-purple-600 hover:bg-purple-600',
} as const;

const CREDIT_LABELS = {
  basic: 'Basic',
  pro: 'Pro',
  cassandra: 'Cassandra',
} as const;

/**
 * Reusable credit badge component for displaying user credits
 * Returns null if amount is 0 to avoid visual clutter
 */
export function CreditBadge({ type, amount, className }: CreditBadgeProps) {
  if (amount === 0) return null;

  return (
    <Badge
      variant="default"
      className={cn('text-xs text-white', CREDIT_COLORS[type], className)}
    >
      {CREDIT_LABELS[type]}: {amount}
    </Badge>
  );
}

/**
 * Interface for user credits data structure
 */
export interface UserCredits {
  credits_basic: number;
  credits_pro: number;
  credits_cassandra: number;
}

interface CreditsBadgesProps {
  credits: UserCredits | null;
  /** Text to show when credits is null */
  nullText?: string;
  /** Text to show when all credits are 0 */
  zeroText?: string;
  className?: string;
}

/**
 * Displays all credit types as badges
 * Handles null credits and zero totals gracefully
 */
export function CreditsBadges({
  credits,
  nullText = '-',
  zeroText = '0',
  className,
}: CreditsBadgesProps) {
  if (!credits) {
    return <span className="text-muted-foreground text-sm">{nullText}</span>;
  }

  const { credits_basic, credits_pro, credits_cassandra } = credits;
  const hasCredits = credits_basic > 0 || credits_pro > 0 || credits_cassandra > 0;

  if (!hasCredits) {
    return <span className="text-muted-foreground text-sm">{zeroText}</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      <CreditBadge type="basic" amount={credits_basic} />
      <CreditBadge type="pro" amount={credits_pro} />
      <CreditBadge type="cassandra" amount={credits_cassandra} />
    </div>
  );
}
