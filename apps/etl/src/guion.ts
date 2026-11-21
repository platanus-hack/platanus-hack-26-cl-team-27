import type { Extracted, RevisionRef } from './types.ts';

export interface Paso {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly extra: boolean;
  readonly files: readonly string[];
  readonly requires: readonly RevisionRef[];
}

export const CARGA_INICIAL: readonly string[] = [
  'drive-proyecto/A-201_revB.json',
  'drive-proyecto/E-102_revB.json',
  'drive-proyecto/EETT-03_revA.md',
  'carpeta-costos/Presupuesto_itemizado_v2.csv',
  'carpeta-costos/Carta_Gantt_v4.csv',
  'correo-quillay/Q-118_rev1.csv',
  'drive-proyecto/Acta_12.txt',
  'libro-de-obra/folio-41.txt',
  'whatsapp-obra/mensaje-1.txt',
];

const E102_REV_C: RevisionRef = { documentId: 'e102', label: 'rev C' };
const A201_REV_C: RevisionRef = { documentId: 'a201', label: 'rev C' };

export const PASOS: readonly Paso[] = [
  {
    id: 's1',
    title: 'Llega el plano E-102 rev C',
    hint: 'Fernanda suelta la planta estructural con la losa del nivel 3 en 20 cm.',
    extra: false,
    files: ['drive-proyecto/E-102_revC.json'],
    requires: [],
  },
  {
    id: 's2',
    title: 'Daniela corrige el presupuesto',
    hint: 'Daniela sube el presupuesto v3 con la losa en 20 cm.',
    extra: false,
    files: ['carpeta-costos/Presupuesto_itemizado_v3.csv'],
    requires: [E102_REV_C],
  },
  {
    id: 's3',
    title: 'Marcos avisa por WhatsApp',
    hint: 'Un mensaje dice que las ventanas del norte quedaron en 150 cm. No manda: abre una discrepancia.',
    extra: false,
    files: ['whatsapp-obra/mensaje-2.txt'],
    requires: [],
  },
  {
    id: 's4',
    title: 'Llega el plano A-201 rev C',
    hint: 'Fernanda suelta el plano que respalda el mensaje y abre la propuesta de las ventanas.',
    extra: false,
    files: ['drive-proyecto/A-201_revC.json'],
    requires: [],
  },
  {
    id: 'x1',
    title: 'Decisión en el libro de obra',
    hint: 'El folio 44 dice que el shaft S1 se corre a 8,5 m. Abre una discrepancia para Fernanda.',
    extra: true,
    files: ['libro-de-obra/folio-44.txt'],
    requires: [],
  },
  {
    id: 'x2',
    title: 'Llega el plano A-201 rev D',
    hint: 'Fernanda suelta el plano que respalda el folio y abre la propuesta del shaft.',
    extra: true,
    files: ['drive-proyecto/A-201_revD.json'],
    requires: [A201_REV_C],
  },
  {
    id: 's5',
    title: 'Quillay vuelve a cotizar',
    hint: 'Ventanas Quillay sube la cotización rev 2 con el ancho de 150 cm.',
    extra: false,
    files: ['correo-quillay/Q-118_rev2.csv'],
    requires: [A201_REV_C],
  },
  {
    id: 's6',
    title: 'Cierre: los demás se ponen al día',
    hint: 'Marcos sube la Carta Gantt v5 y Paula la EETT-03 rev B.',
    extra: false,
    files: [
      'carpeta-costos/Carta_Gantt_v5.csv',
      'drive-proyecto/EETT-03_revB.md',
    ],
    requires: [E102_REV_C],
  },
];

export const findPaso = (id: string): Paso | undefined =>
  PASOS.find((paso) => paso.id === id);

export type HasRevision = (documentId: string, label: string) => boolean;

export const unmetRequirement = (
  paso: Paso,
  has: HasRevision,
): RevisionRef | null =>
  paso.requires.find((ref) => !has(ref.documentId, ref.label)) ?? null;

export const refsOf = (
  paso: Paso,
  index: ReadonlyMap<string, Extracted>,
): RevisionRef[] =>
  paso.files.map((path) => {
    const item = index.get(path);
    if (item === undefined) {
      throw new Error(
        `El paso ${paso.id} apunta a ${path}, que no está en el lago`,
      );
    }
    return { documentId: item.revision.documentId, label: item.revision.label };
  });

export const isDone = (
  paso: Paso,
  has: HasRevision,
  index: ReadonlyMap<string, Extracted>,
): boolean =>
  refsOf(paso, index).every((ref) => has(ref.documentId, ref.label));

export const nextPaso = (
  has: HasRevision,
  index: ReadonlyMap<string, Extracted>,
): Paso | null => PASOS.find((paso) => !isDone(paso, has, index)) ?? null;
