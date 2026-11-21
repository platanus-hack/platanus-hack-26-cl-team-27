'use client';

import { Button, Notice, cx } from '@team27/ui';
import { useState } from 'react';

import { CostDelay } from '@/components/common/CostDelay';
import { Icon } from '@/components/common/Icon';
import { StateMark } from '@/components/common/StateMark';
import { StatusChip } from '@/components/common/StatusChip';
import { formatChange, formatValue, joinNames } from '@/lib/format';
import { describeError } from '@/lib/http';
import type {
  InboxDiscrepancy,
  InboxFiltered,
  InboxStale,
  InboxVote,
} from '@/lib/inbox-api';
import type { ProposalView } from '@/lib/proposals-api';
import { acknowledgeStale, MAX_NOTE_LENGTH } from '@/lib/votes-api';
import { isWaiting, setWaiting } from '@/lib/waiting';

import { VoteForm } from './VoteForm';

const linkButton =
  'inline-flex items-center gap-1 self-start text-sm font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-accent';

function ChangeLines({
  vote,
  proposal,
}: {
  readonly vote: InboxVote;
  readonly proposal: ProposalView | null;
}) {
  if (!proposal) return <p className="text-sm text-ink-2">{vote.title}</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {proposal.diffs.map((diff) => (
        <li key={diff.label} className="text-base text-ink">
          <span className="text-ink-2">{diff.label}:</span>{' '}
          <span className="font-semibold tabular-nums">
            {formatChange(diff.before, diff.after, diff.unit)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Progress({ vote }: { readonly vote: InboxVote }) {
  const { approved, required, missing } = vote.progress;
  const percent =
    required === 0 ? 100 : Math.round((approved / required) * 100);
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Aprobaciones"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={approved}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full bg-good transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {approved} de {required} aprobaron
        {missing.length > 0 && ` · Falta ${joinNames(missing)}`}
      </p>
    </div>
  );
}

export function VoteBody({
  vote,
  proposal,
  seatToken,
  onDone,
  onOpen,
}: {
  readonly vote: InboxVote;
  readonly proposal: ProposalView | null;
  readonly seatToken: string | null;
  readonly onDone: () => void;
  readonly onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChangeLines vote={vote} proposal={proposal} />
      {vote.findings.length > 0 ? (
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-xs font-medium text-ink-2">Por qué te llega</p>
          <ul className="mt-1 flex flex-col gap-2">
            {vote.findings.map((finding) => (
              <li key={finding.summary} className="text-sm">
                <p className="font-medium text-ink">{finding.summary}</p>
                <p className="text-ink-2">{finding.action}</p>
                {finding.details.length > 0 && (
                  <details className="group mt-1">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent-text [&::-webkit-details-marker]:hidden">
                      <Icon
                        name="chevron"
                        className="size-3 transition-transform group-open:rotate-90"
                      />
                      Ver el cálculo
                    </summary>
                    <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-ink-2">
                      {finding.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-2">
          Abre el detalle para ver qué te toca.
        </p>
      )}
      <CostDelay
        costDelta={vote.costDelta}
        delayDays={vote.delayDays}
        className="text-sm"
      />
      <Progress vote={vote} />
      {seatToken ? (
        <VoteForm
          notificationId={vote.notificationId}
          seatToken={seatToken}
          onDone={onDone}
        />
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <Icon name="lock" className="text-ink-3" />
          Solo lectura: toma este asiento para responder.
        </p>
      )}
      <button type="button" onClick={onOpen} className={linkButton}>
        Ver el detalle del cambio
        <Icon name="chevron" className="size-3.5" />
      </button>
    </div>
  );
}

const closedLine = (vote: InboxVote, mine: boolean): string => {
  switch (vote.status) {
    case 'merged':
      return 'El cambio ya quedó vigente.';
    case 'withdrawn':
      return 'La autora retiró la propuesta. Lo vigente no cambió.';
    case 'replaced':
      return 'Una revisión nueva reemplazó esta propuesta.';
    case 'disputed':
      return mine
        ? 'Esperando que la autora reabra con tu observación.'
        : 'En disputa: esperando que la autora reabra.';
    default:
      return vote.progress.missing.length > 0
        ? `Esperando a ${joinNames(vote.progress.missing)}.`
        : 'Esperando la fusión.';
  }
};

export function AnsweredBody({
  vote,
  proposal,
  onOpen,
}: {
  readonly vote: InboxVote;
  readonly proposal: ProposalView | null;
  readonly onOpen: () => void;
}) {
  const response = vote.response;
  return (
    <div className="flex flex-col gap-2.5">
      <ChangeLines vote={vote} proposal={proposal} />
      {response ? (
        <div>
          <StateMark
            tone={response.kind === 'reviewed' ? 'good' : 'critical'}
            icon={response.kind === 'reviewed' ? 'check' : 'alert'}
            label={
              response.kind === 'reviewed'
                ? 'Respondiste: Revisado'
                : 'Respondiste: Tengo un problema'
            }
          />
          {response.note && (
            <p className="mt-0.5 text-sm text-ink">«{response.note}»</p>
          )}
        </div>
      ) : (
        <StateMark
          tone="neutral"
          icon="minus"
          label="No alcanzaste a responder"
        />
      )}
      <p className="text-sm text-ink-2">
        {closedLine(vote, response?.kind === 'issue')}
      </p>
      {vote.status !== 'withdrawn' && vote.status !== 'replaced' && (
        <Progress vote={vote} />
      )}
      <button type="button" onClick={onOpen} className={linkButton}>
        Ver el detalle del cambio
        <Icon name="chevron" className="size-3.5" />
      </button>
    </div>
  );
}

export function DiscrepancyBody({
  item,
  seatToken,
  onDismiss,
}: {
  readonly item: InboxDiscrepancy;
  readonly seatToken: string | null;
  readonly onDismiss: (item: InboxDiscrepancy) => void;
}) {
  const [waiting, setWaitingState] = useState(() => isWaiting(item.id));
  const toggle = (next: boolean) => {
    setWaiting(item.id, next);
    setWaitingState(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-ink">
        Dice{' '}
        <span className="font-semibold tabular-nums">
          {formatValue(item.claimedValue, item.unit)}
        </span>
        , lo vigente es{' '}
        <span className="font-semibold tabular-nums">
          {formatValue(item.currentValue, item.unit)}
        </span>
        .
      </p>
      <p className="text-sm text-ink-2">
        Lo dice {item.sourceTitle} ({item.spaceName}, {item.authorName}).
      </p>
      <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink">
        No cambia nada solo: esa fuente no manda sobre este valor. Lo vigente
        sigue igual hasta que un plano o una EETT lo respalde.
      </p>
      {waiting ? (
        <div className="flex items-center gap-2">
          <StatusChip
            tone="warning"
            icon="hourglass"
            label="Esperando el plano"
          />
          <Button size="sm" variant="ghost" onClick={() => toggle(false)}>
            Deshacer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="danger"
            className="h-13 text-base font-semibold!"
            disabled={!seatToken}
            onClick={() => onDismiss(item)}
          >
            Descartar
          </Button>
          <Button
            variant="critical"
            className="h-13 text-base font-semibold!"
            disabled={!seatToken}
            onClick={() => toggle(true)}
          >
            Esperar el plano
          </Button>
        </div>
      )}
    </div>
  );
}

export function StaleBody({
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

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await acknowledgeStale(item.revisionId, note, { seatToken });
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
        Usa{' '}
        <span className="font-semibold tabular-nums">
          {formatValue(item.usedValue, item.unit)}
        </span>
        , lo vigente es{' '}
        <span className="font-semibold tabular-nums">
          {formatValue(item.currentValue, item.unit)}
        </span>
        .
      </p>
      <p className="text-sm text-ink-2">{item.label}</p>
      <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink">
        Sube la revisión nueva a tu carpeta y la leemos solos. Si tu documento
        sigue vigente así, confírmalo con una nota.
      </p>
      {asking ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">
              Por qué sigue vigente (obligatorio)
            </span>
            <textarea
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Cuéntale al equipo por qué tu documento no cambia"
              className="w-full resize-none rounded-lg border border-hairline bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="h-12 text-base"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Cancelar
            </Button>
            <Button
              className="h-12 text-base"
              disabled={busy || note.trim().length === 0 || !seatToken}
              onClick={() => void confirm()}
            >
              {busy ? 'Enviando…' : 'Confirmar sin cambio'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          className={cx('h-12 text-base')}
          disabled={!seatToken}
          onClick={() => setAsking(true)}
        >
          Confirmo sin cambio
        </Button>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function FilteredBody({
  item,
  onOpen,
}: {
  readonly item: InboxFiltered;
  readonly onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2 text-sm text-ink">
        <Icon name="ban" className="mt-0.5 text-ink-3" />
        <span>No te avisamos: {item.reason}</span>
      </p>
      <button type="button" onClick={onOpen} className={linkButton}>
        Ver por qué
        <Icon name="chevron" className="size-3.5" />
      </button>
    </div>
  );
}
