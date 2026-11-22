'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { textLink } from '@/components/common/link-styles';
import { useResource } from '@/hooks/use-resource';
import {
  type ChangeDetail,
  type CombinedImpactView,
  type ConflictNoticePreview,
  type ConflictView,
  getChangeConflicts,
  getChangeNotices,
  getChangeSuggestions,
  type NoticeChannel,
  type NoticePreview,
  type ProbabilityBand,
} from '@/lib/changes-api';
import { projectPage } from '@/lib/project-paths';

import { ChangeFollowUp, deliveryText } from './ChangeFollowUp';
import { ImpactFigures } from './ImpactFigures';
import { OverlapVotes } from './OverlapVotes';

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

const channelText: Record<NoticeChannel, string> = {
  email: 'Correo',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
};

function NoticeCard({
  notice,
}: {
  readonly notice: NoticePreview | ConflictNoticePreview;
}) {
  return (
    <li className="rounded-lg border border-hairline p-4">
      <p className="text-sm font-medium text-ink">
        {notice.name}
        {notice.role ? `, ${notice.role}` : ''}{' '}
        <span className="font-normal text-ink-2">
          · {channelText[notice.channel]}
        </span>
      </p>
      {notice.channel === 'email' && (
        <p className="mt-2 text-sm text-ink-2">Asunto: {notice.subject}</p>
      )}
      <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{notice.text}</p>
      <p className="mt-3 border-t border-hairline pt-2 text-sm text-ink-2">
        {deliveryText(notice.delivery)}
      </p>
    </li>
  );
}

function NoticeGroup({
  title,
  hint,
  empty,
  notices,
}: {
  readonly title: string;
  readonly hint: string;
  readonly empty: string;
  readonly notices: readonly (NoticePreview | ConflictNoticePreview)[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-ink">
        {title} <span className="font-normal text-ink-2">· {hint}</span>
      </h4>
      {notices.length === 0 ? (
        <Muted>{empty}</Muted>
      ) : (
        <ul className="flex flex-col gap-3">
          {notices.map((notice) => (
            <NoticeCard key={notice.notificationId} notice={notice} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CombinedImpact({
  withName,
  combined,
}: {
  readonly withName: string;
  readonly combined: CombinedImpactView;
}) {
  return (
    <section className="rounded-lg bg-accent-soft/30 p-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">
        Junto con {withName}
      </h4>
      <ImpactFigures impact={combined} />
      {combined.missingChangeIds.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          Uno de los dos cambios no tiene costo ni plazo calculados: la cifra
          cuenta solo el que sí.
        </p>
      )}
    </section>
  );
}

export function ChangeAnalysis({
  projectId,
  changeId,
  change,
  userId,
  onDone,
}: {
  readonly projectId: string;
  readonly changeId: string;
  readonly change: ChangeDetail;
  readonly userId: string | null;
  readonly onDone: () => void;
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
  const loadNotices = useCallback(
    (signal: AbortSignal) => getChangeNotices(projectId, changeId, signal),
    [projectId, changeId],
  );
  const notices = useResource(loadNotices, `notices/${key}`);

  const asked = suggestions.data?.ask ?? [];
  const watched = suggestions.data?.watch ?? [];
  const found = conflicts.data?.conflicts ?? [];
  const overlaps = conflicts.data?.overlaps ?? [];
  const validations = change.proposal?.overlaps ?? [];
  const { impact, ruleGaps } = change;
  const hasFigures =
    impact !== null &&
    (impact.costDelta !== 0 ||
      impact.delayDays !== 0 ||
      impact.costLines.length > 0 ||
      impact.tasks.length > 0);
  const combined = [
    ...overlaps.flatMap((overlap) =>
      overlap.combinedImpact
        ? [
            {
              key: overlap.id,
              withName: overlap.otherSubjectName,
              combined: overlap.combinedImpact,
            },
          ]
        : [],
    ),
    ...found.flatMap((item) =>
      item.combinedImpact
        ? [
            {
              key: item.otherChangeId,
              withName: item.otherElement?.name ?? item.otherSummary,
              combined: item.combinedImpact,
            },
          ]
        : [],
    ),
  ];

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
        {validations.length > 0 && (
          <div className="mb-3 text-sm">
            <OverlapVotes
              projectId={projectId}
              overlaps={validations}
              userId={userId}
              onDone={onDone}
            />
          </div>
        )}
        {conflicts.error ? (
          <Muted>{conflicts.error}</Muted>
        ) : !conflicts.data ? (
          <Muted>Revisando si choca con otros cambios…</Muted>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
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
            ) : validations.length === 0 ? (
              <Muted>
                {conflicts.data.inference === 'unavailable'
                  ? 'No pudimos estimar choques con otros cambios: falta configurar Claude o Gemini.'
                  : 'No choca con otros cambios recientes.'}
              </Muted>
            ) : null}
          </div>
        )}
      </Block>
      <Block
        title="Calculador de impacto"
        question="¿Cuánto cuesta y cuánto atrasa?"
      >
        <div className="flex flex-col gap-4">
          {impact && hasFigures ? (
            <div>
              <ImpactFigures impact={impact} />
            </div>
          ) : ruleGaps.length === 0 ? (
            <Muted>
              {impact
                ? 'Este cambio no mueve el costo ni el plazo.'
                : 'Todavía no calculamos el costo ni el plazo de este cambio.'}
            </Muted>
          ) : null}
          {ruleGaps.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-ink-2">
              {ruleGaps.map((gap) => (
                <li key={gap.key}>{gap.message}</li>
              ))}
            </ul>
          )}
          {combined.map((item) => (
            <CombinedImpact
              key={item.key}
              withName={item.withName}
              combined={item.combined}
            />
          ))}
        </div>
      </Block>
      <Block title="Redactor de avisos" question="¿Qué decir a cada rol?">
        {notices.error ? (
          <Muted>{notices.error}</Muted>
        ) : !notices.data ? (
          <Muted>Redactando el aviso de cada persona…</Muted>
        ) : notices.data.notices.length +
            notices.data.conflictNotices.length ===
          0 ? (
          <Muted>Este cambio no tiene a quién avisar.</Muted>
        ) : (
          <div className="flex flex-col gap-5">
            <NoticeGroup
              title="Aviso de cambio"
              hint="Solo a los afectados"
              empty="Este cambio no afecta a nadie más."
              notices={notices.data.notices}
            />
            <NoticeGroup
              title="Aviso de conflicto"
              hint="A ambos autores y afectados"
              empty="Este cambio no choca con otro."
              notices={notices.data.conflictNotices}
            />
          </div>
        )}
      </Block>
      {change.followUp && change.followUp.people.length > 0 && (
        <Block
          title="Seguimiento"
          question="¿Quién respondió y a quién le recordamos?"
        >
          <ChangeFollowUp followUp={change.followUp} />
        </Block>
      )}
    </>
  );
}
