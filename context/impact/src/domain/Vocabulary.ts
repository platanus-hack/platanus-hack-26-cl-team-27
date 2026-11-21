export type ClaimValue = number | string | boolean;

export interface VocabularyAttribute {
  readonly key: string;
  readonly label: string;
  readonly unit: string | null;
}

export interface VocabularySubject {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly attributes: readonly VocabularyAttribute[];
}

export interface VocabularyStakeholder {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface ProjectVocabulary {
  readonly project: string;
  readonly subjects: readonly VocabularySubject[];
  readonly stakeholders: readonly VocabularyStakeholder[];
}

export const findAttribute = (
  vocabulary: ProjectVocabulary,
  subjectId: string,
  key: string,
): VocabularyAttribute | null =>
  vocabulary.subjects
    .find((subject) => subject.id === subjectId)
    ?.attributes.find((attribute) => attribute.key === key) ?? null;
