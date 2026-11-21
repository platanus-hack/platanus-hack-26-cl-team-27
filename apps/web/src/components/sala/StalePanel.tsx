import { Icon } from '@/components/common/Icon';
import { formatValue } from '@/lib/format';
import type { DocumentView } from '@/lib/spaces-api';

export function StalePanel({
  documents,
}: {
  readonly documents: readonly (DocumentView & { spaceName: string })[];
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-2xl font-semibold text-ink">
        Pendientes de actualizar
      </h2>
      {documents.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-xl text-ink-2">
          <Icon name="check" filled className="size-6 text-good" />
          Todo al día
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {documents.map((document) => (
            <li key={document.id} className="text-xl">
              <p className="flex items-center gap-2 font-medium text-ink">
                <Icon name="hourglass" filled className="size-6 text-serious" />
                {document.title}
              </p>
              <p className="text-lg text-ink-2">
                Dueño: {document.ownerName} · {document.spaceName}
              </p>
              {document.staleFacts.map((fact) => (
                <p
                  key={`${fact.subjectId}/${fact.attribute}`}
                  className="text-lg text-ink"
                >
                  {fact.label}: usa {formatValue(fact.usedValue, fact.unit)}, lo
                  vigente es {formatValue(fact.currentValue, fact.unit)}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
