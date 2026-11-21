import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import { fail } from '../coordination/http-errors.ts';
import { castMember, castName } from '../coordination/lookup.ts';
import { PRISMA_CLIENT } from '../database/prisma-token.ts';
import { emitEvents } from './events.ts';
import { PRESENCE_MS } from './state.ts';

export const SEAT_TOKEN_HEADER = 'x-seat-token';
export const PRESENTER_KEY_HEADER = 'x-presenter-key';
export const ACT_AS_HEADER = 'x-act-as';

export const PRESENTER_ID = LOS_AROMOS.author.id;

export interface Credentials {
  readonly token: string | undefined;
  readonly key: string | undefined;
  readonly actAs?: string | undefined;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2002';

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const sameSecret = (given: string, expected: string): boolean => {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
};

@Injectable()
export class SeatsService {
  private readonly prisma: PrismaClient;
  private readonly presenterKey: string;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.presenterKey = config.get('PRESENTER_KEY', { infer: true });
  }

  isPresenter(key: string | undefined): boolean {
    return (
      key !== undefined && key !== '' && sameSecret(key, this.presenterKey)
    );
  }

  requirePresenter(key: string | undefined): void {
    if (!this.isPresenter(key)) {
      throw fail(
        HttpStatus.UNAUTHORIZED,
        'presenter_required',
        'La clave del presentador falta o no es correcta',
      );
    }
  }

  async actor(credentials: Credentials): Promise<string> {
    if (credentials.token) {
      const seat = await this.prisma.seat.findFirst({
        where: { tokenHash: hashToken(credentials.token) },
      });
      if (seat) {
        await this.prisma.seat.update({
          where: { castId: seat.castId },
          data: { lastBeatAt: new Date() },
        });
        return seat.castId;
      }
    }
    if (this.isPresenter(credentials.key)) {
      return credentials.actAs ? this.actAs(credentials.actAs) : PRESENTER_ID;
    }
    throw fail(
      HttpStatus.UNAUTHORIZED,
      'seat_required',
      'Tu asiento falta o ya no es válido',
    );
  }

  private async actAs(castId: string): Promise<string> {
    if (!castMember(castId)) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el asiento ${castId}`,
      );
    }
    const held = await this.prisma.seat.findFirst({
      where: {
        castId,
        lastBeatAt: { gte: new Date(Date.now() - PRESENCE_MS) },
      },
    });
    if (held) {
      throw fail(
        HttpStatus.CONFLICT,
        'seat_held',
        `${castName(castId)} la tiene una persona`,
      );
    }
    return castId;
  }

  async actorFor(castId: string, credentials: Credentials): Promise<void> {
    if (!castMember(castId)) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el asiento ${castId}`,
      );
    }
    const actor = await this.actor(credentials);
    if (actor !== castId) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_your_seat',
        'Ese asiento no es el tuyo',
      );
    }
  }

  async heartbeat(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    const seat = await this.prisma.seat.findFirst({
      where: { tokenHash: hashToken(token) },
    });
    if (!seat) return null;
    await this.prisma.seat.update({
      where: { castId: seat.castId },
      data: { lastBeatAt: new Date() },
    });
    return seat.castId;
  }

  async presentIds(): Promise<Set<string>> {
    const seats = await this.prisma.seat.findMany({
      where: { lastBeatAt: { gte: new Date(Date.now() - PRESENCE_MS) } },
      select: { castId: true },
    });
    return new Set(seats.map((seat) => seat.castId));
  }

  async claim(castId: string): Promise<{ castId: string; token: string }> {
    if (!castMember(castId)) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el asiento ${castId}`,
      );
    }
    if (castId === PRESENTER_ID) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'presenter_seat',
        'El asiento de la presentadora no se toma desde un celular',
      );
    }
    const token = randomBytes(24).toString('hex');
    const now = new Date();
    const data = {
      tokenHash: hashToken(token),
      claimedAt: now,
      lastBeatAt: now,
    };
    const taken = await this.prisma.seat.updateMany({
      where: {
        castId,
        lastBeatAt: { lt: new Date(now.getTime() - PRESENCE_MS) },
      },
      data,
    });
    if (taken.count === 0) {
      try {
        await this.prisma.seat.create({ data: { castId, ...data } });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        throw new HttpException(
          {
            error: 'seat_taken',
            code: 'seat_taken',
            message: `${castName(castId)} ya la tiene otra persona`,
          },
          HttpStatus.CONFLICT,
        );
      }
    }
    await emitEvents(this.prisma, [
      {
        kind: 'seat.claimed',
        message: `${castName(castId)} tiene a una persona en su asiento.`,
        refs: { castId },
      },
    ]);
    return { castId, token };
  }

  async release(castId: string, credentials: Credentials): Promise<void> {
    if (!castMember(castId)) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        `No existe el asiento ${castId}`,
      );
    }
    if (!this.isPresenter(credentials.key)) {
      await this.actorFor(castId, credentials);
    }
    const removed = await this.prisma.seat.deleteMany({ where: { castId } });
    if (removed.count > 0) {
      await emitEvents(this.prisma, [
        {
          kind: 'seat.released',
          message: `El asiento de ${castName(castId)} volvió a un bot.`,
          refs: { castId },
        },
      ]);
    }
  }
}
