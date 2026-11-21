'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { formatValue } from '@/lib/format';
import { describeError } from '@/lib/http';
import type { InboxStale } from '@/lib/inbox-api';
import { acknowledgeStale } from '@/lib/votes-api';

export function StaleCard({
  item,
  seatToken,
  onDone,
}: {
  readonly item: InboxStale;
  readonly seatToken: string | null;
  readonly onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <p className="text-sm text-ink-2">
        Cuando subas la revisión a tu carpeta, la leemos solos.
      </p>
      <Button
        variant="secondary"
        className="h-12 text-base"
        disabled={busy}
        onClick={() => setAsking((value) => !value)}
      >
        Confirmo sin cambio
      </Button>
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
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
