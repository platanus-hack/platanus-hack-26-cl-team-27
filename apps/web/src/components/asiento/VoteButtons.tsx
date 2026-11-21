'use client';

import { Button, Notice } from '@team27/ui';
import { useState } from 'react';

import { describeError } from '@/lib/http';
import {
  castVote,
  MAX_NOTE_LENGTH,
  type VoteKind,
  type VoteResponse,
} from '@/lib/votes-api';

export function VoteButtons({
  notificationId,
  seatToken,
  onDone,
}: {
  readonly notificationId: string;
  readonly seatToken: string | null;
  readonly onDone: (response: VoteResponse) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (kind: VoteKind) => {
    setBusy(kind);
    setError(null);
    try {
      onDone(await castVote(notificationId, kind, note, { seatToken }));
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Nota (opcional)</span>
        <textarea
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Cuéntanos qué necesitas"
          className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        <span className="text-xs text-ink-2">
          {note.length} de {MAX_NOTE_LENGTH}
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => void send('reviewed')}
          disabled={busy !== null || !seatToken}
          className="h-12 text-base"
        >
          {busy === 'reviewed' ? 'Enviando…' : 'Revisado'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void send('issue')}
          disabled={busy !== null || !seatToken}
          className="h-12 text-base"
        >
          {busy === 'issue' ? 'Enviando…' : 'Tengo un problema'}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
