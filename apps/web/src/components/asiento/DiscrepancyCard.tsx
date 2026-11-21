'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { StateMark } from '@/components/common/StateMark';
import { formatValue } from '@/lib/format';
import { describeError } from '@/lib/http';
import type { InboxDiscrepancy } from '@/lib/inbox-api';
import { dismissDiscrepancy } from '@/lib/votes-api';

export function DiscrepancyCard({
  item,
  seatToken,
  onDone,
}: {
  readonly item: InboxDiscrepancy;
  readonly seatToken: string | null;
  readonly onDone: () => void;
}) {
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = async () => {
    setBusy(true);
    setError(null);
    try {
      await dismissDiscrepancy(item.id, { seatToken });
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
        Dice {formatValue(item.claimedValue, item.unit)}, lo vigente es{' '}
        {formatValue(item.currentValue, item.unit)}.
      </p>
      <p className="text-sm text-ink-2">
        {item.subjectName} · {item.label}. Lo dice {item.sourceTitle} (
        {item.spaceName}, {item.authorName}), que no manda sobre este valor.
      </p>
      {waiting ? (
        <StateMark tone="warning" icon="hourglass" label="Esperando el plano" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="h-12 text-base"
            disabled={busy || !seatToken}
            onClick={() => void dismiss()}
          >
            Descartar
          </Button>
          <Button
            variant="secondary"
            className="h-12 text-base"
            onClick={() => setWaiting(true)}
          >
            Esperar el plano
          </Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
