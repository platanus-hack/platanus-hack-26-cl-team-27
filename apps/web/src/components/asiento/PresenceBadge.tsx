import { Icon } from '@/components/common/Icon';
import type { PulseStatus } from '@/hooks/use-room-pulse';

export function PresenceBadge({
  status,
  readOnly = false,
}: {
  readonly status: PulseStatus;
  readonly readOnly?: boolean;
}) {
  if (readOnly)
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2"
      >
        <Icon name="lock" className="text-ink-3" />
        Solo lectura
      </span>
    );
  if (status === 'offline')
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-critical-text"
      >
        <Icon name="wifiOff" className="text-critical" />
        Sin conexión
      </span>
    );
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 text-sm text-ink-2"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${status === 'live' ? 'bg-good' : 'bg-warning'}`}
      />
      {status === 'live' ? 'Estás conectado' : 'Conectando'}
    </span>
  );
}
