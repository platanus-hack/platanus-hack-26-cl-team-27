import { cx } from '@team27/ui';

import { Icon } from '@/components/common/Icon';
import { formatClock, formatValue } from '@/lib/format';
import type { ProvenanceResponse } from '@/lib/provenance-api';

const DECISION = {
  approve: { icon: 'check', label: 'Aprobó', tone: 'text-good' },
  dispute: { icon: 'alert', label: 'Tuvo un problema', tone: 'text-critical' },
  none: { icon: 'hourglass', label: 'Sin respuesta', tone: 'text-ink-3' },
} as const;

export function ProvenanceChain({
  provenance,
  large = false,
}: {
  readonly provenance: ProvenanceResponse;
  readonly large?: boolean;
}) {
  const body = large ? 'text-lg' : 'text-sm';
  return (
    <div className={cx('flex flex-col gap-5', body)}>
      <div>
        <p className="text-ink-2">{provenance.label}</p>
        <p
          className={cx(
            'font-semibold tabular-nums text-ink',
            large ? 'text-5xl' : 'text-3xl',
          )}
        >
          {formatValue(provenance.current.value, provenance.current.unit)}
        </p>
      </div>
      <ol className="flex flex-col gap-4">
        {provenance.chain.map((step, index) => (
          <li
            key={`${step.revision.id}-${index}`}
            className={cx(
              'rounded-lg border p-4',
              step.current
                ? 'border-accent bg-accent-soft/20'
                : 'border-hairline bg-surface-2',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">
                {formatValue(step.value, step.unit)}
                <span className="ml-2 font-normal text-ink-2">
                  {step.current ? 'Vigente' : 'Valor anterior'}
                </span>
              </p>
              <p className="text-ink-2">
                {formatClock(step.revision.capturedAt)}
              </p>
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="text-ink-2">Revisión</dt>
              <dd className="text-ink">
                {step.revision.title} · {step.revision.label}
              </dd>
              <dt className="text-ink-2">Origen</dt>
              <dd className="break-all font-mono text-[0.9em] text-ink">
                {step.revision.pointer}
              </dd>
              <dt className="text-ink-2">Espacio</dt>
              <dd className="text-ink">{step.space.name}</dd>
              <dt className="text-ink-2">Autor</dt>
              <dd className="text-ink">{step.author.name}</dd>
              <dt className="text-ink-2">En el documento</dt>
              <dd className="text-ink">
                {step.claim.role === 'afirma' ? 'Lo afirma' : 'Lo usa'} ·{' '}
                {step.claim.locator}
              </dd>
              {step.proposal && (
                <>
                  <dt className="text-ink-2">Propuesta</dt>
                  <dd className="text-ink">
                    {step.proposal.status} · {formatClock(step.proposal.at)}
                  </dd>
                </>
              )}
            </dl>
            {step.reviews.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
                {step.reviews.map((review) => {
                  const look = DECISION[review.decision ?? 'none'];
                  return (
                    <li key={review.stakeholderId} className="flex gap-2">
                      <Icon
                        name={look.icon}
                        filled
                        className={cx('mt-1', look.tone)}
                      />
                      <span className="text-ink">
                        <span className="font-medium">{review.name}</span>{' '}
                        <span className="text-ink-2">
                          {look.label}
                          {review.at ? ` a las ${formatClock(review.at)}` : ''}
                        </span>
                        {review.note && (
                          <span className="block text-ink-2">
                            «{review.note}»
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {step.backedBy.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-hairline pt-3">
                {step.backedBy.map((backed, backedIndex) => (
                  <li key={backedIndex} className="text-ink">
                    Respaldó una discrepancia: {backed.revisionTitle} (
                    {backed.spaceName}, {backed.authorName}) decía{' '}
                    {formatValue(backed.weakValue, step.unit)}.
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {provenance.corroborations.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink">También lo dicen</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {provenance.corroborations.map((item, index) => (
              <li key={index} className="text-ink-2">
                {item.revisionTitle} · {item.label} · {item.spaceName} (
                {item.role === 'afirma' ? 'lo afirma' : 'lo usa'})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
