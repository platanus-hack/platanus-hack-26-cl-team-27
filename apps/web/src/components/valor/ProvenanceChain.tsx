'use client';

import { cx } from '@team27/ui';
import Link from 'next/link';
import type { Route } from 'next';

import { Avatar } from '@/components/common/Avatar';
import { textLink } from '@/components/common/link-styles';
import { RelativeTime } from '@/components/common/RelativeTime';
import {
  ProposalStatusChip,
  ValueStatusChip,
} from '@/components/common/status';
import { useProjectId } from '@/components/proyectos/ProjectContext';
import { formatClock, formatValue } from '@/lib/format';
import { projectPage } from '@/lib/project-paths';
import type { ProvenanceResponse, ProvenanceStep } from '@/lib/provenance-api';

const DECISION = {
  approve: 'Aprobó',
  dispute: 'Tuvo un problema',
  none: 'Sin respuesta',
} as const;

export const documentPath = (
  projectId: string,
  spaceId: string,
  revisionId: string,
): string =>
  projectPage(
    projectId,
    `/espacios?espacio=${encodeURIComponent(spaceId)}&revision=${encodeURIComponent(revisionId)}`,
  );

function Step({
  step,
  changeIdOf,
}: {
  readonly step: ProvenanceStep;
  readonly changeIdOf: (proposalId: string) => string | null;
}) {
  const projectId = useProjectId();
  const changeId = step.proposal ? changeIdOf(step.proposal.id) : null;
  return (
    <li className="relative pb-6 pl-7 last:pb-0">
      <span
        aria-hidden
        className={cx(
          'absolute top-1.5 -left-[7px] size-3.5 rounded-full border-2',
          step.current ? 'border-accent bg-accent' : 'border-axis bg-plane',
        )}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-base font-semibold tabular-nums text-ink">
          {formatValue(step.value, step.unit)}
          <span
            className={cx(
              'ml-2 text-sm font-medium',
              step.current ? 'text-accent-text' : 'text-ink-2',
            )}
          >
            {step.current ? 'Vigente' : 'Valor anterior'}
          </span>
        </p>
        <span
          className="text-sm text-ink-2"
          title={formatClock(step.revision.capturedAt)}
        >
          <RelativeTime at={step.revision.capturedAt} />
        </span>
      </div>
      <p className="mt-1 text-sm text-ink">
        {step.revision.title} · {step.revision.label}{' '}
        <span className="text-ink-2">
          {step.claim.role === 'afirma' ? 'lo afirma' : 'lo usa'} en «
          {step.claim.locator}»
        </span>
      </p>
      <p className="text-sm text-ink-2">
        {step.space.name} · {step.author.name}
      </p>
      <p className="mt-0.5 break-all font-mono text-xs text-ink-2">
        {step.revision.pointer}
      </p>

      {step.backedBy.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
          {step.backedBy.map((backed, index) => (
            <li key={index}>
              Respaldó una discrepancia: {backed.revisionTitle} (
              {backed.spaceName}, {backed.authorName}) decía{' '}
              {formatValue(backed.weakValue, step.unit)}.
            </li>
          ))}
        </ul>
      )}

      {step.proposal && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              Propuesta
              <ProposalStatusChip status={step.proposal.status} />
            </p>
            <span className="text-xs text-ink-2">
              <RelativeTime at={step.proposal.at} />
            </span>
          </div>
          {step.reviews.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {step.reviews.map((review) => (
                <li key={review.stakeholderId} className="flex gap-2.5 text-sm">
                  <Avatar
                    name={review.name}
                    size="sm"
                    decision={review.decision}
                  />
                  <div className="min-w-0">
                    <p className="text-ink">
                      <span className="font-medium">{review.name}</span>{' '}
                      <span className="text-ink-2">
                        {DECISION[review.decision ?? 'none']}
                        {review.at ? ` a las ${formatClock(review.at)}` : ''}
                      </span>
                    </p>
                    {review.note && (
                      <p className="text-ink-2">«{review.note}»</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {changeId && (
            <Link
              href={projectPage(projectId, `/cambios/${changeId}`) as Route}
              className={cx(textLink, 'mt-2 text-sm')}
            >
              Ver la propuesta →
            </Link>
          )}
        </div>
      )}

      <Link
        href={documentPath(projectId, step.space.id, step.revision.id) as Route}
        className={cx(textLink, 'mt-2 text-sm')}
      >
        Ver el documento →
      </Link>
    </li>
  );
}

export function ProvenanceSummary({
  provenance,
}: {
  readonly provenance: ProvenanceResponse;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-ink-2">{provenance.label}</p>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
          {formatValue(provenance.current.value, provenance.current.unit)}
        </p>
      </div>
      <ValueStatusChip status={provenance.current.status} />
    </div>
  );
}

export function ProvenanceChain({
  provenance,
  changeIdOf,
}: {
  readonly provenance: ProvenanceResponse;
  readonly changeIdOf: (proposalId: string) => string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Cadena de procedencia
        </h3>
        <ol className="ml-2 border-l border-hairline">
          {provenance.chain.map((step, index) => (
            <Step
              key={`${step.revision.id}-${index}`}
              step={step}
              changeIdOf={changeIdOf}
            />
          ))}
        </ol>
      </section>
      {provenance.corroborations.length > 0 && (
        <section className="border-t border-hairline pt-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">
            También lo dicen
          </h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {provenance.corroborations.map((item, index) => (
              <li key={index} className="text-ink">
                {item.revisionTitle} · {item.label}{' '}
                <span className="text-ink-2">
                  · {item.spaceName} ·{' '}
                  {item.role === 'afirma' ? 'lo afirma' : 'lo usa'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
