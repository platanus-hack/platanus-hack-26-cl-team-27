import { normalizeWords } from './Sheet.ts';

export interface VocabularyAttribute {
  readonly key: string;
  readonly label: string;
  readonly unit: string | null;
}

export interface VocabularySubject {
  readonly id: string;
  readonly label: string;
  readonly attributes: readonly VocabularyAttribute[];
}

export interface SourceVocabulary {
  readonly subjects: readonly VocabularySubject[];
}

const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y']);

const significant = (text: string): string[] =>
  normalizeWords(text).filter((word) => !STOP_WORDS.has(word));

export const subjectById = (
  vocabulary: SourceVocabulary,
  id: string,
): VocabularySubject | null =>
  vocabulary.subjects.find((subject) => subject.id === id) ?? null;

export const attributeOf = (
  subject: VocabularySubject,
  key: string,
): VocabularyAttribute | null =>
  subject.attributes.find((attribute) => attribute.key === key) ?? null;

export const matchSubject = (
  vocabulary: SourceVocabulary,
  text: string,
): VocabularySubject | null => {
  const words = new Set(significant(text));
  let best: VocabularySubject | null = null;
  let bestScore = 0;
  let tied = false;
  for (const subject of vocabulary.subjects) {
    const label = significant(subject.label);
    const numbersMatch = label
      .filter((word) => /\d/.test(word))
      .every((word) => words.has(word));
    if (!numbersMatch) continue;
    const score = label.filter((word) => words.has(word)).length;
    if (score > bestScore) {
      best = subject;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  }
  return bestScore >= 2 && !tied ? best : null;
};

export const matchAttribute = (
  subject: VocabularySubject,
  word: string,
): VocabularyAttribute | null => {
  const wanted = normalizeWords(word)[0];
  if (wanted === undefined) return null;
  return (
    subject.attributes.find(
      (attribute) => normalizeWords(attribute.label)[0] === wanted,
    ) ?? null
  );
};
