import { Icon } from '@/components/common/Icon';
import type { PulseStatus } from '@/hooks/use-room-pulse';

export function PresenceBadge({ status }: { readonly status: PulseStatus }) {
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
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"
    >
      <Icon
        name="user"
        className={status === 'live' ? 'text-good' : 'text-warning'}
      />
      {status === 'live' ? 'Estás conectado' : 'Conectando'}
    </span>
  );
}
