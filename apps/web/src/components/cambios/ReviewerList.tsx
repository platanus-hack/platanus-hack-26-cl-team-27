import { cx } from '@team27/ui';

import { Icon } from '@/components/common/Icon';
import { formatClock } from '@/lib/format';
import type { ProposalFiltered, ProposalReviewer } from '@/lib/proposals-api';

const DECISION = {
  approve: { icon: 'check', label: 'Aprobó', tone: 'text-good' },
  dispute: { icon: 'alert', label: 'Tiene un problema', tone: 'text-critical' },
  none: { icon: 'hourglass', label: 'Falta su respuesta', tone: 'text-ink-3' },
} as const;

export function ReviewerList({
  reviewers,
  highlight,
}: {
  readonly reviewers: readonly ProposalReviewer[];
  readonly highlight?: string | null;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {reviewers.map((reviewer) => {
        const look = DECISION[reviewer.decision ?? 'none'];
        return (
          <li
            key={reviewer.stakeholderId}
            className={cx(
              'flex gap-3 rounded-lg p-2',
              highlight === reviewer.stakeholderId && 'bg-accent-soft/30',
            )}
          >
            <Icon
              name={look.icon}
              filled
              className={cx('mt-1 size-5', look.tone)}
            />
            <div className="text-sm">
              <p className="font-medium text-ink">
                {reviewer.name}{' '}
                <span className="font-normal text-ink-2">
                  · {reviewer.role}
                </span>
              </p>
              <p className="text-ink-2">
                {look.label}
                {reviewer.at ? ` · ${formatClock(reviewer.at)}` : ''}
              </p>
              {reviewer.note && (
                <p className="mt-1 text-ink">«{reviewer.note}»</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function FilteredList({
  filtered,
  highlight,
}: {
  readonly filtered: readonly ProposalFiltered[];
  readonly highlight?: string | null;
}) {
  if (filtered.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {filtered.map((person) => (
        <li
          key={person.stakeholderId}
          className={cx(
            'flex gap-3 rounded-lg p-2',
            highlight === person.stakeholderId && 'bg-accent-soft/30',
          )}
        >
          <Icon name="ban" className="mt-1 size-5 text-ink-3" />
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">{person.name}</span> no
            recibió aviso: {person.reason}
          </p>
        </li>
      ))}
    </ul>
  );
}
