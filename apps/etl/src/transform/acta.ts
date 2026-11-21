import {
  ParseError,
  type Chunk,
  type RawFile,
  type Revision,
} from '../types.ts';
import {
  finish,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';

const field = (file: RawFile, name: string): string | null => {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, 'mi');
  return pattern.exec(file.text)?.[1]?.trim() ?? null;
};

export const parseActa = (file: RawFile): Revision => {
  const title = /^(ACTA DE COORDINACIÓN)\s+(N°\s*\d+)\s*$/im.exec(file.text);
  if (title === null) {
    throw new ParseError(
      file.relativePath,
      'falta el título «ACTA DE COORDINACIÓN N° …»',
    );
  }
  const chunks: Chunk[] = [];
  for (const line of file.text.split(/\r?\n/)) {
    const agreement = /^(\d+)\.\s+(.*)$/.exec(line.trim());
    if (agreement === null) continue;
    chunks.push({
      locator: `acuerdo ${agreement[1] ?? ''}`,
      kind: 'acuerdo',
      text: agreement[2] ?? '',
    });
  }
  return finish(file, {
    documentId: requireDocument(file, title[1] ?? null),
    label: requireText(
      file,
      (title[2] ?? '').replace(/\s+/, ' '),
      'el número del acta',
    ),
    authorId: requirePerson(file, field(file, 'Redactó')),
    chunks,
  });
};
