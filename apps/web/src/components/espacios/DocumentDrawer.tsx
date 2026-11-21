'use client';

import { Drawer } from '@/components/common/Drawer';
import { Icon } from '@/components/common/Icon';
import { RelativeTime } from '@/components/common/RelativeTime';
import { DocumentStateChip } from '@/components/common/status';
import { formatClock, formatValue } from '@/lib/format';
import {
  revisionsNewestFirst,
  type PlacedDocument,
  type RevisionView,
} from '@/lib/spaces-api';

import { RevisionFacts } from './RevisionFacts';

function RevisionHeader({ revision }: { readonly revision: RevisionView }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        {revision.label}
        {revision.current && (
          <span className="rounded-full bg-accent-soft/40 px-2 py-0.5 text-xs font-medium text-ink">
            Revisión vigente
          </span>
        )}
      </p>
      <p className="text-xs text-ink-2">
        {revision.author.name} ·{' '}
        <span title={formatClock(revision.capturedAt)}>
          <RelativeTime at={revision.capturedAt} />
        </span>
      </p>
      <p className="break-all font-mono text-xs text-ink-2">
        {revision.pointer}
      </p>
    </div>
  );
}

export function DocumentDrawer({
  document,
  onClose,
}: {
  readonly document: PlacedDocument;
  readonly onClose: () => void;
}) {
  const [current, ...older] = revisionsNewestFirst(document);
  return (
    <Drawer
      eyebrow={document.spaceName}
      title={document.title}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink-2">Estado</dt>
          <dd>
            <DocumentStateChip state={document.state} />
          </dd>
          <dt className="text-ink-2">Responsable</dt>
          <dd className="text-ink">{document.ownerName}</dd>
          <dt className="text-ink-2">Espacio</dt>
          <dd className="text-ink">{document.spaceName}</dd>
        </dl>

        {document.staleFacts.length > 0 && (
          <section className="rounded-lg bg-serious/10 p-3 text-sm">
            <p className="font-medium text-ink">
              Quedó desfasado respecto de lo vigente
            </p>
            {document.staleFacts.map((fact) => (
              <p
                key={`${fact.subjectId}/${fact.attribute}`}
                className="tabular-nums text-ink"
              >
                {fact.label}: usa {formatValue(fact.usedValue, fact.unit)}, lo
                vigente es {formatValue(fact.currentValue, fact.unit)}
              </p>
            ))}
            <p className="mt-1 text-ink-2">
              Cuando su responsable suba la revisión nueva a su espacio, la
              leemos solos.
            </p>
          </section>
        )}
        {document.acknowledgedNote && (
          <section className="rounded-lg bg-warning/15 p-3 text-sm">
            <p className="font-medium text-ink">Confirmado sin cambio</p>
            <p className="text-ink">«{document.acknowledgedNote}»</p>
          </section>
        )}

        {current && (
          <section className="border-t border-hairline pt-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Última revisión
            </h3>
            <RevisionHeader revision={current} />
            <div className="mt-3">
              <RevisionFacts revision={current} />
            </div>
          </section>
        )}

        {older.length > 0 && (
          <section className="border-t border-hairline pt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Revisiones anteriores
            </h3>
            <ul className="flex flex-col divide-y divide-hairline">
              {older.map((revision) => (
                <li key={revision.id}>
                  <details className="group py-2">
                    <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                      <Icon
                        name="chevron"
                        className="mt-0.5 text-ink-3 transition-transform group-open:rotate-90"
                      />
                      <RevisionHeader revision={revision} />
                    </summary>
                    <div className="mt-2 pl-6">
                      <RevisionFacts revision={revision} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-ink-2">
          Nadie migró nada: mostramos el puntero al origen, no el archivo.
        </p>
      </div>
    </Drawer>
  );
}
