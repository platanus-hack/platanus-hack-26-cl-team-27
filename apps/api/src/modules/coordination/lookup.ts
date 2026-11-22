import type { Revision } from '@team27/context-lake';

const shortLabel = (label: string): string =>
  label.length > 12 ? label.slice(0, 8) : label;

export const revisionTitle = (revision: Revision): string =>
  `${revision.documentName} ${shortLabel(revision.label)}`;
