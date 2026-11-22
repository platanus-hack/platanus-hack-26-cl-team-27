import type { RenderedNotice } from '../../domain/Notice.ts';
import type { Channel } from '../../domain/Stakeholder.ts';

export interface OutgoingDelivery {
  readonly id: string;
  readonly to: string;
  readonly recipientName: string | null;
}

export interface ChannelSender {
  send(delivery: OutgoingDelivery, rendered: RenderedNotice): Promise<string>;
}

export type ChannelSenders = Partial<Record<Channel, ChannelSender>>;
