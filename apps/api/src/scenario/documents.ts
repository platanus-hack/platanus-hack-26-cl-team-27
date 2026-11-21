import { createHash } from 'node:crypto';

import type { DocumentKind, RevisionDraft, Space } from '@team27/context-lake';

export type SectionId =
  'estructura' | 'instalaciones' | 'fachada' | 'costos' | 'plazo';

export interface SubjectDef {
  readonly id: string;
  readonly name: string;
  readonly section: SectionId;
}

export interface AttributeDef {
  readonly key: string;
  readonly label: string;
}

export interface DocumentDef {
  readonly id: string;
  readonly name: string;
  readonly kind: DocumentKind;
  readonly spaceId: string;
  readonly ownerId: string;
}

export const REVIT_MODEL_ID = 'modelo-revit';

export const SPACES: readonly Space[] = [
  {
    id: 'drive-proyecto',
    name: 'Drive del proyecto',
    kind: 'drive',
    ownerId: 'fernanda-lagos',
  },
  {
    id: 'carpeta-costos',
    name: 'Carpeta de costos',
    kind: 'sharepoint',
    ownerId: 'daniela-soto',
  },
  {
    id: 'correo-quillay',
    name: 'Correo de Ventanas Quillay',
    kind: 'email',
    ownerId: 'ventanas-quillay',
  },
  {
    id: 'whatsapp-obra',
    name: 'WhatsApp Obra Los Aromos',
    kind: 'whatsapp',
    ownerId: 'marcos-fuentes',
  },
  {
    id: 'libro-obra',
    name: 'Libro de obra',
    kind: 'libro_obra',
    ownerId: 'marcos-fuentes',
  },
];

const SLAB_IDS = [
  ['losa-n2', 'Losa nivel 2'],
  ['losa-n3', 'Losa nivel 3'],
  ['losa-n4', 'Losa nivel 4'],
  ['losa-n5', 'Losa nivel 5'],
  ['losa-cubierta', 'Losa de cubierta'],
] as const;

const PRICE_ITEMS = [
  ['partida-03.02', 'Partida 03.02 Hormigón H30 en losas', 145_000, '$/m³'],
  ['partida-03.03', 'Partida 03.03 Acero de refuerzo en losas', 1_350, '$/kg'],
  [
    'partida-05.04',
    'Partida 05.04 Perforaciones y sellos del shaft',
    95_000,
    '$/m²',
  ],
  [
    'partida-07.01',
    'Partida 07.01 Ventanas de PVC termopanel',
    185_000,
    '$/m²',
  ],
] as const;

export const SUBJECTS: readonly SubjectDef[] = [
  ...SLAB_IDS.map(([id, name]): SubjectDef => ({
    id,
    name,
    section: 'estructura',
  })),
  {
    id: 'shaft-s1',
    name: 'Shaft de instalaciones S1',
    section: 'instalaciones',
  },
  { id: 'ventanas-norte', name: 'Ventanas fachada norte', section: 'fachada' },
  ...PRICE_ITEMS.map(([id, name]): SubjectDef => ({
    id,
    name,
    section: 'costos',
  })),
  { id: 'proyecto', name: 'Proyecto', section: 'plazo' },
];

export const ATTRIBUTES: readonly AttributeDef[] = [
  { key: 'espesor_cm', label: 'Espesor' },
  { key: 'ancho_cm', label: 'Ancho' },
  { key: 'alto_cm', label: 'Alto' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'posicion_m', label: 'Distancia al eje A' },
  { key: 'precio_unitario', label: 'Precio unitario' },
  { key: 'entrega_dias', label: 'Entrega' },
  { key: 'duracion_dias', label: 'Duración' },
];

export const DOCUMENTS: readonly DocumentDef[] = [
  {
    id: 'a201',
    name: 'A-201 Fachada norte y shaft',
    kind: 'plano',
    spaceId: 'drive-proyecto',
    ownerId: 'fernanda-lagos',
  },
  {
    id: 'e102',
    name: 'E-102 Planta estructural N3',
    kind: 'plano',
    spaceId: 'drive-proyecto',
    ownerId: 'fernanda-lagos',
  },
  {
    id: 'eett03',
    name: 'EETT-03 Hormigones',
    kind: 'eett',
    spaceId: 'drive-proyecto',
    ownerId: 'paula-rojas',
  },
  {
    id: 'presupuesto',
    name: 'Presupuesto itemizado',
    kind: 'presupuesto',
    spaceId: 'carpeta-costos',
    ownerId: 'daniela-soto',
  },
  {
    id: 'gantt',
    name: 'Carta Gantt',
    kind: 'carta_gantt',
    spaceId: 'carpeta-costos',
    ownerId: 'marcos-fuentes',
  },
  {
    id: 'q118',
    name: 'Cotización Q-118',
    kind: 'cotizacion',
    spaceId: 'correo-quillay',
    ownerId: 'ventanas-quillay',
  },
  {
    id: 'acta',
    name: 'Acta de coordinación',
    kind: 'acta',
    spaceId: 'drive-proyecto',
    ownerId: 'fernanda-lagos',
  },
  {
    id: 'libro',
    name: 'Libro de obra',
    kind: 'libro_obra',
    spaceId: 'libro-obra',
    ownerId: 'marcos-fuentes',
  },
  {
    id: 'whatsapp',
    name: 'Mensajes de WhatsApp',
    kind: 'mensaje',
    spaceId: 'whatsapp-obra',
    ownerId: 'marcos-fuentes',
  },
  {
    id: REVIT_MODEL_ID,
    name: 'Modelo Revit de arquitectura',
    kind: 'plano',
    spaceId: 'drive-proyecto',
    ownerId: 'fernanda-lagos',
  },
];

const documentById = new Map(DOCUMENTS.map((doc) => [doc.id, doc]));

export const documentOf = (id: string): DocumentDef => {
  const found = documentById.get(id);
  if (!found) throw new Error(`El catálogo no tiene el documento ${id}`);
  return found;
};

const hashOf = (pointer: string): string =>
  createHash('sha256').update(pointer).digest('hex');

export const toRevisionDraft = (
  documentId: string,
  label: string,
  authorId: string,
  spaceId: string,
  pointer: string,
  contentHash?: string,
): RevisionDraft => {
  const document = documentOf(documentId);
  return {
    documentId,
    documentName: document.name,
    label,
    kind: document.kind,
    spaceId,
    authorId,
    contentHash: contentHash ?? hashOf(pointer),
    sourcePointer: pointer,
  };
};

export const subjectName = (id: string): string =>
  SUBJECTS.find((subject) => subject.id === id)?.name ?? id;

export const attributeLabel = (key: string): string =>
  ATTRIBUTES.find((attribute) => attribute.key === key)?.label ?? key;
