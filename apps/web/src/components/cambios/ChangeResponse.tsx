'use client';

import { StateMark } from '@/components/common/StateMark';
import type { ChangeDetail } from '@/lib/changes-api';
import { isActive } from '@/lib/proposals-api';

import { VoteForm } from './VoteForm';

export function ChangeResponse({
  change,
  userId,
  onDone,
}: {
  readonly change: ChangeDetail;
  readonly userId: string | null;
  readonly onDone: () => void;
}) {
  const proposal = change.proposal;
  if (!proposal || userId === null) return null;

  const mine = change.notifications.find(
    (notification) => notification.stakeholderId === userId,
  );

  if (mine?.response)
    return (
      <section className="border-t border-hairline pt-5">
        <StateMark
          tone={mine.response.kind === 'reviewed' ? 'good' : 'critical'}
          icon={mine.response.kind === 'reviewed' ? 'check' : 'alert'}
          label={
            mine.response.kind === 'reviewed'
              ? 'Respondiste: Revisado'
              : 'Respondiste: Tengo un problema'
          }
        />
        {mine.response.note && (
          <p className="mt-1 text-sm text-ink">«{mine.response.note}»</p>
        )}
      </section>
    );

  if (mine && isActive(proposal.status))
    return (
      <section className="border-t border-hairline pt-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Tu respuesta</h3>
        <VoteForm notificationId={mine.id} onDone={onDone} />
      </section>
    );

  return null;
}
