import { createHash } from 'node:crypto';

import { fixtureKey } from '@team27/context-lake/adapters';
import type {
  ClaimDraft,
  ClaimValue,
  DocumentKind,
  RevisionDraft,
  Space,
} from '@team27/context-lake';

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

export interface SeededRevisionDef {
  readonly documentId: string;
  readonly label: string;
  readonly authorId: string;
  readonly pointer: string;
  readonly claims: readonly ClaimDraft[];
}

export interface Requirement {
  readonly documentId: string;
  readonly label: string;
}

export interface Fixture {
  readonly id: string;
  readonly documentId: string;
  readonly label: string;
  readonly seat: string;
  readonly spaceId: string;
  readonly pointer: string;
  readonly requires: readonly Requirement[];
  readonly claims: readonly ClaimDraft[];
}

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
];

const claim = (
  role: ClaimDraft['role'],
  subject: string,
  attribute: string,
  value: ClaimValue,
  unit: string | null,
  locator: string,
): ClaimDraft => ({ subject, attribute, value, unit, role, locator });

const slabs = (
  thickness: (id: string) => number,
  locator: (name: string) => string,
): ClaimDraft[] =>
  SLAB_IDS.map(([id, name]) =>
    claim('afirma', id, 'espesor_cm', thickness(id), 'cm', locator(name)),
  );

const prices = (): ClaimDraft[] =>
  PRICE_ITEMS.map(([id, , price, unit], index) =>
    claim(
      'afirma',
      id,
      'precio_unitario',
      price,
      unit,
      `Partidas!C${14 + index}`,
    ),
  );

const windows = (width: number, locator: string): ClaimDraft[] => [
  claim('afirma', 'ventanas-norte', 'ancho_cm', width, 'cm', locator),
  claim('afirma', 'ventanas-norte', 'alto_cm', 150, 'cm', locator),
  claim('afirma', 'ventanas-norte', 'cantidad', 24, null, locator),
];

const shaft = (position: number): ClaimDraft[] => [
  claim('afirma', 'shaft-s1', 'posicion_m', position, 'm', 'detalle shaft S1'),
  claim('afirma', 'shaft-s1', 'ancho_cm', 80, 'cm', 'detalle shaft S1'),
];

const usesSlab = (thickness: number, locator: string): ClaimDraft =>
  claim('usa', 'losa-n3', 'espesor_cm', thickness, 'cm', locator);

const usesWindows = (width: number, locator: string): ClaimDraft =>
  claim('usa', 'ventanas-norte', 'ancho_cm', width, 'cm', locator);

const delivery = (locator: string): ClaimDraft =>
  claim('afirma', 'proyecto', 'entrega_dias', 108, 'días', locator);

export const SEEDED_REVISIONS: readonly SeededRevisionDef[] = [
  {
    documentId: 'a201',
    label: 'rev B',
    authorId: 'fernanda-lagos',
    pointer: 'Drive/Los Aromos/Arquitectura/A-201_revB.pdf',
    claims: [...windows(120, 'cuadro de vanos'), ...shaft(6)],
  },
  {
    documentId: 'e102',
    label: 'rev B',
    authorId: 'fernanda-lagos',
    pointer: 'Drive/Los Aromos/Estructura/E-102_revB.pdf',
    claims: slabs(
      () => 15,
      (name) => `cuadro de losas · ${name}`,
    ),
  },
  {
    documentId: 'eett03',
    label: 'rev A',
    authorId: 'paula-rojas',
    pointer: 'Drive/Los Aromos/Especificaciones/EETT-03_revA.pdf',
    claims: slabs(
      () => 15,
      (name) => `§3.2 · ${name}`,
    ),
  },
  {
    documentId: 'presupuesto',
    label: 'v2',
    authorId: 'daniela-soto',
    pointer: 'Costos/Los Aromos/Presupuesto_itemizado_v2.xlsx',
    claims: [
      ...prices(),
      usesSlab(15, 'Partidas!F14'),
      usesWindows(120, 'Partidas!F17'),
    ],
  },
  {
    documentId: 'gantt',
    label: 'v4',
    authorId: 'marcos-fuentes',
    pointer: 'Costos/Los Aromos/Carta_Gantt_v4.xlsx',
    claims: [delivery('Carta!H48'), usesSlab(15, 'Carta!D12')],
  },
  {
    documentId: 'q118',
    label: 'rev 1',
    authorId: 'ventanas-quillay',
    pointer: 'Correo/Quillay/Q-118_rev1.pdf',
    claims: [
      claim(
        'afirma',
        'partida-07.01',
        'precio_unitario',
        185_000,
        '$/m²',
        'tabla de precios',
      ),
      usesWindows(120, 'ítem 1 · medidas'),
    ],
  },
  {
    documentId: 'acta',
    label: 'N° 12',
    authorId: 'fernanda-lagos',
    pointer: 'Drive/Los Aromos/Actas/Acta_12.pdf',
    claims: [delivery('acuerdo 4')],
  },
  {
    documentId: 'libro',
    label: 'folio 41',
    authorId: 'marcos-fuentes',
    pointer: 'Libro de obra/Los Aromos/folio 41',
    claims: [claim('afirma', 'shaft-s1', 'posicion_m', 6, 'm', 'folio 41')],
  },
  {
    documentId: 'whatsapp',
    label: 'mensaje 1',
    authorId: 'marcos-fuentes',
    pointer: 'WhatsApp/Obra Los Aromos/mensaje 1',
    claims: [],
  },
];

export const FIXTURES: readonly Fixture[] = [
  {
    id: 'e102-revC',
    documentId: 'e102',
    label: 'rev C',
    seat: 'fernanda-lagos',
    spaceId: 'drive-proyecto',
    pointer: 'Drive/Los Aromos/Estructura/E-102_revC.pdf',
    requires: [],
    claims: slabs(
      (id) => (id === 'losa-n3' ? 20 : 15),
      (name) => `cuadro de losas rev C · ${name}`,
    ),
  },
  {
    id: 'presupuesto-v3',
    documentId: 'presupuesto',
    label: 'v3',
    seat: 'daniela-soto',
    spaceId: 'carpeta-costos',
    pointer: 'Costos/Los Aromos/Presupuesto_itemizado_v3.xlsx',
    requires: [{ documentId: 'e102', label: 'rev C' }],
    claims: [...prices(), usesSlab(20, 'Partidas!F14')],
  },
  {
    id: 'wa-ventanas-150',
    documentId: 'whatsapp',
    label: 'mensaje 2',
    seat: 'marcos-fuentes',
    spaceId: 'whatsapp-obra',
    pointer: 'WhatsApp/Obra Los Aromos/mensaje 2',
    requires: [],
    claims: [
      claim(
        'afirma',
        'ventanas-norte',
        'ancho_cm',
        150,
        'cm',
        'mensaje de las 14:32: «las ventanas del norte quedaron en 150»',
      ),
    ],
  },
  {
    id: 'a201-revC',
    documentId: 'a201',
    label: 'rev C',
    seat: 'fernanda-lagos',
    spaceId: 'drive-proyecto',
    pointer: 'Drive/Los Aromos/Arquitectura/A-201_revC.pdf',
    requires: [],
    claims: [...windows(150, 'cuadro de vanos rev C'), ...shaft(6)],
  },
  {
    id: 'q118-rev2',
    documentId: 'q118',
    label: 'rev 2',
    seat: 'ventanas-quillay',
    spaceId: 'correo-quillay',
    pointer: 'Correo/Quillay/Q-118_rev2.pdf',
    requires: [{ documentId: 'a201', label: 'rev C' }],
    claims: [
      claim(
        'afirma',
        'partida-07.01',
        'precio_unitario',
        185_000,
        '$/m²',
        'tabla de precios',
      ),
      claim(
        'afirma',
        'ventanas-norte',
        'ancho_cm',
        150,
        'cm',
        'ítem 1 · medidas',
      ),
      usesWindows(150, 'ítem 1 · medidas'),
    ],
  },
  {
    id: 'gantt-v5',
    documentId: 'gantt',
    label: 'v5',
    seat: 'marcos-fuentes',
    spaceId: 'carpeta-costos',
    pointer: 'Costos/Los Aromos/Carta_Gantt_v5.xlsx',
    requires: [{ documentId: 'e102', label: 'rev C' }],
    claims: [delivery('Carta!H48'), usesSlab(20, 'Carta!D12')],
  },
  {
    id: 'eett03-revB',
    documentId: 'eett03',
    label: 'rev B',
    seat: 'paula-rojas',
    spaceId: 'drive-proyecto',
    pointer: 'Drive/Los Aromos/Especificaciones/EETT-03_revB.pdf',
    requires: [{ documentId: 'e102', label: 'rev C' }],
    claims: slabs(
      (id) => (id === 'losa-n3' ? 20 : 15),
      (name) => `§3.2 rev B · ${name}`,
    ),
  },
  {
    id: 'libro-f44-shaft',
    documentId: 'libro',
    label: 'folio 44',
    seat: 'marcos-fuentes',
    spaceId: 'libro-obra',
    pointer: 'Libro de obra/Los Aromos/folio 44',
    requires: [],
    claims: [
      claim(
        'afirma',
        'shaft-s1',
        'posicion_m',
        8.5,
        'm',
        'folio 44: «el shaft S1 se corre a 8,5 m del eje A»',
      ),
    ],
  },
  {
    id: 'a201-revD',
    documentId: 'a201',
    label: 'rev D',
    seat: 'fernanda-lagos',
    spaceId: 'drive-proyecto',
    pointer: 'Drive/Los Aromos/Arquitectura/A-201_revD.pdf',
    requires: [{ documentId: 'a201', label: 'rev C' }],
    claims: [...windows(150, 'cuadro de vanos rev D'), ...shaft(8.5)],
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
): RevisionDraft => {
  const document = documentOf(documentId);
  return {
    documentId,
    documentName: document.name,
    label,
    kind: document.kind,
    spaceId,
    authorId,
    contentHash: hashOf(pointer),
    sourcePointer: pointer,
  };
};

export const seededRevisions = (): {
  revision: RevisionDraft;
  claims: ClaimDraft[];
}[] =>
  SEEDED_REVISIONS.map((seed) => ({
    revision: toRevisionDraft(
      seed.documentId,
      seed.label,
      seed.authorId,
      documentOf(seed.documentId).spaceId,
      seed.pointer,
    ),
    claims: [...seed.claims],
  }));

export const fixtureRevision = (fixture: Fixture): RevisionDraft =>
  toRevisionDraft(
    fixture.documentId,
    fixture.label,
    fixture.seat,
    fixture.spaceId,
    fixture.pointer,
  );

export const fixtureCatalog = (): Record<string, ClaimDraft[]> =>
  Object.fromEntries(
    FIXTURES.map((fixture) => [
      fixtureKey(fixture.documentId, fixture.label),
      [...fixture.claims],
    ]),
  );

export const findFixture = (id: string): Fixture | undefined =>
  FIXTURES.find((fixture) => fixture.id === id);

export const subjectName = (id: string): string =>
  SUBJECTS.find((subject) => subject.id === id)?.name ?? id;

export const attributeLabel = (key: string): string =>
  ATTRIBUTES.find((attribute) => attribute.key === key)?.label ?? key;
