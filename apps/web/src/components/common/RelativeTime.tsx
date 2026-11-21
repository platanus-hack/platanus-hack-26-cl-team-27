'use client';

import { useNow } from '@/hooks/use-now';
import { formatClock, formatRelative } from '@/lib/format';

export function RelativeTime({
  at,
  className,
}: {
  readonly at: string | null;
  readonly className?: string;
}) {
  const now = useNow();
  if (!at) return null;
  return (
    <time dateTime={at} title={formatClock(at)} className={className}>
      {formatRelative(at, now)}
    </time>
  );
}
