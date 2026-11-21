import { ParseError, type RawFile, type Revision } from '../types.ts';
import { documentId, personId } from '../vocabulary.ts';

export type Parsed = Omit<Revision, 'spaceId' | 'pointer' | 'contentHash'>;

export const finish = (file: RawFile, parsed: Parsed): Revision => ({
  documentId: parsed.documentId,
  label: parsed.label,
  spaceId: file.spaceId,
  authorId: parsed.authorId,
  pointer: file.pointer,
  contentHash: file.sha256,
  claims: parsed.claims,
});

export const requireDocument = (file: RawFile, name: string | null): string => {
  const id = name === null ? null : documentId(name);
  if (id === null) {
    throw new ParseError(
      file.relativePath,
      `documento desconocido: «${name ?? ''}»`,
    );
  }
  return id;
};

export const requirePerson = (file: RawFile, name: string | null): string => {
  const id = name === null ? null : personId(name);
  if (id === null) {
    throw new ParseError(
      file.relativePath,
      `autor desconocido: «${name ?? ''}»`,
    );
  }
  return id;
};

export const requireText = (
  file: RawFile,
  value: string | null | undefined,
  what: string,
): string => {
  if (value === null || value === undefined || value.trim() === '') {
    throw new ParseError(file.relativePath, `falta ${what}`);
  }
  return value.trim();
};
