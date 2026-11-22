import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { APS_SIGNATURE_HEADER } from '@team27/context-integrations/adapters';
import type { Request } from 'express';

import { fail } from '../coordination/http-errors.ts';
import {
  AutodeskWebhooksService,
  BAD_SIGNATURE,
  WEBHOOKS_OFF,
} from './autodesk-webhooks.service.ts';

@Controller('integrations/autodesk')
export class AutodeskWebhooksController {
  private readonly webhooks: AutodeskWebhooksService;

  constructor(
    @Inject(AutodeskWebhooksService) webhooks: AutodeskWebhooksService,
  ) {
    this.webhooks = webhooks;
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.NO_CONTENT)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers(APS_SIGNATURE_HEADER) signature: string | undefined,
  ): Promise<void> {
    const receipt = await this.webhooks.deliver({
      rawBody: request.rawBody,
      signature: signature?.trim() || null,
      body: request.body as unknown,
    });
    if (receipt.kind === 'off') {
      throw fail(
        HttpStatus.SERVICE_UNAVAILABLE,
        'autodesk_webhooks_off',
        WEBHOOKS_OFF,
      );
    }
    if (receipt.kind === 'unsigned') {
      throw fail(HttpStatus.FORBIDDEN, 'invalid_signature', BAD_SIGNATURE);
    }
    if (receipt.kind === 'invalid') {
      throw fail(HttpStatus.BAD_REQUEST, 'invalid_webhook', receipt.message);
    }
  }
}
