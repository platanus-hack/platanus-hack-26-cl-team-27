export const CHANNELS = ['email', 'whatsapp', 'slack'] as const;

export type Channel = (typeof CHANNELS)[number];

export interface Stakeholder {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly channel: Channel;
  readonly handle: string;
}
