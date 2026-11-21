import { createHash } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../../src/config/index.ts';
import { SeatsService } from '../../../src/modules/room/seats.service.ts';

interface SeatRow {
  castId: string;
  tokenHash: string;
  lastBeatAt: Date;
}

const KEY = 'clave-de-prueba';

const hash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const build = (rows: SeatRow[]): SeatsService => {
  const prisma = {
    seat: {
      findFirst: ({
        where,
      }: {
        where: {
          castId?: string;
          tokenHash?: string;
          lastBeatAt?: { gte: Date };
        };
      }) =>
        Promise.resolve(
          rows.find(
            (row) =>
              (where.castId === undefined || row.castId === where.castId) &&
              (where.tokenHash === undefined ||
                row.tokenHash === where.tokenHash) &&
              (where.lastBeatAt === undefined ||
                row.lastBeatAt >= where.lastBeatAt.gte),
          ) ?? null,
        ),
      update: () => Promise.resolve(null),
    },
  } as unknown as PrismaClient;
  const config = {
    get: () => KEY,
  } as unknown as ConfigService<Env, true>;
  return new SeatsService(prisma, config);
};

const present = (castId: string): SeatRow => ({
  castId,
  tokenHash: hash(`token-${castId}`),
  lastBeatAt: new Date(),
});

const away = (castId: string): SeatRow => ({
  ...present(castId),
  lastBeatAt: new Date(Date.now() - 60_000),
});

describe('actor de un asiento', () => {
  it('con la clave y sin x-act-as actúa como la presentadora', async () => {
    const seats = build([]);

    await expect(seats.actor({ token: undefined, key: KEY })).resolves.toBe(
      'fernanda-lagos',
    );
  });

  it('con la clave y x-act-as actúa como ese asiento si no lo tiene una persona', async () => {
    const seats = build([away('paula-rojas')]);

    await expect(
      seats.actor({ token: undefined, key: KEY, actAs: 'paula-rojas' }),
    ).resolves.toBe('paula-rojas');
    await expect(
      seats.actor({ token: undefined, key: KEY, actAs: 'marcos-fuentes' }),
    ).resolves.toBe('marcos-fuentes');
  });

  it('responde 409 seat_held si una persona tiene el asiento', async () => {
    const seats = build([present('paula-rojas')]);

    await expect(
      seats.actor({ token: undefined, key: KEY, actAs: 'paula-rojas' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'seat_held' },
    });
  });

  it('responde 404 si el asiento no existe en el elenco', async () => {
    const seats = build([]);

    await expect(
      seats.actor({ token: undefined, key: KEY, actAs: 'nadie' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('x-act-as sin la clave correcta no sirve', async () => {
    const seats = build([]);

    await expect(
      seats.actor({ token: undefined, key: 'otra', actAs: 'paula-rojas' }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      seats.actor({ token: undefined, key: undefined, actAs: 'paula-rojas' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('el token del asiento manda sobre x-act-as', async () => {
    const seats = build([present('paula-rojas')]);

    await expect(
      seats.actor({
        token: 'token-paula-rojas',
        key: KEY,
        actAs: 'marcos-fuentes',
      }),
    ).resolves.toBe('paula-rojas');
  });
});
