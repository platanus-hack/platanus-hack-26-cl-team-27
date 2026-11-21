'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { formatValue } from '@/lib/format';
import { describeError } from '@/lib/http';
import { dropDocument, describeDrop, type TrayItem } from '@/lib/drops-api';
import type { InboxStale } from '@/lib/inbox-api';
import { acknowledgeStale } from '@/lib/votes-api';

export function StaleCard({
  item,
  tray,
  seatToken,
  onDone,
}: {
  readonly item: InboxStale;
  readonly tray: readonly TrayItem[];
  readonly seatToken: string | null;
  readonly onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const fix = tray.find(
    (entry) =>
      entry.documentId === item.documentId && entry.available && !entry.dropped,
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-ink">
        Tu documento usa {formatValue(item.usedValue, item.unit)}, lo vigente es{' '}
        {formatValue(item.currentValue, item.unit)}.
      </p>
      <p className="text-sm text-ink-2">
        {item.documentTitle} · {item.revisionLabel} · {item.label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-12 text-base"
          disabled={busy || !fix || !seatToken}
          onClick={() =>
            fix &&
            void run(async () => {
              setResult(describeDrop(await dropDocument(fix, { seatToken })));
            })
          }
        >
          Subí la revisión
        </Button>
        <Button
          variant="secondary"
          className="h-12 text-base"
          disabled={busy}
          onClick={() => setAsking((value) => !value)}
        >
          Confirmo sin cambio
        </Button>
      </div>
      {!fix && (
        <p className="text-sm text-ink-2">
          No hay una revisión nueva de este documento en tu carpeta.
        </p>
      )}
      {asking && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Nota (obligatoria)
            </span>
            <textarea
              value={note}
              maxLength={280}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Por qué tu documento sigue vigente así"
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
          </label>
          <Button
            variant="secondary"
            className="h-12 text-base"
            disabled={busy || note.trim().length === 0 || !seatToken}
            onClick={() =>
              void run(() =>
                acknowledgeStale(item.revisionId, note, { seatToken }),
              )
            }
          >
            Confirmar sin cambio
          </Button>
        </div>
      )}
      {result && <Notice tone="success">{result}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
