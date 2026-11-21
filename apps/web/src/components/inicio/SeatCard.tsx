import { Button, Card } from '@team27/ui';
import Link from 'next/link';

import { initials } from '@/components/common/initials';
import { CHANNEL_LABEL, type CastMember } from '@/lib/room-api';

export function SeatCard({
  member,
  mine,
  busy,
  onClaim,
}: {
  readonly member: CastMember;
  readonly mine: boolean;
  readonly busy: boolean;
  readonly onClaim: (member: CastMember) => void;
}) {
  const taken = member.occupied && member.present && !mine;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-base font-semibold text-on-accent"
        >
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">{member.name}</h2>
          <p className="text-sm text-ink-2">
            {member.role}
            {member.channel && ` · ${CHANNEL_LABEL[member.channel]}`}
          </p>
        </div>
        {member.bot && !mine && (
          <span className="shrink-0 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">
            Lo juega un bot
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Esto te va a pasar a ti</p>
        <p className="text-sm text-ink-2">{member.preview}</p>
      </div>
      {member.presenter ? (
        <Link
          href="/presentador"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-on-accent hover:bg-accent-strong"
        >
          Entrar como presentadora
        </Link>
      ) : mine ? (
        <Link
          href={`/asiento/${member.id}`}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 font-medium text-on-accent hover:bg-accent-strong"
        >
          Volver a mi asiento
        </Link>
      ) : (
        <Button
          className="h-11"
          disabled={taken || busy}
          onClick={() => onClaim(member)}
        >
          {taken ? 'Asiento ocupado' : busy ? 'Tomando…' : 'Tomar este asiento'}
        </Button>
      )}
    </Card>
  );
}
