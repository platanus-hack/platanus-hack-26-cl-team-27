'use client';

import { Button, Notice, StatusBadge } from '@team27/ui';

import { textLink } from '@/components/common/link-styles';
import { RelativeTime } from '@/components/common/RelativeTime';
import { type SourceView, sourceState } from '@/lib/integrations-api';

export function SourceRow({
  source,
  busy,
  onSync,
  onUnlink,
}: {
  readonly source: SourceView;
  readonly busy: boolean;
  readonly onSync: () => void;
  readonly onUnlink: () => void;
}) {
  const state = sourceState(source);
  const ignored = source.lastRead?.ignored ?? [];
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {source.documentName}
            {source.spaceName && (
              <span className="font-normal text-ink-2">
                {' '}
                · {source.spaceName}
              </span>
            )}
          </p>
          <a
            href={source.pointer}
            target="_blank"
            rel="noreferrer"
            className={`${textLink} text-sm`}
          >
            {source.title}
          </a>
        </div>
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
        <dt className="text-ink-2">Última versión en la sala</dt>
        <dd className="text-ink">
          {source.lastRead ? (
            <>
              {source.lastRead.label} · <RelativeTime at={source.lastRead.at} />
            </>
          ) : (
            'Ninguna'
          )}
        </dd>
      </dl>

      {source.lastError && (
        <Notice tone="error">{source.lastError.message}</Notice>
      )}

      {ignored.length > 0 && (
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer">
            {ignored.length === 1
              ? '1 celda no entró'
              : `${ignored.length} celdas no entraron`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4">
            {ignored.map((cell) => (
              <li key={cell.locator}>
                <span className="font-mono text-xs text-ink">
                  {cell.locator}
                </span>{' '}
                {cell.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onSync}>
          {busy ? 'Revisando…' : 'Revisar ahora'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onUnlink}>
          Desvincular
        </Button>
      </div>
    </li>
  );
}
