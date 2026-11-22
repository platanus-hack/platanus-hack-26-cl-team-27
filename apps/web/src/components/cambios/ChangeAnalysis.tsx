'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback } from 'react';

import { Icon, type IconName } from '@/components/common/Icon';
import { IconBadge, Meter } from '@/components/common/IconBadge';
import { textLink } from '@/components/common/link-styles';
import { Avatar } from '@/components/common/Avatar';
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

import { ChangeFollowUp, deliveryIcon, deliveryText } from './ChangeFollowUp';
import { ImpactFigures } from './ImpactFigures';
import { OverlapVotes } from './OverlapVotes';

const percent = (probability: number) => `${Math.round(probability * 100)} %`;

const bandText: Record<ProbabilityBand, string> = {
  alta: 'Probabilidad alta',
  media: 'Probabilidad media',
  baja: 'Probabilidad baja',
};

const bandTone = {
  alta: 'critical',
  media: 'warning',
  baja: 'accent',
} as const satisfies Record<ProbabilityBand, string>;

function Probability({
  band,
  probability,
}: {
  readonly band: ProbabilityBand;
  readonly probability: number;
}) {
  return (
    <span className="flex items-center gap-2 text-xs text-ink-2">
      <span className="w-20">
        <Meter
          value={probability}
          tone={bandTone[band]}
          label={bandText[band]}
        />
      </span>
      <span className="font-mono tabular-nums">{percent(probability)}</span>
    </span>
  );
}

function Block({
  title,
  icon,
  question,
  children,
}: {
  readonly title: string;
  readonly icon: IconName;
  readonly question: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <IconBadge icon={icon} size="sm" />
          {title}
        </h3>
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
    <li className="flex gap-3">
      <IconBadge
        icon="conflict"
        tone={item.band === 'alta' ? 'critical' : 'warning'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <p className="font-medium text-ink">
            <Link
              href={
                projectPage(
                  projectId,
                  `/cambios/${item.otherChangeId}`,
                ) as Route
              }
              className={textLink}
            >
              {item.otherElement?.name ?? item.otherSummary}
            </Link>
          </p>
          <Probability band={item.band} probability={item.probability} />
        </div>
        <p className="text-ink-2">{item.otherSummary}</p>
        <p className="text-ink">{item.reason}</p>
        <p className="flex items-start gap-1.5 text-ink">
          <Icon name="chat" className="mt-0.5 text-accent-text" />
          {item.question}
        </p>
      </div>
    </li>
  );
}

const channelText: Record<NoticeChannel, string> = {
  email: 'Correo',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
};

const channelIcon: Record<NoticeChannel, IconName> = {
  email: 'mail',
  whatsapp: 'whatsapp',
  slack: 'slack',
};

function NoticeCard({
  notice,
}: {
  readonly notice: NoticePreview | ConflictNoticePreview;
}) {
  const sent = deliveryIcon(notice.delivery);
  return (
    <li className="rounded-lg border border-hairline bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <Avatar name={notice.name} size="sm" />
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">
          {notice.name}
          {notice.role && (
            <span className="font-normal text-ink-2"> · {notice.role}</span>
          )}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
          <Icon name={channelIcon[notice.channel]} className="size-3.5" />
          {channelText[notice.channel]}
        </span>
      </div>
      {notice.channel === 'email' && (
        <p className="mt-3 text-sm text-ink-2">Asunto: {notice.subject}</p>
      )}
      <p className="mt-2 rounded-lg bg-surface-2/60 p-3 text-sm whitespace-pre-wrap text-ink">
        {notice.text}
      </p>
      <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-2">
        <Icon name={sent.icon} className={`mt-0.5 ${sent.className}`} />
        {deliveryText(notice.delivery)}
      </p>
    </li>
  );
}

function NoticeGroup({
  title,
  icon,
  hint,
  empty,
  notices,
}: {
  readonly title: string;
  readonly icon: IconName;
  readonly hint: string;
  readonly empty: string;
  readonly notices: readonly (NoticePreview | ConflictNoticePreview)[];
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name={icon} className="text-ink-3" />
        {title} <span className="font-normal text-ink-2">· {hint}</span>
      </h4>
      {notices.length === 0 ? (
        <Muted>{empty}</Muted>
      ) : (
        <ul className="stagger flex flex-col gap-3">
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
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="zap" className="text-accent-text" />
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
      <Block
        title="Resolvedor de dependencias"
        icon="network"
        question="¿A quién afecta?"
      >
        {suggestions.error ? (
          <Muted>{suggestions.error}</Muted>
        ) : !suggestions.data ? (
          <Muted>Buscando a quién más le afecta…</Muted>
        ) : asked.length + watched.length === 0 ? (
          <Muted>No vemos a nadie más afectado.</Muted>
        ) : (
          <ul className="stagger flex flex-col gap-3 text-sm">
            {[...asked, ...watched].map((item) => (
              <li key={item.stakeholderId} className="flex gap-3">
                <Avatar name={item.name} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3">
                    <p className="font-medium text-ink">
                      {item.name}
                      {item.role && (
                        <span className="font-normal text-ink-2">
                          {' '}
                          · {item.role}
                        </span>
                      )}
                    </p>
                    <Probability
                      band={item.band}
                      probability={item.probability}
                    />
                  </div>
                  <p className="text-ink-2">{item.reason}</p>
                  <p className="flex items-start gap-1.5 text-ink">
                    <Icon name="chat" className="mt-0.5 text-accent-text" />
                    {item.question}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block
        title="Detector de conflictos"
        icon="conflict"
        question="¿Choca con otro cambio?"
      >
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
        icon="calculator"
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
      <Block
        title="Redactor de avisos"
        icon="sparkles"
        question="¿Qué decir a cada rol?"
      >
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
              icon="bell"
              hint="Solo a los afectados"
              empty="Este cambio no afecta a nadie más."
              notices={notices.data.notices}
            />
            <NoticeGroup
              title="Aviso de conflicto"
              icon="conflict"
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
          icon="listChecks"
          question="¿Quién respondió y a quién le recordamos?"
        >
          <ChangeFollowUp followUp={change.followUp} />
        </Block>
      )}
    </>
  );
}
