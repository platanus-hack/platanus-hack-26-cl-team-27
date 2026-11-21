import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import { parseNumber, PROJECT_SUBJECT } from '../vocabulary.ts';
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
  const claims: Claim[] = [];
  for (const line of file.text.split(/\r?\n/)) {
    const agreement = /^(\d+)\.\s+(.*)$/.exec(line.trim());
    if (agreement === null) continue;
    const delivery = /plazo de entrega .*?(\d+) días/i.exec(agreement[2] ?? '');
    const days = parseNumber(delivery?.[1] ?? '');
    if (days === null) continue;
    claims.push({
      subject: PROJECT_SUBJECT,
      attribute: 'entrega_dias',
      value: days,
      unit: 'días',
      role: 'afirma',
      locator: `acuerdo ${agreement[1] ?? ''}`,
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
    claims,
  });
};
