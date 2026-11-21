import type { Prisma } from '@team27/data-main';

export const ROOM_STATE_ID = 1;

export const PRESENCE_MS = 20_000;

export interface RoomStateView {
  readonly epoch: number;
}

export const readState = async (
  db: Prisma.TransactionClient,
): Promise<RoomStateView> => {
  const row = await db.roomState.upsert({
    where: { id: ROOM_STATE_ID },
    create: { id: ROOM_STATE_ID },
    update: {},
  });
  return { epoch: row.epoch };
};
