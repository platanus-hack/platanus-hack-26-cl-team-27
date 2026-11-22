import type { Prisma } from '@team27/data-main';

export const PRESENCE_MS = 20_000;

export interface RoomStateView {
  readonly epoch: number;
}

export const readState = async (
  db: Prisma.TransactionClient,
  projectId: string,
): Promise<RoomStateView> => {
  const row = await db.roomState.upsert({
    where: { projectId },
    create: { projectId },
    update: {},
  });
  return { epoch: row.epoch };
};
