'use client';

import { Button, Notice, cx } from '@team27/ui';
import { useState } from 'react';

import { describeError } from '@/lib/http';
import {
  castVote,
  MAX_NOTE_LENGTH,
  type VoteKind,
  type VoteResponse,
} from '@/lib/votes-api';

export function VoteForm({
  notificationId,
  seatToken,
  onDone,
}: {
  readonly notificationId: string;
  readonly seatToken: string | null;
  readonly onDone: (response: VoteResponse) => void;
}) {
  const [note, setNote] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy !== null || !seatToken || notificationId === '';

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

  const open = focused || note.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="sr-only">Nota (opcional)</span>
        <textarea
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          rows={open ? 3 : 1}
          disabled={!seatToken}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Agrega una nota (opcional)"
          className={cx(
            'w-full resize-none rounded-lg border border-hairline bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-3',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60',
          )}
        />
        {note.length > 0 && (
          <span className="self-end text-xs tabular-nums text-ink-2">
            {note.length} de {MAX_NOTE_LENGTH}
          </span>
        )}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => void send('reviewed')}
          disabled={disabled}
          className="h-13 text-base font-semibold!"
        >
          {busy === 'reviewed' ? 'Enviando…' : 'Revisado'}
        </Button>
        <Button
          variant="critical"
          onClick={() => void send('issue')}
          disabled={disabled}
          className="h-13 text-base font-semibold!"
        >
          {busy === 'issue' ? 'Enviando…' : 'Tengo un problema'}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
