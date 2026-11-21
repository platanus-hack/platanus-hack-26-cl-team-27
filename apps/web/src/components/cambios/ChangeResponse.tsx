'use client';

import { Notice } from '@team27/ui';
import Link from 'next/link';

import { VoteForm } from '@/components/asiento/VoteForm';
import { StateMark } from '@/components/common/StateMark';
import { useHeldSeats } from '@/hooks/use-held-seats';
import type { ChangeDetail } from '@/lib/changes-api';
import { isActive } from '@/lib/proposals-api';

export function ChangeResponse({
  change,
  forStakeholder,
  onDone,
}: {
  readonly change: ChangeDetail;
  readonly forStakeholder: string | null;
  readonly onDone: () => void;
}) {
  const seats = useHeldSeats();
  const proposal = change.proposal;
  if (!proposal || !seats.ready) return null;

  const mine = change.notifications.find(
    (notification) =>
      seats.ids.includes(notification.stakeholderId) &&
      (!forStakeholder || notification.stakeholderId === forStakeholder),
  );
  const wrongSeat =
    forStakeholder !== null &&
    !seats.ids.includes(forStakeholder) &&
    proposal.reviewers.some((r) => r.stakeholderId === forStakeholder);

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
        <VoteForm
          notificationId={mine.id}
          seatToken={seats.tokenFor(mine.stakeholderId)}
          onDone={onDone}
        />
      </section>
    );

  if (wrongSeat)
    return (
      <Notice>
        Este aviso es de otro asiento. Puedes leerlo, pero para responder{' '}
        <Link className="underline" href="/">
          toma tu asiento
        </Link>
        .
      </Notice>
    );

  return null;
}
