import { Button } from '@team27/ui';
import Link from 'next/link';

import { Avatar } from '@/components/common/Avatar';
import { buttonLink } from '@/components/common/link-styles';
import { StatusChip } from '@/components/common/StatusChip';
import { CHANNEL_LABEL, type CastMember } from '@/lib/room-api';

export function SeatRow({
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
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
          name={member.name}
          size="lg"
          tone={mine ? 'accent' : 'neutral'}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{member.name}</span>
            {mine ? (
              <StatusChip tone="good" icon="user" label="Tu asiento" />
            ) : taken ? (
              <StatusChip tone="neutral" icon="user" label="Ocupado" />
            ) : member.bot ? (
              <StatusChip tone="neutral" icon="dot" label="Lo juega un bot" />
            ) : null}
          </p>
          <p className="text-sm text-ink-2">
            {member.role}
            {member.channel &&
              ` · Avisos por ${CHANNEL_LABEL[member.channel].toLowerCase()}`}
          </p>
        </div>
      </div>
      {mine ? (
        <Link
          href={`/asiento/${member.id}`}
          className={buttonLink('primary', 'md', 'h-11 sm:w-48')}
        >
          Volver a mi asiento
        </Link>
      ) : (
        <Button
          variant="secondary"
          className="h-11 sm:w-48"
          disabled={taken || busy}
          onClick={() => onClaim(member)}
        >
          {taken ? 'Asiento ocupado' : busy ? 'Tomando…' : 'Tomar este asiento'}
        </Button>
      )}
    </li>
  );
}
