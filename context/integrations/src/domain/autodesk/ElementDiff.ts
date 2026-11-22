export type AecDifferenceType = 'ADDITION' | 'MODIFICATION' | 'REMOVAL';

export interface AecProperty {
  readonly name: string;
  readonly value?: unknown;
  readonly displayValue?: string | null;
  readonly definition?: {
    readonly units?: { readonly name?: string | null } | null;
  } | null;
}

export interface AecElement {
  readonly id: string;
  readonly name?: string | null;
  readonly alternativeIdentifiers?: {
    readonly externalElementId?: string | null;
    readonly revitElementId?: string | null;
  } | null;
  readonly properties?: {
    readonly results?: readonly AecProperty[] | null;
  } | null;
}

export interface AecElementDifference {
  readonly type: AecDifferenceType;
  readonly element: AecElement;
  readonly differences?: {
    readonly results?:
      | readonly {
          readonly type?: AecDifferenceType | null;
          readonly oldItem?: AecProperty | null;
          readonly item?: AecProperty | null;
        }[]
      | null;
  } | null;
}

export type ElementChangeType = 'added' | 'modified' | 'removed';

export type PropertyValue = string | number | boolean | null;

export interface PropertyChange {
  readonly name: string;
  readonly before: PropertyValue;
  readonly after: PropertyValue;
  readonly unit: string | null;
}

export interface ElementChange {
  readonly type: ElementChangeType;
  readonly elementId: string;
  readonly uniqueId: string | null;
  readonly revitId: number | null;
  readonly name: string | null;
  readonly category: string | null;
  readonly level: string | null;
  readonly subjectId: string | null;
  readonly properties: readonly PropertyChange[];
}

const CHANGE_TYPES: Readonly<Record<AecDifferenceType, ElementChangeType>> = {
  ADDITION: 'added',
  MODIFICATION: 'modified',
  REMOVAL: 'removed',
};

export const SUBJECT_PARAMETER = 'Clave obra';

const CATEGORY_NAMES = ['Category', 'Categoría', 'Categoria'];

const LEVEL_NAMES = [
  'Level',
  'Nivel',
  'Base Constraint',
  'Restricción de base',
  'Reference Level',
];

const valueOf = (property: AecProperty | null | undefined): PropertyValue => {
  if (!property) return null;
  const { value } = property;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  return property.displayValue ?? null;
};

const unitOf = (property: AecProperty | null | undefined): string | null =>
  property?.definition?.units?.name ?? null;

const textProperty = (
  element: AecElement,
  names: readonly string[],
): string | null => {
  const wanted = names.map((name) => name.toLowerCase());
  for (const property of element.properties?.results ?? []) {
    if (!wanted.includes(property.name.toLowerCase())) continue;
    const value = valueOf(property);
    if (value !== null && String(value).trim() !== '')
      return String(value).trim();
  }
  return null;
};

const revitIdOf = (element: AecElement): number | null => {
  const raw = element.alternativeIdentifiers?.revitElementId;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

export const toElementChanges = (
  differences: readonly AecElementDifference[],
  subjectParameter: string = SUBJECT_PARAMETER,
): ElementChange[] =>
  differences.map((difference) => {
    const { element } = difference;
    const properties: PropertyChange[] = (difference.differences?.results ?? [])
      .map((item) => ({
        name: item.item?.name ?? item.oldItem?.name ?? '',
        before: valueOf(item.oldItem),
        after: valueOf(item.item),
        unit: unitOf(item.item) ?? unitOf(item.oldItem),
      }))
      .filter((item) => item.name !== '' && item.before !== item.after);
    return {
      type: CHANGE_TYPES[difference.type],
      elementId: element.id,
      uniqueId: element.alternativeIdentifiers?.externalElementId ?? null,
      revitId: revitIdOf(element),
      name: element.name ?? null,
      category: textProperty(element, CATEGORY_NAMES),
      level: textProperty(element, LEVEL_NAMES),
      subjectId: textProperty(element, [subjectParameter]),
      properties,
    };
  });

export type TrackedAttribute =
  'espesor_cm' | 'ancho_cm' | 'alto_cm' | 'posicion_m';

interface AttributeRule {
  readonly attribute: TrackedAttribute;
  readonly unit: 'cm' | 'm';
  readonly decimals: number;
  readonly names: readonly string[];
}

export const ATTRIBUTE_RULES: readonly AttributeRule[] = [
  {
    attribute: 'espesor_cm',
    unit: 'cm',
    decimals: 1,
    names: [
      'Thickness',
      'Default Thickness',
      'Espesor',
      'Grosor',
      'Grosor por defecto',
    ],
  },
  {
    attribute: 'ancho_cm',
    unit: 'cm',
    decimals: 1,
    names: ['Width', 'Ancho', 'Anchura'],
  },
  {
    attribute: 'alto_cm',
    unit: 'cm',
    decimals: 1,
    names: ['Height', 'Alto', 'Altura'],
  },
  {
    attribute: 'posicion_m',
    unit: 'm',
    decimals: 2,
    names: ['Distancia eje A', 'Distancia al eje A', 'Posición', 'Posicion'],
  },
];

const METERS_PER_UNIT: Readonly<Record<string, number>> = {
  meters: 1,
  meter: 1,
  m: 1,
  centimeters: 0.01,
  centimeter: 0.01,
  cm: 0.01,
  millimeters: 0.001,
  millimeter: 0.001,
  mm: 0.001,
  feet: 0.3048,
  foot: 0.3048,
  ft: 0.3048,
  inches: 0.0254,
  inch: 0.0254,
  in: 0.0254,
};

const DISPLAY_UNIT = /^\s*(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m|ft|in)\b/i;

const metersOf = (value: PropertyValue, unit: string | null): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const factor = METERS_PER_UNIT[(unit ?? 'meters').toLowerCase()];
    return factor === undefined ? null : value * factor;
  }
  if (typeof value === 'string') {
    const match = value.match(DISPLAY_UNIT);
    if (!match?.[1] || !match[2]) return null;
    const factor = METERS_PER_UNIT[match[2].toLowerCase()];
    return factor === undefined
      ? null
      : Number(match[1].replace(',', '.')) * factor;
  }
  return null;
};

const round = (value: number, decimals: number): number => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

const convert = (
  value: PropertyValue,
  unit: string | null,
  rule: AttributeRule,
): number | null => {
  const meters = metersOf(value, unit);
  if (meters === null) return null;
  return round(rule.unit === 'cm' ? meters * 100 : meters, rule.decimals);
};

export interface MinuteElement {
  readonly id: number;
  readonly uniqueId: string;
  readonly category: string | null;
  readonly name: string | null;
  readonly level: string | null;
}

export interface MinuteChange {
  readonly subjectId: string;
  readonly attribute: string;
  readonly before: number | null;
  readonly after: number | null;
  readonly unit: string | null;
  readonly elements: readonly MinuteElement[];
}

export type IgnoredReason =
  | 'sin_clave'
  | 'sin_atributo_seguido'
  | 'unidad_desconocida'
  | 'sin_identificador_revit';

export interface IgnoredElementChange {
  readonly elementId: string;
  readonly name: string | null;
  readonly reason: IgnoredReason;
}

export interface MinuteDraft {
  readonly changes: MinuteChange[];
  readonly ignored: IgnoredElementChange[];
}

export interface QuantityCounts {
  readonly before: Readonly<Record<string, number>>;
  readonly after: Readonly<Record<string, number>>;
}

const mostFrequent = (values: readonly (number | null)[]): number | null => {
  const counts = new Map<number | null, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

interface Pending {
  readonly befores: (number | null)[];
  readonly afters: (number | null)[];
  readonly elements: MinuteElement[];
  readonly unit: string;
}

const ruleFor = (name: string): AttributeRule | undefined => {
  const lower = name.toLowerCase();
  return ATTRIBUTE_RULES.find((rule) =>
    rule.names.some((candidate) => candidate.toLowerCase() === lower),
  );
};

export const toMinuteChanges = (
  elementChanges: readonly ElementChange[],
  counts?: QuantityCounts,
): MinuteDraft => {
  const pending = new Map<string, Pending>();
  const ignored: IgnoredElementChange[] = [];
  const ignore = (change: ElementChange, reason: IgnoredReason): void => {
    ignored.push({ elementId: change.elementId, name: change.name, reason });
  };
  for (const change of elementChanges) {
    if (!change.subjectId) {
      ignore(change, 'sin_clave');
      continue;
    }
    if (change.revitId === null || !change.uniqueId) {
      ignore(change, 'sin_identificador_revit');
      continue;
    }
    const element: MinuteElement = {
      id: change.revitId,
      uniqueId: change.uniqueId,
      category: change.category,
      name: change.name,
      level: change.level,
    };
    let tracked = false;
    let unknownUnit = false;
    for (const property of change.properties) {
      const rule = ruleFor(property.name);
      if (!rule) continue;
      tracked = true;
      const before =
        change.type === 'added'
          ? null
          : convert(property.before, property.unit, rule);
      const after =
        change.type === 'removed'
          ? null
          : convert(property.after, property.unit, rule);
      if (
        (change.type !== 'added' &&
          property.before !== null &&
          before === null) ||
        (change.type !== 'removed' && property.after !== null && after === null)
      ) {
        unknownUnit = true;
        continue;
      }
      if (before === after) continue;
      const key = `${change.subjectId}\u0000${rule.attribute}`;
      const entry = pending.get(key) ?? {
        befores: [],
        afters: [],
        elements: [],
        unit: rule.unit,
      };
      entry.befores.push(before);
      entry.afters.push(after);
      if (!entry.elements.some((item) => item.uniqueId === element.uniqueId)) {
        entry.elements.push(element);
      }
      pending.set(key, entry);
    }
    if (unknownUnit) ignore(change, 'unidad_desconocida');
    else if (!tracked && change.type === 'modified')
      ignore(change, 'sin_atributo_seguido');
  }
  const changes: MinuteChange[] = [...pending.entries()].map(([key, entry]) => {
    const [subjectId = '', attribute = ''] = key.split('\u0000');
    return {
      subjectId,
      attribute,
      before: mostFrequent(entry.befores),
      after: mostFrequent(entry.afters),
      unit: entry.unit,
      elements: entry.elements,
    };
  });
  if (counts) {
    const subjects = new Set([
      ...Object.keys(counts.before),
      ...Object.keys(counts.after),
    ]);
    for (const subjectId of [...subjects].sort()) {
      const before = counts.before[subjectId] ?? 0;
      const after = counts.after[subjectId] ?? 0;
      if (before === after) continue;
      changes.push({
        subjectId,
        attribute: 'cantidad',
        before,
        after,
        unit: null,
        elements: [],
      });
    }
  }
  return { changes, ignored };
};

export const countBySubject = (
  elements: readonly AecElement[],
  subjectParameter: string = SUBJECT_PARAMETER,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const element of elements) {
    const subjectId = textProperty(element, [subjectParameter]);
    if (subjectId) counts[subjectId] = (counts[subjectId] ?? 0) + 1;
  }
  return counts;
};
