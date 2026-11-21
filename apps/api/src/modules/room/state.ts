import type { Prisma } from '@team27/data-main';

export const ROOM_STATE_ID = 1;

export const PRESENCE_MS = 20_000;

export const SPEEDS = [1, 2, 4] as const;

export type Speed = (typeof SPEEDS)[number];

export interface RoomStateView {
  readonly epoch: number;
  readonly autoplay: boolean;
  readonly speed: Speed;
  readonly activeScene: string | null;
  readonly pauseUntil: Date | null;
}

export const asSpeed = (value: number): Speed =>
  value === 2 || value === 4 ? value : 1;

export const readState = async (
  db: Prisma.TransactionClient,
): Promise<RoomStateView> => {
  const row = await db.roomState.upsert({
    where: { id: ROOM_STATE_ID },
    create: { id: ROOM_STATE_ID },
    update: {},
  });
  return {
    epoch: row.epoch,
    autoplay: row.autoplay,
    speed: asSpeed(row.speed),
    activeScene: row.activeScene,
    pauseUntil: row.pauseUntil,
  };
};
