'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { describeError } from '@/lib/http';
import type { OverlapView } from '@/lib/proposals-api';
import { castOverlapVote, type OverlapVoteKind } from '@/lib/votes-api';

const STATUS_TEXT: Record<OverlapView['status'], string> = {
  abierto: 'Falta validarlo',
  confirmado: 'Confirmado: se tocan',
  descartado: 'Descartado: no se tocan',
  resuelto: 'Resuelto',
};

const VOTE_TEXT: Record<OverlapVoteKind, string> = {
  se_tocan: 'se tocan',
  no_se_tocan: 'no se tocan',
};

export const canVoteOverlap = (
  overlap: OverlapView,
  userId: string | null,
): boolean =>
  userId !== null &&
  (overlap.status === 'abierto' || overlap.status === 'confirmado') &&
  overlap.validators.includes(userId) &&
  !overlap.votes.some((vote) => vote.validatorId === userId);

function OverlapItem({
  projectId,
  overlap,
  userId,
  onDone,
}: {
  readonly projectId: string;
  readonly overlap: OverlapView;
  readonly userId: string | null;
  readonly onDone: () => void;
}) {
  const [busy, setBusy] = useState<OverlapVoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (kind: OverlapVoteKind) => {
    setBusy(kind);
    setError(null);
    try {
      await castOverlapVote(projectId, overlap.id, kind);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  const pending = overlap.validatorsInfo.filter(
    (person) => !overlap.votes.some((vote) => vote.validatorId === person.id),
  );

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-hairline p-4">
      <p className="flex items-center gap-2 font-medium text-ink">
        <Icon name="layers" className="text-accent-text" />
        {overlap.title}
      </p>
      <p className="text-ink-2">{STATUS_TEXT[overlap.status]}</p>
      {overlap.votes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {overlap.votes.map((vote) => (
            <li key={vote.validatorId} className="text-ink">
              {vote.validatorName} dice que {VOTE_TEXT[vote.kind]}
              {vote.note ? `: «${vote.note}»` : '.'}
            </li>
          ))}
        </ul>
      )}
      {overlap.status === 'abierto' && pending.length > 0 && (
        <p className="text-ink-2">
          Falta {pending.map((person) => person.name).join(' y ')}.
        </p>
      )}
      {canVoteOverlap(overlap, userId) && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="critical"
            onClick={() => void send('se_tocan')}
            disabled={busy !== null}
          >
            <Icon name="conflict" />
            {busy === 'se_tocan' ? 'Enviando…' : 'Se tocan'}
          </Button>
          <Button
            onClick={() => void send('no_se_tocan')}
            disabled={busy !== null}
          >
            <Icon name="check" />
            {busy === 'no_se_tocan' ? 'Enviando…' : 'No se tocan'}
          </Button>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </li>
  );
}

export function OverlapVotes({
  projectId,
  overlaps,
  userId,
  onDone,
}: {
  readonly projectId: string;
  readonly overlaps: readonly OverlapView[];
  readonly userId: string | null;
  readonly onDone: () => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {overlaps.map((overlap) => (
        <OverlapItem
          key={overlap.id}
          projectId={projectId}
          overlap={overlap}
          userId={userId}
          onDone={onDone}
        />
      ))}
    </ul>
  );
}
