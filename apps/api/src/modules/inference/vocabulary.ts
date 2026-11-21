import type { ProjectVocabulary } from '@team27/context-inference';

import {
  attributeLabel,
  SUBJECT_ATTRIBUTES,
  SUBJECTS,
} from '../../scenario/documents.ts';
import { LOS_AROMOS } from '../../scenario/los-aromos.ts';

const categoryOf = (subject: string): string =>
  LOS_AROMOS.model.find((element) => element.id === subject)?.category ??
  (subject.startsWith('partida-') ? 'partida' : 'proyecto');

export const buildVocabulary = (): ProjectVocabulary => ({
  project: LOS_AROMOS.project.name,
  subjects: SUBJECTS.map((subject) => ({
    id: subject.id,
    label: subject.name,
    category: categoryOf(subject.id),
    attributes: (SUBJECT_ATTRIBUTES[subject.id] ?? []).map((attribute) => ({
      key: attribute.key,
      label: attributeLabel(attribute.key),
      unit: attribute.unit,
    })),
  })),
  stakeholders: LOS_AROMOS.cast.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
  })),
});
