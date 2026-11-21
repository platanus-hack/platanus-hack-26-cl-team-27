import { ParseError, type RawFile, type Revision } from '../types.ts';
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

export const parseLibro = (file: RawFile): Revision => {
  const folio = /^FOLIO\s+(\d+)\s*$/im.exec(file.text);
  const title = /^(LIBRO DE OBRA)\s*$/im.exec(file.text);
  if (folio === null || title === null) {
    throw new ParseError(
      file.relativePath,
      'falta el título «LIBRO DE OBRA» o el «FOLIO N»',
    );
  }
  const label = `folio ${folio[1] ?? ''}`;
  const body = requireText(file, field(file, 'Texto'), 'el texto del folio');
  return finish(file, {
    documentId: requireDocument(file, title[1] ?? null),
    label,
    authorId: requirePerson(file, field(file, 'Firma')),
    chunks: [
      {
        locator: label,
        kind: 'anotacion',
        text: body.replace(/\s+/g, ' '),
      },
    ],
  });
};
