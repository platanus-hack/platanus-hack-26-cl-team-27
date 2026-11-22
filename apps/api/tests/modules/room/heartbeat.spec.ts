import { createHash } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@team27/data-main';

import { project } from '../../project.ts';
import type { Env } from '../../../src/config/index.ts';
import { SeatsService } from '../../../src/modules/room/seats.service.ts';
import { readState } from '../../../src/modules/room/state.ts';

const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const build = (lastBeatAt: Date) => {
  const updates: unknown[] = [];
  const prisma = {
    seat: {
      findFirst: () =>
        Promise.resolve({
          castId: 'paula-rojas',
          tokenHash: hash('token'),
          lastBeatAt,
        }),
      update: (args: unknown) => {
        updates.push(args);
        return Promise.resolve(null);
      },
    },
  } as unknown as PrismaClient;
  const config = { get: () => 'clave' } as unknown as ConfigService<Env, true>;
  return { seats: new SeatsService(prisma, config, project), updates };
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
        upsert: () => {
          calls.push('upsert');
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

  it('crea la fila solo si falta', async () => {
    const { db, calls } = fake(null);

    await expect(readState(db, 'p')).resolves.toEqual({ epoch: 0 });
    expect(calls).toEqual(['findUnique', 'upsert']);
  });
});
