import type { SpaceKind } from '@/lib/room-api';

import type { IconName } from './Icon';

export const SPACE_ICON: Record<SpaceKind, IconName> = {
  drive: 'folder',
  sharepoint: 'folder',
  email: 'mail',
  whatsapp: 'chat',
  libro_obra: 'book',
};
