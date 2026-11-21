'use client';

import { Notice } from '@team27/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { buttonLink, textLink } from '@/components/common/link-styles';
import { Loading, LoadError } from '@/components/common/LoadState';
import { useHeldSeats } from '@/hooks/use-held-seats';
import { useLive } from '@/hooks/use-live';
import { ApiError, describeError } from '@/lib/http';
import { DEFAULT_INTERVAL_MS } from '@/lib/pulse';
import { claimSeat, getRoom, type CastMember } from '@/lib/room-api';
import {
  clearAllSeatTokens,
  SEAT_STORAGE_ERROR,
  saveSeatToken,
} from '@/lib/seat-storage';

import { SeatRow } from './SeatRow';

export function SeatPicker() {
  const router = useRouter();
  const held = useHeldSeats();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: 'info' | 'error';
    text: string;
  } | null>(null);

  const { data, error, loading, reload } = useLive({
    load: getRoom,
    intervalMs: DEFAULT_INTERVAL_MS,
    onReset: () => {
      clearAllSeatTokens();
      held.refresh();
      reload();
    },
  });

  const claim = async (member: CastMember) => {
    setBusyId(member.id);
    setMessage(null);
    try {
      const response = await claimSeat(member.id, {
        seatToken: held.tokenFor(member.id),
      });
      const saved = saveSeatToken(member.id, response.token);
      if (!saved) {
        setMessage({ tone: 'info', text: SEAT_STORAGE_ERROR });
      }
      router.push(`/asiento/${member.id}`);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'seat_taken') {
        setMessage({
          tone: 'error',
          text: 'Alguien se te adelantó. Elige otro asiento.',
        });
        reload();
      } else {
        setMessage({ tone: 'error', text: describeError(failure) });
      }
    } finally {
      setBusyId(null);
    }
  };

  const players = data?.cast.filter((member) => !member.presenter) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            ¿Quién eres en la obra?
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">
            Toma un asiento del elenco. Te llegan solo los cambios que te tocan,
            con el aspecto de tu canal, y respondes desde aquí. Los asientos
            vacíos los juega un bot.
          </p>
        </div>
        <Link href="/sala" className={buttonLink('secondary')}>
          Ver la sala
        </Link>
      </header>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {loading && !data && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {players.map((member) => (
            <SeatRow
              key={member.id}
              member={member}
              mine={held.ids.includes(member.id)}
              busy={busyId === member.id}
              onClaim={(target) => void claim(target)}
            />
          ))}
        </ul>
      )}
      {data && (
        <p className="text-sm text-ink-2">
          ¿Eres quien presenta?{' '}
          <Link href="/presentador" className={textLink}>
            Entra a la sala de Fernanda →
          </Link>
        </p>
      )}
    </div>
  );
}
