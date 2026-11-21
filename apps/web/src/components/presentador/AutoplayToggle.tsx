'use client';

import { Card, Notice, Select } from '@team27/ui';
import { useState } from 'react';

import { describeError, type Auth } from '@/lib/http';
import type { AutoplaySpeed } from '@/lib/room-api';
import { setAutoplay, SPEEDS } from '@/lib/scenes-api';

export function AutoplayToggle({
  enabled,
  speed,
  auth,
  onDone,
}: {
  readonly enabled: boolean;
  readonly speed: AutoplaySpeed;
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async (nextEnabled: boolean, nextSpeed: AutoplaySpeed) => {
    setBusy(true);
    setError(null);
    try {
      await setAutoplay(nextEnabled, nextSpeed, auth);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Autoplay" description="Reproduce las escenas 1 a 6 sola.">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            className="size-5 accent-[var(--color-accent)]"
            onChange={(event) => void apply(event.target.checked, speed)}
          />
          {enabled ? 'Encendido' : 'Apagado'}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          Velocidad
          <Select
            value={speed}
            disabled={busy}
            className="w-24"
            onChange={(event) =>
              void apply(enabled, Number(event.target.value) as AutoplaySpeed)
            }
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </Select>
        </label>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
