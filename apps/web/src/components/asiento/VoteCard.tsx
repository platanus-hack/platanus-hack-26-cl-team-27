import Link from 'next/link';
import type { Route } from 'next';

import { CostDelay } from '@/components/common/CostDelay';
import { StateMark } from '@/components/common/StateMark';
import { joinNames } from '@/lib/format';
import type { InboxVote } from '@/lib/inbox-api';
import type { VoteResponse } from '@/lib/votes-api';

import { VoteButtons } from './VoteButtons';

export function VoteCard({
  item,
  seatToken,
  onDone,
}: {
  readonly item: InboxVote;
  readonly seatToken: string | null;
  readonly onDone: (response: VoteResponse) => void;
}) {
  const { progress } = item;
  const percent =
    progress.required === 0
      ? 100
      : Math.round((progress.approved / progress.required) * 100);
  const answered = item.response !== null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-ink-2">Lo que te toca</p>
        <ul className="mt-1 flex flex-col gap-2">
          {item.findings.map((finding) => (
            <li key={finding.summary} className="text-sm">
              <p className="font-medium text-ink">{finding.summary}</p>
              {finding.details.map((detail) => (
                <p key={detail} className="text-ink-2">
                  {detail}
                </p>
              ))}
              <p className="text-ink">{finding.action}</p>
            </li>
          ))}
        </ul>
      </div>
      <CostDelay costDelta={item.costDelta} delayDays={item.delayDays} />
      <div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.required}
          aria-valuenow={progress.approved}
          aria-label="Aprobaciones"
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full bg-good transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-ink-2">
          {progress.approved} de {progress.required} aprobaron
          {progress.missing.length > 0 &&
            ` · Falta ${joinNames(progress.missing)}`}
        </p>
      </div>
      {answered && item.response ? (
        <div className="flex flex-col gap-1">
          <StateMark
            tone={item.response.kind === 'reviewed' ? 'good' : 'critical'}
            icon={item.response.kind === 'reviewed' ? 'check' : 'alert'}
            label={
              item.response.kind === 'reviewed'
                ? 'Respondiste: Revisado'
                : 'Respondiste: Tengo un problema'
            }
          />
          {item.response.note && (
            <p className="text-sm text-ink">«{item.response.note}»</p>
          )}
          {item.status === 'disputed' && (
            <p className="text-sm text-ink-2">
              Esperando que la autora reabra con tu observación.
            </p>
          )}
          {item.status === 'merged' && (
            <p className="text-sm text-ink-2">El cambio ya quedó vigente.</p>
          )}
        </div>
      ) : item.status === 'merged' ? (
        <StateMark
          tone="good"
          icon="check"
          label="El cambio ya quedó vigente"
        />
      ) : (
        <VoteButtons
          notificationId={item.notificationId}
          seatToken={seatToken}
          onDone={onDone}
        />
      )}
      <Link
        href={item.link as Route}
        className="text-sm font-medium text-accent-text hover:underline"
      >
        Ver el detalle del cambio
      </Link>
    </div>
  );
}
