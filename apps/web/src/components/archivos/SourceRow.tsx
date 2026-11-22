'use client';

import { Button, Notice, StatusBadge } from '@team27/ui';

import { textLink } from '@/components/common/link-styles';
import { RelativeTime } from '@/components/common/RelativeTime';
import { formatClock } from '@/lib/format';
import { type SourceView, sourceState } from '@/lib/integrations-api';

export function SourceRow({
  source,
  busy,
  onCheck,
  onUnlink,
}: {
  readonly source: SourceView;
  readonly busy: boolean;
  readonly onCheck: () => void;
  readonly onUnlink: () => void;
}) {
  const state = sourceState(source);
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <a
          href={source.pointer}
          target="_blank"
          rel="noreferrer"
          className={`${textLink} min-w-0`}
        >
          {source.title}
        </a>
        <StatusBadge tone={state.tone} label={state.label} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-2">Última revisión</dt>
        <dd className="text-ink">
          {source.checkedAt ? (
            <RelativeTime at={source.checkedAt} />
          ) : (
            'Todavía no'
          )}
        </dd>
        <dt className="text-ink-2">Último cambio</dt>
        <dd className="text-ink">
          {source.changedAt ? (
            <RelativeTime at={source.changedAt} />
          ) : (
            'Ninguno desde que la vinculamos'
          )}
        </dd>
        {source.changedBy && (
          <>
            <dt className="text-ink-2">Lo editó</dt>
            <dd className="text-ink">
              {source.changedBy.name ?? source.changedBy.email}
            </dd>
          </>
        )}
        <dt className="text-ink-2">Avisos de Google</dt>
        <dd className="text-ink">
          {source.push.active && source.push.expiresAt
            ? `Al instante (suscripción vigente hasta las ${formatClock(source.push.expiresAt)})`
            : 'Revisión periódica'}
        </dd>
      </dl>

      {source.lastError && (
        <Notice tone="error">{source.lastError.message}</Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onCheck}>
          {busy ? 'Revisando…' : 'Revisar ahora'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onUnlink}>
          Desvincular
        </Button>
      </div>
    </li>
  );
}
