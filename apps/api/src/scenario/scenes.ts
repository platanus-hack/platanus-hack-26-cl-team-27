import { type Fixture, findFixture } from './documents.ts';

export interface Scene {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly extra: boolean;
  readonly fixtureIds: readonly string[];
}

export const SCENES: readonly Scene[] = [
  {
    id: 's1',
    label: 'Llega el plano E-102 rev C',
    hint: 'Fernanda suelta la planta estructural con la losa del nivel 3 en 20 cm.',
    extra: false,
    fixtureIds: ['e102-revC'],
  },
  {
    id: 's2',
    label: 'Daniela corrige el presupuesto',
    hint: 'Daniela sube el presupuesto v3 con la losa en 20 cm.',
    extra: false,
    fixtureIds: ['presupuesto-v3'],
  },
  {
    id: 's3',
    label: 'Marcos avisa por WhatsApp',
    hint: 'Un mensaje dice que las ventanas del norte quedaron en 150 cm. No manda: abre una discrepancia.',
    extra: false,
    fixtureIds: ['wa-ventanas-150'],
  },
  {
    id: 's4',
    label: 'Llega el plano A-201 rev C',
    hint: 'Fernanda suelta el plano que respalda el mensaje y abre la propuesta de las ventanas.',
    extra: false,
    fixtureIds: ['a201-revC'],
  },
  {
    id: 's5',
    label: 'Quillay vuelve a cotizar',
    hint: 'Ventanas Quillay sube la cotización rev 2 con el ancho de 150 cm.',
    extra: false,
    fixtureIds: ['q118-rev2'],
  },
  {
    id: 's6',
    label: 'Cierre: los demás se ponen al día',
    hint: 'Marcos sube la Carta Gantt v5 y Paula la EETT-03 rev B.',
    extra: false,
    fixtureIds: ['gantt-v5', 'eett03-revB'],
  },
  {
    id: 'x1',
    label: 'Decisión en el libro de obra',
    hint: 'El folio 44 dice que el shaft S1 se corre a 8,5 m. Abre una discrepancia para Fernanda.',
    extra: true,
    fixtureIds: ['libro-f44-shaft'],
  },
  {
    id: 'x2',
    label: 'Llega el plano A-201 rev D',
    hint: 'Fernanda suelta el plano que respalda el folio y abre la propuesta del shaft.',
    extra: true,
    fixtureIds: ['a201-revD'],
  },
];

export const AUTOPLAY_CHAIN: readonly string[] = [
  's1',
  's2',
  's3',
  's4',
  'x1',
  'x2',
  's5',
  's6',
];

export const findScene = (id: string): Scene | undefined =>
  SCENES.find((scene) => scene.id === id);

export type HasRevision = (documentId: string, label: string) => boolean;

export interface SceneProgress {
  readonly remaining: readonly Fixture[];
  readonly complete: boolean;
}

export const fixturesOf = (scene: Scene): Fixture[] =>
  scene.fixtureIds.flatMap((id) => {
    const fixture = findFixture(id);
    return fixture ? [fixture] : [];
  });

export const sceneProgress = (
  scene: Scene,
  has: HasRevision,
): SceneProgress => {
  const remaining = fixturesOf(scene).filter(
    (fixture) => !has(fixture.documentId, fixture.label),
  );
  return { remaining, complete: remaining.length === 0 };
};

export const unmetRequirement = (
  fixture: Fixture,
  has: HasRevision,
): { documentId: string; label: string } | null =>
  fixture.requires.find(
    (requirement) => !has(requirement.documentId, requirement.label),
  ) ?? null;
