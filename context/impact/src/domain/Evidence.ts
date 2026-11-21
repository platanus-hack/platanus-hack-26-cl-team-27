import type { ClaimValue } from './Vocabulary.ts';

export type TextSource = 'mensaje' | 'libro_obra' | 'documento';

export type FileSource = 'plano' | 'documento';

export type FileMediaType =
  'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';

export interface TextEvidence {
  readonly kind: 'text';
  readonly source: TextSource;
  readonly title: string;
  readonly text: string;
}

export interface FileEvidence {
  readonly kind: 'file';
  readonly source: FileSource;
  readonly title: string;
  readonly mediaType: FileMediaType;
  readonly data: string;
}

export type Evidence = TextEvidence | FileEvidence;

export interface ChangeSummary {
  readonly subjectId: string;
  readonly attribute: string;
  readonly before: ClaimValue;
  readonly after: ClaimValue;
  readonly unit: string | null;
  readonly summary: string;
}

export const isEmptyEvidence = (evidence: Evidence): boolean =>
  evidence.kind === 'text'
    ? evidence.text.trim() === ''
    : evidence.data.trim() === '';
