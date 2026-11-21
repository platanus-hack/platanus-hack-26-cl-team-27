'use client';

import { Avatar } from '@/components/common/Avatar';
import { Loading, LoadError } from '@/components/common/LoadState';
import { Notice } from '@team27/ui';
import { useCallback, useEffect, useState } from 'react';

import { PresenceBadge } from '@/components/asiento/PresenceBadge';
import { useSeatToken } from '@/hooks/use-held-seats';
import { useFlow } from '@/hooks/use-flow';
import { AFFECTED_ID, AUTHOR_ID } from '@/lib/flow-api';
import { describeError } from '@/lib/http';
import { claimSeat } from '@/lib/room-api';
import {
  clearSeatToken,
  readSeatToken,
  saveSeatToken,
} from '@/lib/seat-storage';

import { CamilaView } from './CamilaView';
import { CaseModelView } from './CaseModelView';
import { PaulaView } from './PaulaView';

const WHO: Record<string, { name: string; role: string }> = {
  [AUTHOR_ID]: { name: 'Paula Rojas', role: 'Ingeniera calculista' },
  [AFFECTED_ID]: { name: 'Camila Vera', role: 'Instalaciones eléctricas' },
};

export function CaseScreen({ castId }: { readonly castId: string }) {
  const stored = useSeatToken(castId);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const token = claimed ?? (stale ? null : stored.token);
  const who = WHO[castId] ?? null;

  useEffect(() => {
    if (!stored.ready || (stored.token && !stale) || claimed || !who) return;
    let active = true;
    claimSeat(castId)
      .then((response) => {
        if (!active) return;
        saveSeatToken(castId, response.token);
        setClaimed(readSeatToken(castId) ?? response.token);
      })
      .catch((failure: unknown) => {
        if (active) setClaimError(describeError(failure));
      });
    return () => {
      active = false;
    };
  }, [stored.ready, stored.token, stale, claimed, castId, who]);

  const onSeatLost = useCallback(() => {
    clearSeatToken(castId);
    setClaimError(null);
    setClaimed(null);
    setStale(true);
  }, [castId]);

  const { data, error, loading, status, reload } = useFlow({
    castId,
    seatToken: token,
    enabled: stored.ready,
  });

  if (!who)
    return (
      <div className="mx-auto max-w-md p-4">
        <Notice tone="error">
          Esta pantalla es para Paula Rojas o Camila Vera.
        </Notice>
      </div>
    );
  if (!stored.ready || (loading && !data))
    return <Loading label="Abriendo el caso…" />;
  if (!data)
    return (
      <div className="mx-auto max-w-md p-4">
        <LoadError message={error ?? 'No pudimos abrir el caso.'} />
      </div>
    );

  const auth = { seatToken: token };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-4 px-4 pt-3 pb-10 sm:px-6">
      <header className="flex items-center gap-3 border-b border-hairline pb-3">
        <Avatar name={who.name} tone="accent" size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink">
            {who.name}
          </h1>
          <p className="text-sm text-ink-2">
            {who.role} · {data.case.level}, {data.case.axis}
          </p>
        </div>
        <PresenceBadge status={token ? status : 'connecting'} />
      </header>
      {claimError && <Notice tone="error">{claimError}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {castId === AUTHOR_ID ? (
        <PaulaView
          flow={data}
          auth={auth}
          onChanged={reload}
          onSeatLost={onSeatLost}
        />
      ) : (
        <CamilaView
          flow={data}
          auth={auth}
          reportPresence
          onChanged={reload}
          onSeatLost={onSeatLost}
        />
      )}
      <CaseModelView flow={data} hideWhenMissing />
    </div>
  );
}
