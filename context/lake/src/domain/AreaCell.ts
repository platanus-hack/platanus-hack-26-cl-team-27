import type { ClaimValue } from './Claim.ts';

export interface AreaCell {
  readonly nivel: string;
  readonly celda: string;
  readonly sistemas: readonly string[];
}

export type SpatialKind = 'soporte' | 'ocupante' | 'ninguno';

export interface Footprint {
  readonly kind: SpatialKind;
  readonly areas: readonly AreaCell[];
}

export type FootprintModel = (
  subject: string,
  values: Readonly<Record<string, ClaimValue>>,
) => Footprint;

export const NO_FOOTPRINT: Footprint = { kind: 'ninguno', areas: [] };

export type OverlapRelation = 'cruce_trazado' | 'interferencia';

export interface SharedArea {
  readonly area: AreaCell;
  readonly relation: OverlapRelation;
}

const cellKey = (area: Pick<AreaCell, 'nivel' | 'celda'>): string =>
  `${area.nivel}\u0000${area.celda}`;

export const sameFootprint = (a: Footprint, b: Footprint): boolean => {
  if (a.areas.length !== b.areas.length) return false;
  const left = new Set(
    a.areas.map(
      (area) => `${cellKey(area)}\u0000${[...area.sistemas].sort().join(',')}`,
    ),
  );
  return b.areas.every((area) =>
    left.has(`${cellKey(area)}\u0000${[...area.sistemas].sort().join(',')}`),
  );
};

export const sharedAreas = (a: Footprint, b: Footprint): SharedArea[] => {
  const byCell = new Map(b.areas.map((area) => [cellKey(area), area]));
  const shared: SharedArea[] = [];
  for (const area of a.areas) {
    const other = byCell.get(cellKey(area));
    if (!other) continue;
    const common = area.sistemas.filter((system) =>
      other.sistemas.includes(system),
    );
    const union = [...new Set([...area.sistemas, ...other.sistemas])];
    shared.push({
      area: {
        nivel: area.nivel,
        celda: area.celda,
        sistemas: common.length > 0 ? common : union,
      },
      relation: common.length > 0 ? 'cruce_trazado' : 'interferencia',
    });
  }
  return shared.sort(
    (x, y) =>
      x.area.nivel.localeCompare(y.area.nivel) ||
      x.area.celda.localeCompare(y.area.celda),
  );
};
