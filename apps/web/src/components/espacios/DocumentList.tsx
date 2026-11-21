import { DocumentStateMark } from '@/components/common/status';
import type { DocumentView } from '@/lib/spaces-api';

import { RevisionRow } from './RevisionRow';

export function DocumentList({
  documents,
}: {
  readonly documents: readonly DocumentView[];
}) {
  if (documents.length === 0)
    return (
      <p className="text-sm text-ink-2">Este espacio no tiene documentos.</p>
    );
  return (
    <ul className="flex flex-col gap-5">
      {documents.map((document) => (
        <li key={document.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-ink">
              {document.title}
            </h3>
            <DocumentStateMark state={document.state} />
          </div>
          <p className="text-sm text-ink-2">Dueño: {document.ownerName}</p>
          {document.acknowledgedNote && (
            <p className="text-sm text-ink">
              Nota: «{document.acknowledgedNote}»
            </p>
          )}
          <ul className="mt-2 flex flex-col gap-2">
            {document.revisions.map((revision) => (
              <RevisionRow key={revision.id} revision={revision} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
