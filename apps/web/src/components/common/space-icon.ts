import type { SpaceKind } from '@/lib/spaces-api';

import type { IconName } from './Icon';

export const SPACE_ICON: Record<SpaceKind, IconName> = {
  drive: 'folder',
  sharepoint: 'folder',
  email: 'mail',
  whatsapp: 'whatsapp',
  libro_obra: 'book',
};
