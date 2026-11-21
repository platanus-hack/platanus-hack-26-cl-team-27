'use client';

import { Button } from '@team27/ui';

import { Avatar } from '@/components/common/Avatar';
import { Icon } from '@/components/common/Icon';
import type { CastMember } from '@/lib/room-api';

const stateOf = (member: CastMember) =>
  member.presenter
    ? ({
        icon: 'lock',
        tone: 'text-ink-3',
        label: 'Presentadora · tú',
      } as const)
    : member.occupied && member.present
      ? ({ icon: 'user', tone: 'text-good', label: 'Una persona' } as const)
      : member.bot
        ? ({
            icon: 'dot',
            tone: 'text-ink-3',
            label: 'Lo juega un bot',
          } as const)
        : ({ icon: 'minus', tone: 'text-ink-3', label: 'Libre' } as const);

export function SeatList({
  cast,
  busyId,
  onRelease,
}: {
  readonly cast: readonly CastMember[];
  readonly busyId: string | null;
  readonly onRelease: (member: CastMember) => void;
}) {
  return (
    <ul className="-mx-2 flex flex-col">
      {cast.map((member) => (
        <li
          key={member.id}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5"
        >
          <Avatar
            name={member.name}
            size="sm"
            tone={member.presenter ? 'accent' : 'neutral'}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {member.name}
            </p>
            <p className="flex items-center gap-1 text-xs text-ink-2">
              <Icon
                name={stateOf(member).icon}
                className={`size-3.5 ${stateOf(member).tone}`}
              />
              {stateOf(member).label}
            </p>
          </div>
          {member.occupied && !member.presenter && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId !== null}
              onClick={() => onRelease(member)}
            >
              {busyId === member.id ? 'Soltando…' : 'Soltar'}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
