import type { Revision } from '@team27/context-lake';

import {
  FIX_LABEL_PREFIX,
  VIGENTE_ID,
  VIGENTE_NAME,
} from '../../scenario/caso-p12.ts';

const shortLabel = (label: string): string => {
  const bare = label.startsWith(FIX_LABEL_PREFIX)
    ? label.slice(FIX_LABEL_PREFIX.length)
    : label;
  const compact = bare.length > 12 ? bare.slice(0, 8) : bare;
  return label.startsWith(FIX_LABEL_PREFIX)
    ? `${FIX_LABEL_PREFIX}${compact}`
    : compact;
};

export const revisionTitle = (revision: Revision): string =>
  `${revision.documentName} ${shortLabel(revision.label)}`;

export const authorName = (
  castName: (id: string) => string,
  id: string,
): string => (id === VIGENTE_ID ? VIGENTE_NAME : castName(id));
