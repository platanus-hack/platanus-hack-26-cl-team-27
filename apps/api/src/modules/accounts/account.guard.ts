import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { fail } from '../coordination/http-errors.ts';
import { type Account, AccountsService } from './accounts.service.ts';

type AuthenticatedRequest = Request & { account?: Account };

const bearerOf = (request: Request): string | null => {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

@Injectable()
export class AccountGuard implements CanActivate {
  private readonly accounts: AccountsService;

  constructor(@Inject(AccountsService) accounts: AccountsService) {
    this.accounts = accounts;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerOf(request);
    if (!token) {
      throw fail(
        HttpStatus.UNAUTHORIZED,
        'login_required',
        'Entra con tu cuenta para seguir',
      );
    }
    request.account = await this.accounts.authenticate(token);
    return true;
  }
}

export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Account => {
    const { account } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    if (!account) throw new Error('CurrentAccount sin AccountGuard');
    return account;
  },
);
