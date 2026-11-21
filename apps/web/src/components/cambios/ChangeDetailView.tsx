'use client';

import { Card, Notice } from '@team27/ui';
import Link from 'next/link';
import { useCallback } from 'react';

import { VoteButtons } from '@/components/asiento/VoteButtons';
import { Loading, LoadError } from '@/components/common/LoadState';
import { StateMark } from '@/components/common/StateMark';
import { useHeldSeats } from '@/hooks/use-held-seats';
import { useLive } from '@/hooks/use-live';
import { getChange, type ChangeDetail } from '@/lib/changes-api';
import { joinNames } from '@/lib/format';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { STATUS_LABEL, type ProposalDiff } from '@/lib/proposals-api';

import { FactDiff } from './FactDiff';
import { ImpactSummary } from './ImpactSummary';
import { FilteredList, ReviewerList } from './ReviewerList';

const diffsOf = (change: ChangeDetail): readonly ProposalDiff[] =>
  change.proposal?.diffs ?? change.diffs;

export function ChangeDetailView({
  changeId,
  forStakeholder,
}: {
  readonly changeId: string;
  readonly forStakeholder: string | null;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getChange(changeId, signal),
    [changeId],
  );
  const { data, error, loading, reload } = useLive({
    load,
    intervalMs: DEFAULT_INTERVAL_MS,
    dependencyKey: changeId,
  });
  const seats = useHeldSeats();

  if (loading) return <Loading />;
  if (!data)
    return <LoadError message={error ?? 'No encontramos este cambio.'} />;

  const proposal = data.proposal;
  const mine = data.notifications.find(
    (notification) =>
      seats.ids.includes(notification.stakeholderId) &&
      (!forStakeholder || notification.stakeholderId === forStakeholder),
  );
  const myFindings = forStakeholder
    ? (data.impact?.findings.filter(
        (f) => f.stakeholderId === forStakeholder,
      ) ?? [])
    : [];
  const wrongSeat =
    forStakeholder !== null &&
    seats.ready &&
    !seats.ids.includes(forStakeholder) &&
    proposal?.reviewers.some((r) => r.stakeholderId === forStakeholder);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-ink-2">Propuesta de cambio</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {proposal?.title ?? data.summary}
        </h1>
        {proposal && (
          <p className="mt-1 text-sm text-ink-2">
            {STATUS_LABEL[proposal.status]} · {proposal.authorName}
            {proposal.progress.missing.length > 0 &&
              ` · Falta ${joinNames(proposal.progress.missing)}`}
          </p>
        )}
      </header>

      {myFindings.length > 0 && (
        <Card title="Esto te toca a ti">
          <ul className="flex flex-col gap-3 text-sm">
            {myFindings.map((finding) => (
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
        </Card>
      )}

      <Card title="Qué cambia">
        <FactDiff diffs={diffsOf(data)} />
      </Card>

      {data.impact && (
        <Card title="Impacto">
          <ImpactSummary impact={data.impact} />
        </Card>
      )}

      {proposal && (
        <Card
          title="Quién revisa"
          description={`${proposal.progress.approved} de ${proposal.progress.required} aprobaron`}
        >
          <ReviewerList
            reviewers={proposal.reviewers}
            highlight={forStakeholder}
          />
        </Card>
      )}

      {proposal && proposal.filtered.length > 0 && (
        <Card title="A quién no avisamos">
          <FilteredList
            filtered={proposal.filtered}
            highlight={forStakeholder}
          />
        </Card>
      )}

      {mine && !mine.response && proposal && proposal.status !== 'merged' && (
        <Card title="Tu respuesta">
          <VoteButtons
            notificationId={mine.id}
            seatToken={seats.tokenFor(mine.stakeholderId)}
            onDone={reload}
          />
        </Card>
      )}
      {mine?.response && (
        <Notice tone="success">
          Respondiste:{' '}
          {mine.response.kind === 'reviewed' ? 'Revisado' : 'Tengo un problema'}
          {mine.response.note ? ` · «${mine.response.note}»` : ''}
        </Notice>
      )}
      {wrongSeat && (
        <Notice>
          Este aviso es de otro asiento.{' '}
          <Link className="underline" href="/">
            Elige tu asiento
          </Link>{' '}
          para responder.
        </Notice>
      )}
      {!data.impact && !proposal && (
        <StateMark tone="neutral" icon="minus" label="Sin propuesta asociada" />
      )}
    </div>
  );
}
