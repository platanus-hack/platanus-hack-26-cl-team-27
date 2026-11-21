import { cx } from '@team27/ui';

import type { PulseStatus } from '@/hooks/use-room-pulse';

import { Icon } from './Icon';

const LOOK = {
  live: { label: 'En vivo', dot: 'bg-good', icon: false },
  connecting: { label: 'Conectando', dot: 'bg-warning', icon: false },
  offline: { label: 'Sin conexión', dot: 'bg-critical', icon: true },
} as const;

export function LiveBadge({
  status,
  large = false,
}: {
  readonly status: PulseStatus;
  readonly large?: boolean;
}) {
  const look = LOOK[status];
  return (
    <span
      role="status"
      className={cx(
        'inline-flex items-center gap-2 font-medium text-ink-2',
        large ? 'text-lg' : 'text-sm',
      )}
    >
      {look.icon ? (
        <Icon name="wifiOff" className="size-4 text-critical" />
      ) : (
        <span
          aria-hidden
          className={cx(
            'size-2.5 rounded-full',
            look.dot,
            status === 'live' && 'animate-pulse',
          )}
        />
      )}
      {look.label}
    </span>
  );
}
