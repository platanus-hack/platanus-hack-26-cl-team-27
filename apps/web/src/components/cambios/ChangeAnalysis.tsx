'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { textLink } from '@/components/common/link-styles';
import { useResource } from '@/hooks/use-resource';
import {
  type ConflictView,
  getChangeConflicts,
  getChangeSuggestions,
  type ProbabilityBand,
} from '@/lib/changes-api';
import { projectPage } from '@/lib/project-paths';

const percent = (probability: number) => `${Math.round(probability * 100)} %`;

const bandText: Record<ProbabilityBand, string> = {
  alta: 'Probabilidad alta',
  media: 'Probabilidad media',
  baja: 'Probabilidad baja',
};

function Block({
  title,
  question,
  children,
}: {
  readonly title: string;
  readonly question: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-sm text-ink-2">{question}</span>
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { readonly children: React.ReactNode }) {
  return <p className="text-sm text-ink-2">{children}</p>;
}

function ConflictItem({
  projectId,
  item,
}: {
  readonly projectId: string;
  readonly item: ConflictView;
}) {
  return (
    <li className="flex flex-col gap-1">
      <p className="font-medium text-ink">
        <Link
          href={
            projectPage(projectId, `/cambios/${item.otherChangeId}`) as Route
          }
          className={textLink}
        >
          {item.otherElement?.name ?? item.otherSummary}
        </Link>{' '}
        <span className="text-ink-2">
          · {bandText[item.band]} ({percent(item.probability)})
        </span>
      </p>
      <p className="text-ink-2">{item.otherSummary}</p>
      <p className="text-ink">{item.reason}</p>
      <p className="text-ink">{item.question}</p>
    </li>
  );
}

export function ChangeAnalysis({
  projectId,
  changeId,
}: {
  readonly projectId: string;
  readonly changeId: string;
}) {
  const key = `${projectId}/${changeId}`;
  const loadSuggestions = useCallback(
    (signal: AbortSignal) => getChangeSuggestions(projectId, changeId, signal),
    [projectId, changeId],
  );
  const loadConflicts = useCallback(
    (signal: AbortSignal) => getChangeConflicts(projectId, changeId, signal),
    [projectId, changeId],
  );
  const suggestions = useResource(loadSuggestions, `suggestions/${key}`);
  const conflicts = useResource(loadConflicts, `conflicts/${key}`);

  const asked = suggestions.data?.ask ?? [];
  const watched = suggestions.data?.watch ?? [];
  const found = conflicts.data?.conflicts ?? [];
  const overlaps = conflicts.data?.overlaps ?? [];

  return (
    <>
      <Block title="Resolvedor de dependencias" question="¿A quién afecta?">
        {suggestions.error ? (
          <Muted>{suggestions.error}</Muted>
        ) : !suggestions.data ? (
          <Muted>Buscando a quién más le afecta…</Muted>
        ) : asked.length + watched.length === 0 ? (
          <Muted>No vemos a nadie más afectado.</Muted>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {[...asked, ...watched].map((item) => (
              <li key={item.stakeholderId} className="flex flex-col gap-1">
                <p className="font-medium text-ink">
                  {item.name}
                  {item.role ? `, ${item.role}` : ''}{' '}
                  <span className="text-ink-2">
                    · {bandText[item.band]} ({percent(item.probability)})
                  </span>
                </p>
                <p className="text-ink-2">{item.reason}</p>
                <p className="text-ink">{item.question}</p>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Detector de conflictos" question="¿Choca con otro cambio?">
        {conflicts.error ? (
          <Muted>{conflicts.error}</Muted>
        ) : !conflicts.data ? (
          <Muted>Revisando si choca con otros cambios…</Muted>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            {overlaps.length > 0 && (
              <ul className="flex flex-col gap-2">
                {overlaps.map((overlap) => (
                  <li key={overlap.id} className="font-medium text-ink">
                    Solapamiento {overlap.status}: {overlap.title}
                  </li>
                ))}
              </ul>
            )}
            {found.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {found.map((item) => (
                  <ConflictItem
                    key={item.otherChangeId}
                    projectId={projectId}
                    item={item}
                  />
                ))}
              </ul>
            ) : overlaps.length === 0 ? (
              <Muted>
                {conflicts.data.inference === 'unavailable'
                  ? 'No pudimos estimar choques con otros cambios: falta configurar Claude o Gemini.'
                  : 'No choca con otros cambios recientes.'}
              </Muted>
            ) : null}
          </div>
        )}
      </Block>
    </>
  );
}
