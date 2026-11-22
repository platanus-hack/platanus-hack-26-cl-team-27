import { createHash } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@team27/data-main';

import { ChangeSignal } from '../../../src/modules/database/change-signal.ts';
import { project } from '../../project.ts';
import type { Env } from '../../../src/config/index.ts';
import { SeatsService } from '../../../src/modules/room/seats.service.ts';
import { readState } from '../../../src/modules/room/state.ts';

const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const build = (lastBeatAt: Date, released = false) => {
  const updates: unknown[] = [];
  const prisma = {
    seat: {
      findFirst: () =>
        Promise.resolve({
          castId: 'paula-rojas',
          tokenHash: hash('token'),
          lastBeatAt,
        }),
      updateMany: (args: unknown) => {
        updates.push(args);
        return Promise.resolve({ count: released ? 0 : 1 });
      },
    },
  } as unknown as PrismaClient;
  const config = { get: () => 'clave' } as unknown as ConfigService<Env, true>;
  return {
    seats: new SeatsService(prisma, config, project, new ChangeSignal()),
    updates,
  };
};

describe('latido del asiento al sondear', () => {
  it('no escribe si el último latido fue hace menos de 5 s', async () => {
    const { seats, updates } = build(new Date(Date.now() - 1_000));

    await expect(seats.heartbeat('token')).resolves.toBe('paula-rojas');
    expect(updates).toHaveLength(0);
  });

  it('escribe si el último latido fue hace 5 s o más', async () => {
    const { seats, updates } = build(new Date(Date.now() - 6_000));

    await expect(seats.heartbeat('token')).resolves.toBe('paula-rojas');
    expect(updates).toHaveLength(1);
  });

  it('escribe solo si el asiento sigue con ese token', async () => {
    const { seats, updates } = build(new Date(Date.now() - 6_000));

    await seats.heartbeat('token');
    expect(updates).toEqual([
      {
        where: {
          projectId: project.id,
          castId: 'paula-rojas',
          tokenHash: hash('token'),
        },
        data: { lastBeatAt: expect.any(Date) },
      },
    ]);
  });

  it('si el asiento se soltó entre la lectura y la escritura, responde sin asiento en vez de lanzar', async () => {
    const { seats } = build(new Date(Date.now() - 6_000), true);

    await expect(seats.heartbeat('token')).resolves.toBeNull();
  });

  it('sin token no consulta ni escribe', async () => {
    const { seats, updates } = build(new Date(0));

    await expect(seats.heartbeat(undefined)).resolves.toBeNull();
    expect(updates).toHaveLength(0);
  });
});

describe('readState', () => {
  const fake = (existing: { epoch: number } | null) => {
    const calls: string[] = [];
    const db = {
      roomState: {
        findUnique: () => {
          calls.push('findUnique');
          return Promise.resolve(existing);
        },
        createMany: () => {
          calls.push('createMany');
          return Promise.resolve({ count: 0 });
        },
        findUniqueOrThrow: () => {
          calls.push('findUniqueOrThrow');
          return Promise.resolve({ epoch: 0 });
        },
      },
    };
    return { db: db as unknown as Parameters<typeof readState>[0], calls };
  };

  it('lee sin escribir si la fila existe', async () => {
    const { db, calls } = fake({ epoch: 3 });

    await expect(readState(db, 'p')).resolves.toEqual({ epoch: 3 });
    expect(calls).toEqual(['findUnique']);
  });

  it('crea la fila solo si falta, sin chocar si otra petición la crea a la vez', async () => {
    const { db, calls } = fake(null);

    await expect(readState(db, 'p')).resolves.toEqual({ epoch: 0 });
    expect(calls).toEqual(['findUnique', 'createMany', 'findUniqueOrThrow']);
  });
});
