export const DOCUMENT_KINDS = [
  'plano',
  'eett',
  'cotizacion',
  'presupuesto',
  'carta_gantt',
  'acta',
  'mensaje',
  'libro_obra',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
