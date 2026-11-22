import { cx } from '@team27/ui';
import type { ReactNode } from 'react';

import { Avatar } from '@/components/common/Avatar';
import { Icon } from '@/components/common/Icon';
import { RelativeTime } from '@/components/common/RelativeTime';
import { ProposalStatusChip } from '@/components/common/status';
import type { ChangeDetail, Finding } from '@/lib/changes-api';
import { formatValue, joinNames } from '@/lib/format';
import type { ProposalDiff } from '@/lib/proposals-api';

import { td } from './ImpactFigures';

const DECISION_LABEL = {
  approve: 'Aprobó',
  dispute: 'Tiene un problema',
  none: 'Falta su respuesta',
} as const;

const diffsOf = (change: ChangeDetail): readonly ProposalDiff[] =>
  change.proposal?.diffs ?? change.diffs;

function Block({
  title,
  meta,
  children,
}: {
  readonly title: string;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {meta && <span className="text-sm text-ink-2">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

const th = 'py-2 pr-3 text-left text-xs font-medium text-ink-2';

export function FindingList({
  findings,
}: {
  readonly findings: readonly Finding[];
}) {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {findings.map((finding) => (
        <li key={finding.summary}>
          <p className="font-medium text-ink">{finding.summary}</p>
          {finding.details.map((detail) => (
            <p key={detail} className="text-ink-2">
              {detail}
            </p>
          ))}
          <p className="mt-1 text-ink">{finding.action}</p>
        </li>
      ))}
    </ul>
  );
}

export const changeTitle = (change: ChangeDetail): string =>
  change.proposal?.title ?? change.summary;

export function ChangeDetailBody({
  change,
  forStakeholder,
  response,
}: {
  readonly change: ChangeDetail;
  readonly forStakeholder: string | null;
  readonly response?: ReactNode;
}) {
  const { proposal, impact } = change;
  const diffs = diffsOf(change);
  const myFindings = forStakeholder
    ? (impact?.findings.filter((f) => f.stakeholderId === forStakeholder) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {proposal && <ProposalStatusChip status={proposal.status} />}
          {proposal && (
            <span className="text-sm text-ink-2">
              Propuesta por {proposal.authorName} ·{' '}
              <RelativeTime at={proposal.openedAt} />
            </span>
          )}
        </div>
        {proposal && proposal.progress.missing.length > 0 && (
          <p className="text-sm text-ink-2">
            Falta {joinNames(proposal.progress.missing)}
          </p>
        )}
      </header>

      {myFindings.length > 0 && (
        <section className="rounded-lg bg-accent-soft/30 p-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">
            Esto te toca a ti
          </h3>
          <FindingList findings={myFindings} />
        </section>
      )}

      <Block title="Qué cambia">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline">
              <th className={th}>Atributo</th>
              <th className={th}>Antes</th>
              <th className={th}>Después</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((diff) => (
              <tr
                key={diff.label}
                className="border-b border-hairline last:border-0"
              >
                <td className={td}>{diff.label}</td>
                <td className={cx(td, 'tabular-nums text-ink-2')}>
                  {diff.before === null
                    ? 'Sin dato'
                    : formatValue(diff.before, diff.unit)}
                </td>
                <td className={cx(td, 'font-semibold tabular-nums')}>
                  {diff.after === null
                    ? 'Se elimina'
                    : formatValue(diff.after, diff.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      {proposal && (
        <Block
          title="Revisión y consenso"
          meta={`${proposal.progress.approved} de ${proposal.progress.required} aprobaron`}
        >
          <ul className="flex flex-col">
            {proposal.reviewers.map((reviewer) => (
              <li
                key={reviewer.stakeholderId}
                className={cx(
                  'flex gap-3 border-b border-hairline py-2.5 last:border-0',
                  forStakeholder === reviewer.stakeholderId &&
                    '-mx-2 rounded-lg border-transparent bg-accent-soft/30 px-2',
                )}
              >
                <Avatar
                  name={reviewer.name}
                  size="sm"
                  decision={reviewer.decision}
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-medium text-ink">
                      {reviewer.name}{' '}
                      <span className="font-normal text-ink-2">
                        · {reviewer.role}
                      </span>
                    </p>
                    <RelativeTime
                      at={reviewer.at}
                      className="text-xs text-ink-2"
                    />
                  </div>
                  <p
                    className={cx(
                      reviewer.decision === 'dispute'
                        ? 'text-critical-text'
                        : reviewer.decision === 'approve'
                          ? 'text-good-text'
                          : 'text-ink-2',
                    )}
                  >
                    {DECISION_LABEL[reviewer.decision ?? 'none']}
                  </p>
                  {reviewer.note && (
                    <p className="mt-1 text-ink">«{reviewer.note}»</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {proposal && proposal.filtered.length > 0 && (
        <Block title="A quién no avisamos">
          <ul className="flex flex-col gap-2">
            {proposal.filtered.map((person) => (
              <li
                key={person.stakeholderId}
                className={cx(
                  'flex gap-2 text-sm text-ink-2',
                  forStakeholder === person.stakeholderId &&
                    '-mx-2 rounded-lg bg-accent-soft/30 p-2',
                )}
              >
                <Icon name="ban" className="mt-0.5 text-ink-3" />
                <p>
                  <span className="font-medium text-ink">{person.name}</span>:{' '}
                  {person.reason}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {response}

      {!impact && !proposal && (
        <p className="text-sm text-ink-2">
          Este cambio no tiene propuesta asociada.
        </p>
      )}
    </div>
  );
}
