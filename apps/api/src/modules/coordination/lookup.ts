import type { Revision } from '@team27/context-lake';

import { LOS_AROMOS } from '../../scenario/los-aromos.ts';
import {
  attributeLabel,
  DOCUMENTS,
  SPACES,
  subjectName,
} from '../../scenario/documents.ts';

export const castMember = (id: string) =>
  LOS_AROMOS.cast.find((member) => member.id === id);

export const castName = (id: string): string => castMember(id)?.name ?? id;

export const spaceOf = (id: string) =>
  SPACES.find((space) => space.id === id) ?? null;

export const spaceName = (id: string): string => spaceOf(id)?.name ?? id;

export const documentDef = (id: string) =>
  DOCUMENTS.find((document) => document.id === id) ?? null;

export const revisionTitle = (revision: Revision): string =>
  `${revision.documentName} ${revision.label}`;

export const factLabel = (subject: string, attribute: string): string =>
  `${subjectName(subject)} · ${attributeLabel(attribute)}`;
