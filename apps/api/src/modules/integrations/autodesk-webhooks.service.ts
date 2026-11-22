import { Inject, Injectable, type Logger } from '@nestjs/common';
import {
  AutodeskEventError,
  ReceiveAutodeskEvent,
} from '@team27/context-integrations';
import { verifyApsWebhook } from '@team27/context-integrations/adapters';

export const AUTODESK_EVENT_REPOSITORY = 'AUTODESK_EVENT_REPOSITORY';
export const AUTODESK_CHANGE_LISTENER = 'AUTODESK_CHANGE_LISTENER';
export const AUTODESK_WEBHOOKS_CONFIG = 'AUTODESK_WEBHOOKS_CONFIG';
export const CONNECTORS_LOGGER = 'CONNECTORS_LOGGER';

export const WEBHOOKS_OFF =
  'Los avisos de Autodesk están apagados: falta APS_WEBHOOK_SECRET en la API';

export const BAD_SIGNATURE = 'La firma del aviso de Autodesk no calza';

export interface AutodeskWebhooksConfig {
  readonly secret: string | null;
}

export interface AutodeskDelivery {
  readonly rawBody: Buffer | undefined;
  readonly signature: string | null;
  readonly body: unknown;
}

export type AutodeskReceipt =
  | { readonly kind: 'off' }
  | { readonly kind: 'unsigned' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'recorded' }
  | { readonly kind: 'duplicate' };

export type ConnectorsLogger = Pick<Logger, 'log' | 'warn'>;

@Injectable()
export class AutodeskWebhooksService {
  private readonly receive: ReceiveAutodeskEvent;
  private readonly secret: string | null;
  private readonly logger: ConnectorsLogger;
  private reportedOff = false;

  constructor(
    @Inject(ReceiveAutodeskEvent) receive: ReceiveAutodeskEvent,
    @Inject(AUTODESK_WEBHOOKS_CONFIG) config: AutodeskWebhooksConfig,
    @Inject(CONNECTORS_LOGGER) logger: ConnectorsLogger,
  ) {
    this.receive = receive;
    this.secret = config.secret;
    this.logger = logger;
  }

  async deliver(delivery: AutodeskDelivery): Promise<AutodeskReceipt> {
    if (this.secret === null) {
      if (!this.reportedOff) {
        this.reportedOff = true;
        this.logger.warn(`Llegó un aviso de Autodesk. ${WEBHOOKS_OFF}`);
      }
      return { kind: 'off' };
    }
    const signed = verifyApsWebhook(
      delivery.rawBody ?? Buffer.alloc(0),
      delivery.signature,
      this.secret,
    );
    if (!signed) {
      this.logger.warn(
        delivery.signature === null
          ? 'Aviso de Autodesk sin firma'
          : 'Aviso de Autodesk con una firma que no calza',
      );
      return { kind: 'unsigned' };
    }
    try {
      const outcome = await this.receive.execute(delivery.body);
      return { kind: outcome.kind };
    } catch (error) {
      if (error instanceof AutodeskEventError) {
        return { kind: 'invalid', message: error.message };
      }
      throw error;
    }
  }
}
