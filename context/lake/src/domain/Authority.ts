import type { DocumentKind } from './DocumentKind.ts';

export type AuthorityTable = Readonly<Record<string, readonly DocumentKind[]>>;

const DESIGN: readonly DocumentKind[] = ['plano', 'eett'];
const PRICE: readonly DocumentKind[] = ['cotizacion', 'presupuesto'];
const SCHEDULE: readonly DocumentKind[] = ['carta_gantt', 'acta'];

export const AUTHORITY: AuthorityTable = {
  espesor_cm: DESIGN,
  ancho_cm: DESIGN,
  alto_cm: DESIGN,
  cantidad: DESIGN,
  posicion_m: DESIGN,
  precio_unitario: PRICE,
  entrega_dias: SCHEDULE,
  duracion_dias: SCHEDULE,
};

export const hasAuthority = (
  kind: DocumentKind,
  attribute: string,
  table: AuthorityTable = AUTHORITY,
): boolean => table[attribute]?.includes(kind) ?? false;
