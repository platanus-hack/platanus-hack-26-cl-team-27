'use client';

import { Button, Notice, cx } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { useProjectId } from '@/components/proyectos/ProjectContext';
import { describeError } from '@/lib/http';
import {
  castVote,
  MAX_NOTE_LENGTH,
  type VoteKind,
  type VoteResponse,
} from '@/lib/votes-api';

export function VoteForm({
  notificationId,
  onDone,
}: {
  readonly notificationId: string;
  readonly onDone: (response: VoteResponse) => void;
}) {
  const projectId = useProjectId();
  const [note, setNote] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState<VoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy !== null || notificationId === '';

  const send = async (kind: VoteKind) => {
    setBusy(kind);
    setError(null);
    try {
      onDone(await castVote(projectId, notificationId, kind, note));
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
          <Icon
            name={busy === 'reviewed' ? 'spinner' : 'check'}
            className={cx('size-5', busy === 'reviewed' && 'animate-spin')}
          />
          {busy === 'reviewed' ? 'Enviando…' : 'Revisado'}
        </Button>
        <Button
          variant="critical"
          onClick={() => void send('issue')}
          disabled={disabled}
          className="h-13 text-base font-semibold!"
        >
          <Icon
            name={busy === 'issue' ? 'spinner' : 'alert'}
            className={cx('size-5', busy === 'issue' && 'animate-spin')}
          />
          {busy === 'issue' ? 'Enviando…' : 'Tengo un problema'}
        </Button>
      </div>
      <Button
        variant="secondary"
        onClick={() => void send('not_affected')}
        disabled={disabled}
        className="h-11 text-base"
      >
        <Icon
          name={busy === 'not_affected' ? 'spinner' : 'ban'}
          className={cx(busy === 'not_affected' && 'animate-spin')}
        />
        {busy === 'not_affected' ? 'Enviando…' : 'No me afecta'}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
