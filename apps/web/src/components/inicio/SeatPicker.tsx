'use client';

import { Notice, PageHeader } from '@team27/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

import { SeatCard } from './SeatCard';

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

  return (
    <>
      <PageHeader
        title="¿Quién eres en la obra?"
        description="Toma un asiento del elenco desde tu celular. Los asientos vacíos los juega un bot."
        actions={
          <Link
            href="/sala"
            className="inline-flex h-10 items-center rounded-lg border border-hairline bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Ver la sala
          </Link>
        }
      />
      {message && (
        <div className="mb-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {loading && <Loading />}
      {error && !data && <LoadError message={error} />}
      {data && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.cast.map((member) => (
            <li key={member.id}>
              <SeatCard
                member={member}
                mine={held.ids.includes(member.id)}
                busy={busyId === member.id}
                onClaim={(target) => void claim(target)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
