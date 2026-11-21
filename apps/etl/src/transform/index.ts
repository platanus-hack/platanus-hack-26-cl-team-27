import type { Extracted, RawFile, Revision, SourceKind } from '../types.ts';
import { parseActa } from './acta.ts';
import { parseCotizacion } from './cotizacion.ts';
import { parseEett } from './eett.ts';
import { parseGantt } from './gantt.ts';
import { parseLibro } from './libro.ts';
import { parsePlano } from './plano.ts';
import { parsePresupuesto } from './presupuesto.ts';
import { parseWhatsapp } from './whatsapp.ts';

const PARSERS: Readonly<Record<SourceKind, (file: RawFile) => Revision>> = {
  plano: parsePlano,
  eett: parseEett,
  presupuesto: parsePresupuesto,
  gantt: parseGantt,
  cotizacion: parseCotizacion,
  acta: parseActa,
  whatsapp: parseWhatsapp,
  libro: parseLibro,
};

export const transformFile = (file: RawFile): Revision =>
  PARSERS[file.kind](file);

export const transformAll = (files: readonly RawFile[]): Extracted[] =>
  files.map((file) => ({ file, revision: transformFile(file) }));

export { ParseError } from '../types.ts';
