import type { ReactNode } from 'react';

import type { CastMember, Channel } from '@/lib/room-api';

import { EmailInbox } from './EmailInbox';
import { SlackFeed } from './SlackFeed';
import { WhatsAppChat } from './WhatsAppChat';

export interface ChannelItem {
  readonly id: string;
  readonly from: string;
  readonly at: string;
  readonly subject: string;
  readonly unread: boolean;
  readonly body: ReactNode;
}

export interface ChannelViewProps {
  readonly cast: CastMember;
  readonly items: readonly ChannelItem[];
  readonly empty: ReactNode;
}

const VIEWS: Record<Channel, (props: ChannelViewProps) => ReactNode> = {
  email: EmailInbox,
  whatsapp: WhatsAppChat,
  slack: SlackFeed,
};

export function ChannelShell({
  channel,
  ...props
}: ChannelViewProps & { readonly channel: Channel }) {
  const View = VIEWS[channel];
  return <View {...props} />;
}
