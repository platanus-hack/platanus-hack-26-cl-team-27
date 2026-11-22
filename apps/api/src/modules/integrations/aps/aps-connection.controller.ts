import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { fail } from '../../coordination/http-errors.ts';
import { AccountGuard, CurrentAccount } from '../../accounts/account.guard.ts';
import {
  type Account,
  AccountsService,
} from '../../accounts/accounts.service.ts';
import { STATE_TTL_MS } from './oauth-state.ts';
import {
  ApsConnectionError,
  type ConnectionView,
} from './aps-connection.service.ts';
import {
  APS_CONNECTIONS,
  type ApsConnections,
} from './aps-connection.tokens.ts';
import {
  readCookie,
  returnUrl,
  STATE_COOKIE,
  stateCookieOptions,
} from './callback-site.ts';

const organizationId = z.string().min(1).max(64);

const callbackQuery = z.object({
  code: z.string().max(4096).optional(),
  state: z.string().max(4096).optional(),
  error: z.string().max(256).optional(),
});

export interface ConnectionStatusResponse {
  readonly configured: boolean;
  readonly connection: ConnectionView | null;
}

@Controller()
export class ApsConnectionController {
  private readonly logger = new Logger(ApsConnectionController.name);
  private readonly connections: ApsConnections | null;
  private readonly accounts: AccountsService;

  constructor(
    @Inject(APS_CONNECTIONS) connections: ApsConnections | null,
    @Inject(AccountsService) accounts: AccountsService,
  ) {
    this.connections = connections;
    this.accounts = accounts;
  }

  @Get('organizations/:organizationId/integrations/aps')
  @UseGuards(AccountGuard)
  @Header('Cache-Control', 'no-store')
  async status(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
  ): Promise<ConnectionStatusResponse> {
    this.accounts.requireMember(account, id);
    if (!this.connections) return { configured: false, connection: null };
    return {
      configured: true,
      connection: await this.connections.service.status(id),
    };
  }

  @Post('organizations/:organizationId/integrations/aps/authorize')
  @UseGuards(AccountGuard)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  authorize(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
    @Res({ passthrough: true }) response: Response,
  ): { url: string } {
    this.accounts.requireAdmin(account, id);
    const { service, callbackUrl } = this.require();
    const { url, nonce } = service.startAuthorization(id, account.id);
    response.cookie(STATE_COOKIE, nonce, {
      ...stateCookieOptions(callbackUrl),
      maxAge: STATE_TTL_MS,
    });
    return { url };
  }

  @Delete('organizations/:organizationId/integrations/aps')
  @UseGuards(AccountGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @CurrentAccount() account: Account,
    @Param('organizationId', { schema: organizationId }) id: string,
  ): Promise<void> {
    this.accounts.requireAdmin(account, id);
    await this.require().service.disconnect(id);
  }

  @Get('integrations/aps/callback')
  async callback(
    @Query() query: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { service, callbackUrl } = this.require();
    const nonce = readCookie(request.headers.cookie, STATE_COOKIE);
    response.clearCookie(STATE_COOKIE, stateCookieOptions(callbackUrl));
    response.setHeader('Cache-Control', 'no-store');
    const parsed = callbackQuery.safeParse(query);
    if (!parsed.success || !parsed.data.state) {
      response.redirect(
        HttpStatus.FOUND,
        returnUrl(callbackUrl, { error: 'invalid_state' }),
      );
      return;
    }
    try {
      await service.completeAuthorization({
        state: parsed.data.state,
        nonce,
        code: parsed.data.code ?? null,
        error: parsed.data.error ?? null,
      });
      response.redirect(
        HttpStatus.FOUND,
        returnUrl(callbackUrl, { connected: true }),
      );
    } catch (error) {
      const code =
        error instanceof ApsConnectionError ? error.code : 'aps_unavailable';
      this.logger.warn(`La conexión con Autodesk no se completó: ${code}`);
      response.redirect(
        HttpStatus.FOUND,
        returnUrl(callbackUrl, { error: code }),
      );
    }
  }

  private require(): ApsConnections {
    if (!this.connections) {
      throw fail(
        HttpStatus.SERVICE_UNAVAILABLE,
        'aps_oauth_not_configured',
        'Faltan APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL o APS_TOKEN_KEY',
      );
    }
    return this.connections;
  }
}
