import { HttpStatus } from '@nestjs/common';

import { castMember } from './lookup.ts';
import { fail } from './http-errors.ts';

export const SEAT_HEADER = 'x-seat';

export const requireSeat = (castId: string | undefined): string => {
  if (!castId) {
    throw fail(
      HttpStatus.UNAUTHORIZED,
      'seat_required',
      'Falta el asiento que actúa',
    );
  }
  if (!castMember(castId)) {
    throw fail(
      HttpStatus.UNAUTHORIZED,
      'unknown_seat',
      'Ese asiento no existe',
    );
  }
  return castId;
};
