'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useState } from 'react';

import { describeError, type Auth } from '@/lib/http';
import { resetRoom } from '@/lib/room-api';

export function ResetButton({
  auth,
  onDone,
}: {
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetRoom(auth);
      setConfirming(false);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Reiniciar"
      description="Vacía la obra y suelta todos los asientos."
    >
      {confirming ? (
        <div className="flex flex-col gap-3">
          <Notice>
            Se borra todo lo ocurrido y los celulares vuelven al inicio. Después
            corre pnpm etl para la carga inicial. ¿Seguro?
          </Notice>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void reset()}
            >
              {busy ? 'Reiniciando…' : 'Sí, reiniciar'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Reiniciar la sala
        </Button>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
