import { Icon } from '@/components/common/Icon';
import { DocumentStateChip } from '@/components/common/status';
import { formatValue } from '@/lib/format';
import type { PlacedDocument } from '@/lib/spaces-api';

export function PendingDocuments({
  documents,
  onOpen,
}: {
  readonly documents: readonly PlacedDocument[];
  readonly onOpen: (document: PlacedDocument) => void;
}) {
  if (documents.length === 0)
    return (
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Icon name="check" filled className="size-5 text-good" />
        Todo al día
      </p>
    );
  return (
    <ul className="-mx-2 flex flex-col">
      {documents.map((document) => (
        <li key={document.id}>
          <button
            type="button"
            onClick={() => onOpen(document)}
            className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{document.title}</p>
                <DocumentStateChip state={document.state} />
              </div>
              <p className="text-sm text-ink-2">
                {document.ownerName} · {document.spaceName}
              </p>
              {document.staleFacts.map((fact) => (
                <p
                  key={`${fact.subjectId}/${fact.attribute}`}
                  className="text-sm tabular-nums text-ink"
                >
                  {fact.label}: usa {formatValue(fact.usedValue, fact.unit)}, lo
                  vigente es {formatValue(fact.currentValue, fact.unit)}
                </p>
              ))}
            </div>
            <Icon name="chevron" className="mt-1 text-ink-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
