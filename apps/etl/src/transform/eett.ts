import {
  ParseError,
  type Claim,
  type RawFile,
  type Revision,
} from '../types.ts';
import {
  attributeOfHeader,
  ATTRIBUTE_UNITS,
  parseNumber,
  subjectOf,
} from '../vocabulary.ts';
import {
  finish,
  requireDocument,
  requirePerson,
  requireText,
} from './common.ts';

const frontMatter = (file: RawFile): Record<string, string> => {
  const lines = file.text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    throw new ParseError(file.relativePath, 'falta el encabezado de la EETT');
  }
  const end = lines.indexOf('---', 1);
  if (end < 0) {
    throw new ParseError(
      file.relativePath,
      'el encabezado de la EETT no cierra',
    );
  }
  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const split = line.indexOf(':');
    if (split > 0)
      fields[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return fields;
};

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((value) => value.trim());

export const parseEett = (file: RawFile): Revision => {
  const head = frontMatter(file);
  const claims: Claim[] = [];
  let section: { number: string; mark: string } | null = null;
  let columns: (string | null)[] | null = null;
  for (const line of file.text.split(/\r?\n/)) {
    const heading =
      /^##\s+(\d+(?:\.\d+)*)\s+(.*?)(?:\s+\((rev [A-Z])\))?\s*$/.exec(line);
    if (heading) {
      section = {
        number: heading[1] ?? '',
        mark: heading[3] ? ` ${heading[3]}` : '',
      };
      columns = null;
      continue;
    }
    if (!section || !line.trim().startsWith('|')) {
      if (!line.trim().startsWith('|')) columns = null;
      continue;
    }
    const row = cells(line);
    if (/^[-: ]+$/.test(row.join(''))) continue;
    if (columns === null) {
      columns = row.map((header) => attributeOfHeader(header));
      continue;
    }
    const name = row[0] ?? '';
    const subject = subjectOf(name);
    if (subject === null) continue;
    columns.forEach((attribute, index) => {
      if (attribute === null || index === 0) return;
      const value = parseNumber(row[index] ?? '');
      if (value === null) return;
      claims.push({
        subject,
        attribute,
        value,
        unit: ATTRIBUTE_UNITS[attribute] ?? null,
        role: 'afirma',
        locator: `§${section?.number ?? ''}${section?.mark ?? ''} · ${name}`,
      });
    });
  }
  return finish(file, {
    documentId: requireDocument(file, head['documento'] ?? null),
    label: requireText(file, head['revision'], 'la revisión'),
    authorId: requirePerson(file, head['autor'] ?? null),
    claims,
  });
};
