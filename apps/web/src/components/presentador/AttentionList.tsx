'use client';

import { Button } from '@team27/ui';
import { useState } from 'react';

import { Icon } from '@/components/common/Icon';
import { RelativeTime } from '@/components/common/RelativeTime';
import { StatusChip } from '@/components/common/StatusChip';
import type { AttentionItem } from '@/lib/attention';
import { formatValue, joinNames } from '@/lib/format';
import type { InboxDiscrepancy } from '@/lib/inbox-api';
import { changeOf, type ProposalView } from '@/lib/proposals-api';
import { isWaiting, setWaiting } from '@/lib/waiting';

function DiscrepancyRow({
  discrepancy,
  busy,
  onDismiss,
}: {
  readonly discrepancy: InboxDiscrepancy;
  readonly busy: boolean;
  readonly onDismiss: (discrepancy: InboxDiscrepancy) => void;
}) {
  const [waiting, setWaitingState] = useState(() => isWaiting(discrepancy.id));
  const toggle = (next: boolean) => {
    setWaiting(discrepancy.id, next);
    setWaitingState(next);
  };
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <Icon name="alert" filled className="mt-0.5 size-5 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {discrepancy.sourceTitle} dice{' '}
          {formatValue(discrepancy.claimedValue, discrepancy.unit)}, lo vigente
          es {formatValue(discrepancy.currentValue, discrepancy.unit)}
        </p>
        <p className="text-sm text-ink-2">
          {discrepancy.subjectName} · {discrepancy.label} ·{' '}
          {discrepancy.spaceName}, {discrepancy.authorName} ·{' '}
          <RelativeTime at={discrepancy.at} />
        </p>
        <p className="mt-1 text-sm text-ink-2">
          Esa fuente no manda sobre este valor: lo vigente no cambia hasta que
          un plano o una EETT lo respalde.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:pl-2">
        {waiting ? (
          <>
            <StatusChip
              tone="warning"
              icon="hourglass"
              label="Esperando el plano"
            />
            <Button size="sm" variant="ghost" onClick={() => toggle(false)}>
              Deshacer
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="danger"
              className="font-semibold!"
              disabled={busy}
              onClick={() => onDismiss(discrepancy)}
            >
              Descartar
            </Button>
            <Button
              variant="critical"
              className="font-semibold!"
              onClick={() => toggle(true)}
            >
              Esperar el plano
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function DisputeRow({
  proposal,
  busy,
  onReopen,
  onOpen,
}: {
  readonly proposal: ProposalView;
  readonly busy: boolean;
  readonly onReopen: (proposal: ProposalView) => void;
  readonly onOpen: (proposal: ProposalView) => void;
}) {
  const disputers = proposal.reviewers.filter((r) => r.decision === 'dispute');
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <Icon name="alert" filled className="mt-0.5 size-5 text-critical" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          En disputa: {proposal.elementName} · {changeOf(proposal)}
        </p>
        {disputers.map((reviewer) => (
          <p key={reviewer.stakeholderId} className="text-sm text-ink">
            {reviewer.name}:{' '}
            <span className="text-ink-2">
              {reviewer.note ? `«${reviewer.note}»` : 'sin nota'}
            </span>
          </p>
        ))}
        <p className="text-sm text-ink-2">
          {proposal.progress.missing.length > 0
            ? `Falta ${joinNames(proposal.progress.missing)}`
            : 'Todos respondieron'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:pl-2">
        <Button size="sm" variant="secondary" onClick={() => onOpen(proposal)}>
          Ver detalle
        </Button>
        <Button size="sm" disabled={busy} onClick={() => onReopen(proposal)}>
          Reabrir con la observación
        </Button>
      </div>
    </li>
  );
}

export function AttentionList({
  items,
  busyId,
  onReopen,
  onOpen,
  onDismiss,
}: {
  readonly items: readonly AttentionItem[];
  readonly busyId: string | null;
  readonly onReopen: (proposal: ProposalView) => void;
  readonly onOpen: (proposal: ProposalView) => void;
  readonly onDismiss: (discrepancy: InboxDiscrepancy) => void;
}) {
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-5 py-4 text-sm text-ink-2">
        <Icon name="check" filled className="size-5 text-good" />
        Nada requiere tu atención. Las disputas y las discrepancias aparecen
        aquí.
      </p>
    );
  return (
    <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
      {items.map((item) =>
        item.kind === 'dispute' ? (
          <DisputeRow
            key={item.id}
            proposal={item.proposal}
            busy={busyId === item.proposal.id}
            onReopen={onReopen}
            onOpen={onOpen}
          />
        ) : (
          <DiscrepancyRow
            key={item.id}
            discrepancy={item.discrepancy}
            busy={busyId === item.discrepancy.id}
            onDismiss={onDismiss}
          />
        ),
      )}
    </ul>
  );
}
