'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { dropDocument, describeDrop, type TrayItem } from '@/lib/drops-api';
import { formatValue } from '@/lib/format';
import { describeError, type Auth } from '@/lib/http';

export function DropTray({
  items,
  auth,
  onDone,
}: {
  readonly items: readonly TrayItem[];
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const drop = async (item: TrayItem) => {
    setBusyId(item.fixtureId);
    setMessage(null);
    try {
      setMessage({
        tone: 'success',
        text: describeDrop(await dropDocument(item, auth)),
      });
      onDone();
    } catch (failure) {
      setMessage({ tone: 'error', text: describeError(failure) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card
      title="Tu carpeta"
      description="Documentos que puedes soltar en tu espacio."
    >
      {items.length === 0 ? (
        <p className="text-sm text-ink-2">No tienes documentos para soltar.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const disabled = !item.available || item.dropped || busyId !== null;
            return (
              <li
                key={item.fixtureId}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3"
              >
                <p className="flex items-start gap-2 text-base font-medium text-ink">
                  <Icon name="file" className="mt-1 size-5 text-ink-2" />
                  <span>
                    {item.documentTitle} · {item.revisionLabel}
                    <span className="block text-sm font-normal text-ink-2">
                      {item.spaceName}
                    </span>
                  </span>
                </p>
                <ul className="text-sm text-ink-2">
                  {item.claims.map((claim) => (
                    <li key={claim.label + claim.role}>
                      {claim.role === 'afirma' ? 'Afirma' : 'Usa'}{' '}
                      {claim.label.toLowerCase()}:{' '}
                      {formatValue(claim.value, claim.unit)}
                    </li>
                  ))}
                </ul>
                {item.dropped ? (
                  <p className="text-sm font-medium text-good-text">
                    Ya lo soltaste
                  </p>
                ) : (
                  <>
                    <Button
                      className="h-11"
                      disabled={disabled}
                      onClick={() => void drop(item)}
                    >
                      {busyId === item.fixtureId
                        ? 'Soltando…'
                        : 'Soltar en mi espacio'}
                    </Button>
                    {!item.available && item.blockedReason && (
                      <p className="text-sm text-ink-2">{item.blockedReason}</p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {message && (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </Card>
  );
}
