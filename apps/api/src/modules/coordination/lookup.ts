import type { Revision } from '@team27/context-lake';

export const revisionTitle = (revision: Revision): string =>
  `${revision.documentName} ${revision.label}`;
