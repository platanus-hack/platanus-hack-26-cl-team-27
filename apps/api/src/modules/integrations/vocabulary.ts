import type { SourceVocabulary } from '@team27/context-integrations';

import {
  attributeLabel,
  DOCUMENTS,
  type DocumentDef,
  SUBJECT_ATTRIBUTES,
  SUBJECTS,
} from '../../scenario/documents.ts';

export const LINKABLE_KINDS: readonly DocumentDef['kind'][] = ['presupuesto'];

export const linkableDocuments = (): readonly DocumentDef[] =>
  DOCUMENTS.filter((document) => LINKABLE_KINDS.includes(document.kind));

export const buildSourceVocabulary = (): SourceVocabulary => ({
  subjects: SUBJECTS.map((subject) => ({
    id: subject.id,
    label: subject.name,
    attributes: (SUBJECT_ATTRIBUTES[subject.id] ?? []).map((attribute) => ({
      key: attribute.key,
      label: attributeLabel(attribute.key),
      unit: attribute.unit,
    })),
  })),
});
