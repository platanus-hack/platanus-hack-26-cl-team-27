import type { Claim } from '../types.ts';
import {
  ATTRIBUTE_UNITS,
  attributeOfHeader,
  parseNumber,
  subjectOf,
} from '../vocabulary.ts';

export const designClaim = (text: string, locator: string): Claim | null => {
  const subject = subjectOf(text);
  const found = /(espesor|ancho|alto)\s+([\d.,]+)/i.exec(text);
  if (subject === null || found === null) return null;
  const attribute = attributeOfHeader(found[1] ?? '');
  const value = parseNumber(found[2] ?? '');
  if (attribute === null || value === null) return null;
  return {
    subject,
    attribute,
    value,
    unit: ATTRIBUTE_UNITS[attribute] ?? null,
    role: 'usa',
    locator,
  };
};
