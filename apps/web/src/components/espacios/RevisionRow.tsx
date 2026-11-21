import { ValueLink } from '@/components/common/ValueLink';
import { OUTCOME_LABEL } from '@/components/common/status';
import { formatClock, formatValue } from '@/lib/format';
import type { RevisionView } from '@/lib/spaces-api';

export function RevisionRow({ revision }: { readonly revision: RevisionView }) {
  return (
    <li className="rounded-lg border border-hairline bg-surface-2 p-3">
      <p className="text-sm font-medium text-ink">
        {revision.label}
        {revision.current && (
          <span className="ml-2 font-normal text-ink-2">Revisión vigente</span>
        )}
      </p>
      <p className="break-all font-mono text-xs text-ink-2">
        {revision.pointer}
      </p>
      <p className="text-xs text-ink-2">
        {revision.author.name} · {formatClock(revision.capturedAt)}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {revision.claims.map((claim) => (
          <li
            key={`${claim.subjectId}/${claim.attribute}/${claim.role}`}
            className="text-sm text-ink"
          >
            {claim.role === 'afirma' ? 'Afirma' : 'Usa'}{' '}
            <ValueLink subjectId={claim.subjectId} attribute={claim.attribute}>
              {claim.label}
            </ValueLink>
            : {formatValue(claim.value, claim.unit)}{' '}
            <span className="text-ink-2">
              · {claim.locator} · {OUTCOME_LABEL[claim.outcome]}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
