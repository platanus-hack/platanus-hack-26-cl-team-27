import { StatusChip } from '@/components/common/StatusChip';
import { OUTCOME_LABEL, OUTCOME_TONE } from '@/components/common/status';
import { ValueLink } from '@/components/common/ValueLink';
import { formatValue } from '@/lib/format';
import type { RevisionView } from '@/lib/spaces-api';

export function RevisionFacts({
  revision,
}: {
  readonly revision: RevisionView;
}) {
  if (revision.claims.length === 0)
    return <p className="text-sm text-ink-2">Esta revisión no trae hechos.</p>;
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {revision.claims.map((claim) => (
        <li
          key={`${claim.subjectId}/${claim.attribute}/${claim.role}`}
          className="flex flex-col gap-1 py-2"
        >
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="min-w-0 text-ink">
              <span className="text-ink-2">
                {claim.role === 'afirma' ? 'Afirma' : 'Usa'}
              </span>{' '}
              <ValueLink
                subjectId={claim.subjectId}
                attribute={claim.attribute}
              >
                {claim.label}
              </ValueLink>
            </p>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {formatValue(claim.value, claim.unit)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-2">«{claim.locator}»</span>
            <StatusChip
              tone={OUTCOME_TONE[claim.outcome]}
              icon="dot"
              label={OUTCOME_LABEL[claim.outcome]}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
