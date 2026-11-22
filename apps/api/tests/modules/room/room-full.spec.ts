import type { PrismaClient } from '@team27/data-main';

import { project } from '../../project.ts';
import type { EventsHub } from '../../../src/modules/room/events-hub.ts';
import { RoomService } from '../../../src/modules/room/room.service.ts';

const build = (outcome: unknown) => {
  const prisma = {
    roomState: {
      findUnique: () => Promise.resolve({ epoch: 1 }),
      upsert: () => Promise.resolve({ epoch: 1 }),
    },
    roomEvent: {
      aggregate: () => Promise.resolve({ _max: { seq: 5 } }),
      findMany: () => Promise.resolve([]),
    },
  } as unknown as PrismaClient;
  const seats = { heartbeat: () => Promise.resolve(null) };
  const hub = { wait: () => Promise.resolve(outcome) } as unknown as EventsHub;
  return new RoomService(
    prisma,
    {} as never,
    {} as never,
    seats as never,
    project,
    hub,
  );
};

describe('RoomService.events con la espera llena', () => {
  it('responde al tiro sin anunciar longPoll para que el cliente vuelva al sondeo corto', async () => {
    const reply = await build({ kind: 'full' }).events({
      after: 5,
      epoch: 1,
      limit: 100,
      token: undefined,
      waitSeconds: 10,
    });

    expect(reply).toMatchObject({ longPoll: false, reset: false, events: [] });
  });

  it('cuando la espera vence sigue anunciando longPoll', async () => {
    const reply = await build({ kind: 'events', events: [] }).events({
      after: 5,
      epoch: 1,
      limit: 100,
      token: undefined,
      waitSeconds: 10,
    });

    expect(reply).toMatchObject({ longPoll: true });
  });
});
