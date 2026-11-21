'use client';

import { Card, cx } from '@team27/ui';
import type { Route } from 'next';
import Link from 'next/link';

import { Icon } from '@/components/common/Icon';
import { useFlowHistory } from '@/hooks/use-flow-history';
import type { FlowState } from '@/lib/flow-api';
import type {
  FlowHistory,
  HistoryElement,
  HistoryEntry,
} from '@/lib/flow-history-api';
import {
  approvalText,
  authorText,
  documentText,
  formatHourMinute,
  historyKey,
  pendingText,
} from '@/lib/flow-history';
import { valuePath } from '@/lib/provenance-api';

type Focus = 'P-12' | 'E-B-03' | null;

function EntryRow({ entry }: { readonly entry: HistoryEntry }) {
  const approval = approvalText(entry.approvedBy);
  return (
    <li className="flex flex-col gap-1 border-l-2 border-hairline pl-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
        <span className="font-mono text-ink">{formatHourMinute(entry.at)}</span>
        <span>{authorText(entry)}</span>
        {entry.current && (
          <span className="inline-flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-ink">
            <Icon name="check" className="size-3 text-good" />
            Vigente
          </span>
        )}
      </p>
      <p className="flex items-start gap-1.5 text-sm text-ink-2">
        <Icon name="file" className="mt-0.5 size-3.5 shrink-0" />
        {documentText(entry)}
      </p>
      <p className="break-words font-mono text-xs text-ink">{entry.value}</p>
      {approval && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Icon name="seal" className="size-4 text-good" />
          {approval}
        </p>
      )}
    </li>
  );
}

function ElementBlock({
  element,
  focused,
  viewerId,
}: {
  readonly element: HistoryElement;
  readonly focused: boolean;
  readonly viewerId: string | null;
}) {
  const { pending } = element;
  const rejected = pending?.status === 'rechazada';
  return (
    <section
      aria-label={`Historia de ${element.elementId}`}
      className={cx('flex flex-col gap-3', focused && 'rounded-lg')}
    >
      <h3 className="text-base font-semibold text-ink">{element.name}</h3>
      <ol className="flex flex-col gap-3">
        {pending && (
          <li className="flex flex-col gap-1 rounded-md border border-dashed border-hairline-strong px-3 py-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Icon
                name={rejected ? 'alert' : 'hourglass'}
                className={cx(
                  'size-4',
                  rejected ? 'text-critical' : 'text-warning',
                )}
              />
              {pendingText(pending, viewerId)}
            </p>
            <p className="text-xs text-ink-3">
              {formatHourMinute(pending.at)} · por {pending.by.name}
            </p>
            <p className="break-words font-mono text-xs text-ink">
              {pending.value}
            </p>
          </li>
        )}
        {element.entries.map((entry) => (
          <EntryRow key={`${entry.kind}:${entry.at}`} entry={entry} />
        ))}
      </ol>
      <Link
        href={valuePath(element.subjectId, element.attribute) as Route}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-2"
      >
        <Icon name="external" className="size-3.5" />
        Ver procedencia
      </Link>
    </section>
  );
}

export function HistoryPanel({
  history,
  focus = null,
  wide = false,
  viewerId = null,
}: {
  readonly history: FlowHistory | null;
  readonly focus?: Focus;
  readonly wide?: boolean;
  readonly viewerId?: string | null;
}) {
  if (!history || history.elements.length === 0) return null;
  const elements = history.elements;
  return (
    <Card
      title="Historia"
      description="Qué es vigente, quién lo cambió y quién lo aprobó."
    >
      <div
        className={cx(
          'flex flex-col gap-5',
          wide && 'lg:grid lg:grid-cols-2 lg:gap-6',
        )}
      >
        {elements.map((element) => (
          <ElementBlock
            key={element.elementId}
            element={element}
            focused={focus === element.elementId}
            viewerId={viewerId}
          />
        ))}
      </div>
    </Card>
  );
}

export function CaseHistory({
  flow,
  focus = null,
  wide = false,
  viewerId = null,
}: {
  readonly flow: FlowState;
  readonly focus?: Focus;
  readonly wide?: boolean;
  readonly viewerId?: string | null;
}) {
  const { data } = useFlowHistory({ key: historyKey(flow) });
  return (
    <HistoryPanel
      history={data}
      focus={focus}
      wide={wide}
      viewerId={viewerId}
    />
  );
}
