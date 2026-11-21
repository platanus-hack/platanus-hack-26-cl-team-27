import type {
  AreaCell,
  ClaimValue,
  Footprint,
  FootprintModel,
  SpatialKind,
} from '@team27/context-lake';

export interface LevelDef {
  readonly id: string;
  readonly label: string;
  readonly short: string;
}

export interface SystemDef {
  readonly id: string;
  readonly label: string;
  readonly occupiesSpace: boolean;
}

export interface LongitudinalAxis {
  readonly id: string;
  readonly meters: number;
}

export const LEVELS: readonly LevelDef[] = [
  { id: 'n1', label: 'Nivel 1', short: 'nivel 1' },
  { id: 'n2', label: 'Nivel 2', short: 'nivel 2' },
  { id: 'n3', label: 'Nivel 3', short: 'nivel 3' },
  { id: 'n4', label: 'Nivel 4', short: 'nivel 4' },
  { id: 'n5', label: 'Nivel 5', short: 'nivel 5' },
  { id: 'n6', label: 'Cubierta', short: 'cubierta' },
];

export const LONGITUDINAL_AXES: readonly LongitudinalAxis[] = [
  { id: 'A', meters: 0 },
  { id: 'B', meters: 4 },
  { id: 'C', meters: 8 },
  { id: 'D', meters: 12 },
  { id: 'E', meters: 16 },
];

export const TRANSVERSAL_AXES: readonly number[] = [1, 2, 3, 4];

export const SYSTEMS: readonly SystemDef[] = [
  { id: 'estructura', label: 'estructura', occupiesSpace: true },
  { id: 'arquitectura', label: 'arquitectura', occupiesSpace: true },
  { id: 'sanitarias', label: 'sanitarias', occupiesSpace: true },
  { id: 'electricas', label: 'eléctricas', occupiesSpace: true },
  { id: 'costos', label: 'costos', occupiesSpace: false },
  { id: 'plazo', label: 'plazo', occupiesSpace: false },
];

export const SPANS: readonly string[] = LONGITUDINAL_AXES.slice(0, -1).map(
  (axis, index) => `${axis.id}-${LONGITUDINAL_AXES[index + 1]?.id ?? ''}`,
);

export const spanOf = (meters: unknown): string | null => {
  if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;
  const last = LONGITUDINAL_AXES[LONGITUDINAL_AXES.length - 1]?.meters ?? 0;
  if (meters < 0 || meters > last) return null;
  return SPANS[Math.min(Math.floor(meters / 4), SPANS.length - 1)] ?? null;
};

export const cellsOfAxis = (axis: number): string[] =>
  SPANS.map((span) => `${span}/${axis}`);

export const ALL_CELLS: readonly string[] =
  TRANSVERSAL_AXES.flatMap(cellsOfAxis);

const levelIds = (from: number, to: number): string[] =>
  LEVELS.slice(from - 1, to).map((level) => level.id);

const cellsFor = (
  levels: readonly string[],
  celdas: readonly string[],
  sistemas: readonly string[],
): AreaCell[] =>
  levels.flatMap((nivel) =>
    celdas.map((celda) => ({ nivel, celda, sistemas })),
  );

interface SpatialDef {
  readonly kind: Exclude<SpatialKind, 'ninguno'>;
  readonly footprint: (
    values: Readonly<Record<string, ClaimValue>>,
  ) => AreaCell[];
}

const positioned =
  (levels: readonly string[], sistemas: readonly string[]) =>
  (values: Readonly<Record<string, ClaimValue>>): AreaCell[] => {
    const span = spanOf(values['posicion_m']);
    return span ? cellsFor(levels, [`${span}/3`], sistemas) : [];
  };

const SLAB_LEVEL: Readonly<Record<string, string>> = {
  'losa-n2': 'n2',
  'losa-n3': 'n3',
  'losa-n4': 'n4',
  'losa-n5': 'n5',
  'losa-cubierta': 'n6',
};

const SPATIAL: Readonly<Record<string, SpatialDef>> = {
  ...Object.fromEntries(
    Object.entries(SLAB_LEVEL).map(([subject, level]): [string, SpatialDef] => [
      subject,
      {
        kind: 'soporte',
        footprint: () => cellsFor([level], ALL_CELLS, ['estructura']),
      },
    ]),
  ),
  'shaft-s1': {
    kind: 'ocupante',
    footprint: positioned(levelIds(1, 6), ['sanitarias', 'electricas']),
  },
  'ventanas-norte': {
    kind: 'ocupante',
    footprint: () => cellsFor(levelIds(1, 5), cellsOfAxis(1), ['arquitectura']),
  },
  'colector-b2': {
    kind: 'ocupante',
    footprint: positioned(['n3'], ['sanitarias']),
  },
};

export const spatialKindOf = (subject: string): SpatialKind =>
  SPATIAL[subject]?.kind ?? 'ninguno';

export const footprintModel: FootprintModel = (subject, values): Footprint => {
  const def = SPATIAL[subject];
  return def
    ? { kind: def.kind, areas: def.footprint(values) }
    : { kind: 'ninguno', areas: [] };
};

export const levelLabel = (id: string): string =>
  LEVELS.find((level) => level.id === id)?.short ?? id;

export const systemLabel = (id: string): string =>
  SYSTEMS.find((system) => system.id === id)?.label ?? id;

export const areaLabel = (area: AreaCell): string =>
  `${levelLabel(area.nivel)} · ${area.celda} · ${area.sistemas.map(systemLabel).join(' y ')}`;
