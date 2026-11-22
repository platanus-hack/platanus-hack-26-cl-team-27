import { Icon } from '@/components/common/Icon';
import { IconBadge } from '@/components/common/IconBadge';
import { RelativeTime } from '@/components/common/RelativeTime';
import { StateMark } from '@/components/common/StateMark';
import { formatSignedCLP, formatSignedDays, joinNames } from '@/lib/format';
import type { OverlapView, ProposalView } from '@/lib/proposals-api';

const RESOLUTION_TEXT: Record<string, string> = {
  retirada: 'una de las propuestas se retiró',
  reemplazada: 'una revisión nueva reemplazó la propuesta',
  sin_area_comun: 'los elementos ya no comparten área',
  otra_propuesta_cerrada: 'la otra propuesta se cerró',
};

export const conflictOutcome = (overlap: OverlapView): string | null => {
  if (overlap.status === 'descartado') {
    const voters = overlap.votes
      .filter((vote) => vote.kind === 'no_se_tocan')
      .map((vote) => vote.validatorName);
    return `Choque descartado: ${voters.length > 0 ? `${joinNames(voters)} ${voters.length === 1 ? 'dijo' : 'dijeron'} que no se tocan` : 'no se tocan'}.`;
  }
  if (overlap.status === 'resuelto') {
    return `Choque resuelto: ${RESOLUTION_TEXT[overlap.resolution ?? ''] ?? 'ya no hay choque'}.`;
  }
  return null;
};

export function ChangeCoordinated({
  proposal,
}: {
  readonly proposal: ProposalView;
}) {
  if (proposal.status !== 'merged') return null;
  const confirmed = proposal.reviewers.filter(
    (reviewer) => reviewer.decision === 'approve',
  );
  const notAffected = proposal.filtered.filter((person) => person.notAffected);
  const outcomes = proposal.overlaps.flatMap((overlap) => {
    const text = conflictOutcome(overlap);
    return text ? [{ id: overlap.id, title: overlap.title, text }] : [];
  });
  const figures = [
    ...(proposal.costDelta !== 0
      ? [`costo ${formatSignedCLP(proposal.costDelta)}`]
      : []),
    ...(proposal.delayDays !== 0
      ? [`plazo ${formatSignedDays(proposal.delayDays)}`]
      : []),
  ];

  return (
    <section className="relative overflow-hidden rounded-lg border border-good/40 bg-good/5 p-4">
      <div className="flex items-center gap-3">
        <span className="relative inline-grid">
          <span className="absolute inset-0 animate-ping-soft rounded-xl bg-good" />
          <IconBadge
            icon="handshake"
            tone="good"
            size="lg"
            className="relative animate-pop"
          />
        </span>
        <StateMark tone="good" icon="check" label="Cambio coordinado" large />
      </div>
      <p className="mt-2 text-sm text-ink-2">
        Vigente
        {proposal.mergedAt && (
          <>
            {' '}
            desde <RelativeTime at={proposal.mergedAt} />
          </>
        )}
        .{' '}
        {figures.length > 0
          ? `Impacto final: ${figures.join(' · ')}.`
          : 'No mueve el costo ni el plazo.'}
      </p>
      <ul className="stagger mt-3 flex flex-col gap-1 text-sm text-ink">
        {confirmed.map((reviewer) => (
          <li key={reviewer.stakeholderId} className="flex items-start gap-1.5">
            <Icon name="userCheck" className="mt-0.5 text-good" />
            {reviewer.name} confirmó{' '}
            <RelativeTime at={reviewer.at} className="text-ink-2" />
            {reviewer.note ? `: «${reviewer.note}»` : ''}
          </li>
        ))}
        {notAffected.map((person) => (
          <li key={person.stakeholderId} className="flex items-start gap-1.5">
            <Icon name="ban" className="mt-0.5 text-ink-3" />
            {person.name} dijo que no le afecta
          </li>
        ))}
        {confirmed.length + notAffected.length === 0 && (
          <li>No había a quién pedirle confirmación.</li>
        )}
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex items-start gap-1.5">
            <Icon name="seal" className="mt-0.5 text-good" />
            {outcome.text} <span className="text-ink-2">{outcome.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
