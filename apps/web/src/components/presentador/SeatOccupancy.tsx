'use client';

import { Button, Card, Notice } from '@team27/ui';
import { useState } from 'react';

import { StateMark } from '@/components/common/StateMark';
import { describeError, type Auth } from '@/lib/http';
import { releaseSeat, type CastMember } from '@/lib/room-api';

const stateOf = (member: CastMember) =>
  member.occupied && member.present
    ? ({ tone: 'good', icon: 'user', label: 'Una persona' } as const)
    : member.bot
      ? ({ tone: 'neutral', icon: 'dot', label: 'Lo juega un bot' } as const)
      : ({ tone: 'neutral', icon: 'minus', label: 'Libre' } as const);

export function SeatOccupancy({
  cast,
  auth,
  onDone,
}: {
  readonly cast: readonly CastMember[];
  readonly auth: Auth;
  readonly onDone: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const release = async (member: CastMember) => {
    setBusyId(member.id);
    setError(null);
    try {
      await releaseSeat(member.id, auth);
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Asientos">
      <ul className="flex flex-col gap-2">
        {cast
          .filter((member) => !member.presenter)
          .map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{member.name}</p>
                <StateMark {...stateOf(member)} />
              </div>
              {member.occupied && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId !== null}
                  onClick={() => void release(member)}
                >
                  Soltar
                </Button>
              )}
            </li>
          ))}
      </ul>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
