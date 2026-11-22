import type { Email } from '../../domain/Delivery.ts';

export interface OutgoingEmail extends Email {
  readonly to: string;
  readonly idempotencyKey: string;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<string>;
}
