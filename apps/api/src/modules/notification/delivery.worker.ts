import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { DeliverNotifications } from '@team27/context-notification';

import { MISSING_CHANNELS_MESSAGE } from './channel-senders.ts';

export const DELIVER_NOTIFICATIONS = 'DELIVER_NOTIFICATIONS';

export const DELIVERY_INTERVAL_MS = 5_000;

@Injectable()
export class DeliveryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Avisos');
  private readonly deliver: DeliverNotifications | null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(DELIVER_NOTIFICATIONS) deliver: DeliverNotifications | null,
  ) {
    this.deliver = deliver;
  }

  onApplicationBootstrap(): void {
    if (this.deliver === null) {
      this.logger.log(MISSING_CHANNELS_MESSAGE);
      return;
    }
    this.timer = setInterval(() => void this.tick(), DELIVERY_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running || this.deliver === null) return;
    this.running = true;
    try {
      const round = await this.deliver.execute();
      if (round.sent + round.retried + round.failed + round.skipped > 0) {
        this.logger.log(
          `Enviados ${round.sent}, reintentos ${round.retried}, fallidos ${round.failed}, omitidos ${round.skipped}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No pude revisar la cola: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
