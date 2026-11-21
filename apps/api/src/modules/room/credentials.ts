import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import {
  ACT_AS_HEADER,
  type Credentials,
  PRESENTER_KEY_HEADER,
  SEAT_TOKEN_HEADER,
} from './seats.service.ts';

const header = (request: Request, name: string): string | undefined => {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

export const SeatCredentials = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Credentials => {
    const request = context.switchToHttp().getRequest<Request>();
    return {
      token: header(request, SEAT_TOKEN_HEADER),
      key: header(request, PRESENTER_KEY_HEADER),
      actAs: header(request, ACT_AS_HEADER),
    };
  },
);
