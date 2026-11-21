import { cx } from '@team27/ui';

import { Avatar } from '@/components/common/Avatar';
import { costText } from '@/components/common/CostDelay';
import { Icon } from '@/components/common/Icon';
import { ProposalStatusChip } from '@/components/common/status';
import { firstName, formatSignedDays, joinNames } from '@/lib/format';
import { changeOf, disputersOf, type ProposalView } from '@/lib/proposals-api';

const DECISION_WORD = {
  approve: 'Aprobó',
  dispute: 'Disputa',
  none: 'Pendiente',
} as const;

const statusLine = (proposal: ProposalView): string => {
  const [disputer] = disputersOf(proposal);
  if (disputer)
    return `${firstName(disputer.name)} tiene un problema${disputer.note ? `: «${disputer.note}»` : ''}`;
  return proposal.progress.missing.length > 0
    ? `Falta ${joinNames(proposal.progress.missing)}`
    : 'Todos aprobaron';
};

function ProposalRow({
  proposal,
  onOpen,
}: {
  readonly proposal: ProposalView;
  readonly onOpen: (proposal: ProposalView) => void;
}) {
  const disputed = proposal.status === 'disputed';
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(proposal)}
        className={cx(
          'grid w-full gap-x-5 gap-y-3 rounded-xl border bg-surface p-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto]',
          'hover:border-axis focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          disputed ? 'border-critical/60' : 'border-hairline',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold text-ink">
              {proposal.elementName}{' '}
              <span className="tabular-nums">· {changeOf(proposal)}</span>
            </h3>
            <ProposalStatusChip status={proposal.status} />
          </div>
          <p
            className={cx(
              'mt-1 text-sm',
              disputed ? 'text-critical-text' : 'text-ink-2',
            )}
          >
            {statusLine(proposal)}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {proposal.reviewers.map((reviewer) => (
              <li
                key={reviewer.stakeholderId}
                className="flex items-center gap-2"
              >
                <Avatar
                  name={reviewer.name}
                  size="sm"
                  decision={reviewer.decision}
                />
                <span className="text-sm leading-tight">
                  <span className="block text-ink">
                    {firstName(reviewer.name)}
                  </span>
                  <span className="block text-xs text-ink-2">
                    {DECISION_WORD[reviewer.decision ?? 'none']}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-hairline sm:flex-col sm:flex-nowrap sm:items-end sm:gap-1 sm:border-l sm:pl-5 sm:text-right">
          <p className="text-xl font-semibold tabular-nums text-ink">
            {costText(proposal.costDelta)}
          </p>
          <p className="text-base tabular-nums text-ink">
            {formatSignedDays(proposal.delayDays)}
          </p>
          <p className="text-sm text-ink-2">
            {proposal.progress.approved} de {proposal.progress.required}{' '}
            aprobaron
          </p>
        </div>
        {proposal.filtered.length > 0 && (
          <ul className="flex flex-col gap-1 border-t border-hairline pt-3 sm:col-span-2">
            {proposal.filtered.map((person) => (
              <li
                key={person.stakeholderId}
                className="flex items-start gap-2 text-sm text-ink-2"
              >
                <Icon name="ban" className="mt-0.5 text-ink-3" />
                <span>
                  <span className="font-medium text-ink">{person.name}</span> no
                  recibe aviso: {person.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </button>
    </li>
  );
}

export function ProposalList({
  proposals,
  onOpen,
}: {
  readonly proposals: readonly ProposalView[];
  readonly onOpen: (proposal: ProposalView) => void;
}) {
  if (proposals.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-axis px-4 py-5 text-sm text-ink-2">
        No hay propuestas abiertas. Cuando llegue un documento que cambie algo,
        aparece aquí.
      </p>
    );
  return (
    <ul className="flex flex-col gap-3">
      {proposals.map((proposal) => (
        <ProposalRow key={proposal.id} proposal={proposal} onOpen={onOpen} />
      ))}
    </ul>
  );
}
