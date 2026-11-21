import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import { ATTRIBUTE_UNITS, parseNumber } from '../vocabulary.ts';
import { finish, requireDocument, requirePerson } from './common.ts';

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
  const body = (field(file, 'Texto') ?? '').replace(/\s+/g, ' ');
  const claims: Claim[] = [];
  const decision = /(?:el )?shaft S1 se corre a ([\d.,]+) m del eje A/i.exec(
    body,
  );
  const survey = /shaft S1 replanteado a ([\d.,]+) m del eje A/i.exec(body);
  const found = decision ?? survey;
  const position = parseNumber(found?.[1] ?? '');
  if (found && position !== null) {
    claims.push({
      subject: 'shaft-s1',
      attribute: 'posicion_m',
      value: position,
      unit: ATTRIBUTE_UNITS['posicion_m'] ?? null,
      role: 'afirma',
      locator: decision ? `${label}: «${decision[0]}»` : label,
    });
  }
  return finish(file, {
    documentId: requireDocument(file, title[1] ?? null),
    label,
    authorId: requirePerson(file, field(file, 'Firma')),
    claims,
  });
};
