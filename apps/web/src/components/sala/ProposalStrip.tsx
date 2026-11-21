import { cx } from '@team27/ui';

import { CostDelay } from '@/components/common/CostDelay';
import { Icon } from '@/components/common/Icon';
import { initials } from '@/components/common/initials';
import { FactDiff } from '@/components/cambios/FactDiff';
import { firstName, joinNames } from '@/lib/format';
import {
  STATUS_LABEL,
  type ProposalReviewer,
  type ProposalView,
} from '@/lib/proposals-api';

const DOT = {
  approve: {
    ring: 'border-good bg-good/20 text-good-text',
    icon: 'check',
    label: 'aprobó',
  },
  dispute: {
    ring: 'border-critical bg-critical/20 text-critical-text',
    icon: 'alert',
    label: 'disputa',
  },
  none: {
    ring: 'border-axis bg-surface-2 text-ink-2',
    icon: 'hourglass',
    label: 'pendiente',
  },
} as const;

function Dot({ reviewer }: { readonly reviewer: ProposalReviewer }) {
  const look = DOT[reviewer.decision ?? 'none'];
  return (
    <li className="flex w-24 flex-col items-center gap-1 text-center">
      <span
        className={cx(
          'relative grid size-14 place-items-center rounded-full border-4 text-lg font-semibold',
          look.ring,
        )}
      >
        {initials(reviewer.name)}
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-surface">
          <Icon name={look.icon} className="size-5" />
        </span>
      </span>
      <span className="text-lg leading-tight text-ink">
        {firstName(reviewer.name)}
      </span>
      <span className="text-base text-ink-2">{look.label}</span>
    </li>
  );
}

function ProposalCard({ proposal }: { readonly proposal: ProposalView }) {
  return (
    <article
      className={cx(
        'rounded-xl border p-5',
        proposal.status === 'disputed'
          ? 'border-critical bg-critical/10'
          : 'border-hairline bg-surface',
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-2xl font-semibold text-ink">{proposal.title}</h3>
        <span className="text-xl font-medium text-ink">
          {STATUS_LABEL[proposal.status]}
        </span>
      </header>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <FactDiff diffs={proposal.diffs} large />
        <CostDelay
          costDelta={proposal.costDelta}
          delayDays={proposal.delayDays}
          large
        />
      </div>
      <ul className="mt-4 flex flex-wrap gap-4">
        {proposal.reviewers.map((reviewer) => (
          <Dot key={reviewer.stakeholderId} reviewer={reviewer} />
        ))}
      </ul>
      <p className="mt-3 text-xl text-ink">
        {proposal.progress.missing.length > 0
          ? `Falta ${joinNames(proposal.progress.missing)}`
          : `${proposal.progress.approved} de ${proposal.progress.required} aprobaron`}
      </p>
      {proposal.filtered.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-hairline pt-3">
          {proposal.filtered.map((person) => (
            <li
              key={person.stakeholderId}
              className="flex items-start gap-2 text-lg text-ink-2"
            >
              <Icon name="ban" className="mt-1.5 text-ink-3" />
              <span>
                <span className="font-medium">{person.name}</span> no recibe
                aviso: {person.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProposalStrip({
  proposals,
}: {
  readonly proposals: readonly ProposalView[];
}) {
  if (proposals.length === 0) {
    return (
      <p className="rounded-xl border border-hairline bg-surface p-5 text-xl text-ink-2">
        Sin propuestas abiertas.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  );
}
