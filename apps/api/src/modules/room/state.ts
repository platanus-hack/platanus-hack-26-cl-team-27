import type { Prisma } from '@team27/data-main';

export const PRESENCE_MS = 20_000;

export interface RoomStateView {
  readonly epoch: number;
}

export const readState = async (
  db: Prisma.TransactionClient,
  projectId: string,
): Promise<RoomStateView> => {
  const found = await db.roomState.findUnique({ where: { projectId } });
  if (found) return { epoch: found.epoch };
  await db.roomState.createMany({ data: [{ projectId }], skipDuplicates: true });
  const row = await db.roomState.findUniqueOrThrow({ where: { projectId } });
  return { epoch: row.epoch };
};
