import type {
  AreaCell,
  Footprint,
  FootprintModel,
} from '../src/domain/AreaCell.ts';
import { NO_FOOTPRINT } from '../src/domain/AreaCell.ts';

const TRAMOS = ['A-B', 'B-C', 'C-D', 'D-E'] as const;

export const tramoOf = (meters: unknown): string | null => {
  if (typeof meters !== 'number' || meters < 0 || meters > 16) return null;
  return TRAMOS[Math.min(Math.floor(meters / 4), 3)] ?? null;
};

const cells = (
  levels: readonly string[],
  celdas: readonly string[],
  sistemas: readonly string[],
): AreaCell[] =>
  levels.flatMap((nivel) =>
    celdas.map((celda) => ({ nivel, celda, sistemas })),
  );

const ALL_LEVELS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];

const ALL_CELLS = TRAMOS.flatMap((tramo) =>
  [1, 2, 3, 4].map((axis) => `${tramo}/${axis}`),
);

const positioned =
  (levels: readonly string[], sistemas: readonly string[]): FootprintModel =>
  (_subject, values) => {
    const tramo = tramoOf(values['posicion_m']);
    return {
      kind: 'ocupante',
      areas: tramo ? cells(levels, [`${tramo}/3`], sistemas) : [],
    };
  };

const MODELS: Readonly<Record<string, FootprintModel>> = {
  'shaft-s1': positioned(ALL_LEVELS, ['sanitarias', 'electricas']),
  'colector-b2': positioned(['n3'], ['sanitarias']),
  'bandeja-e3': positioned(['n3'], ['electricas']),
  'ventanas-norte': () => ({
    kind: 'ocupante',
    areas: cells(
      ['n1', 'n2', 'n3', 'n4', 'n5'],
      TRAMOS.map((tramo) => `${tramo}/1`),
      ['arquitectura'],
    ),
  }),
  'losa-n3': () => ({
    kind: 'soporte',
    areas: cells(['n3'], ALL_CELLS, ['estructura']),
  }),
};

export const footprintModel: FootprintModel = (subject, values): Footprint =>
  MODELS[subject]?.(subject, values) ?? NO_FOOTPRINT;
