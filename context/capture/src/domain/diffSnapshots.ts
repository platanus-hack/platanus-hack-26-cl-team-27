import type { ChangeDraft, ChangeKind, PropertyDiff } from './Change.ts';
import type { ModelElement, PropertyValue } from './ModelElement.ts';

const numberFormat = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});

export const formatValue = (
  value: PropertyValue | null,
  unit: string | null,
): string => {
  if (value === null) return '—';
  const text = typeof value === 'number' ? numberFormat.format(value) : value;
  return unit ? `${text} ${unit}` : text;
};

export const describeDiffs = (
  kind: ChangeKind,
  diffs: readonly PropertyDiff[],
): string => {
  if (kind === 'added') return 'Elemento nuevo en el modelo';
  if (kind === 'removed') return 'Elemento eliminado del modelo';
  return diffs
    .map(
      (diff) =>
        `${diff.label}: ${formatValue(diff.before, diff.unit)} → ${formatValue(diff.after, diff.unit)}`,
    )
    .join(' · ');
};

const valuesOf = (
  element: ModelElement | undefined,
): Record<string, PropertyValue> =>
  Object.fromEntries(
    (element?.properties ?? []).map((property) => [
      property.key,
      property.value,
    ]),
  );

const diffProperties = (
  before: ModelElement | undefined,
  after: ModelElement | undefined,
): PropertyDiff[] => {
  const keys = new Map<string, { label: string; unit: string | null }>();
  for (const property of [
    ...(before?.properties ?? []),
    ...(after?.properties ?? []),
  ]) {
    if (!keys.has(property.key)) {
      keys.set(property.key, { label: property.label, unit: property.unit });
    }
  }
  const beforeValues = valuesOf(before);
  const afterValues = valuesOf(after);
  return [...keys]
    .filter(([key]) => beforeValues[key] !== afterValues[key])
    .map(([key, { label, unit }]) => ({
      key,
      label,
      unit,
      before: beforeValues[key] ?? null,
      after: afterValues[key] ?? null,
    }));
};

export const diffSnapshots = (
  previous: readonly ModelElement[],
  next: readonly ModelElement[],
  integrationId: string,
  version: number,
): ChangeDraft[] => {
  const previousById = new Map(
    previous.map((element) => [element.id, element]),
  );
  const nextById = new Map(next.map((element) => [element.id, element]));
  const ids = [...new Set([...previousById.keys(), ...nextById.keys()])];

  return ids.flatMap((id): ChangeDraft[] => {
    const before = previousById.get(id);
    const after = nextById.get(id);
    const element = after ?? before;
    if (!element) return [];
    const kind: ChangeKind = !before
      ? 'added'
      : !after
        ? 'removed'
        : 'modified';
    const diffs = diffProperties(before, after);
    if (kind === 'modified' && diffs.length === 0) return [];
    return [
      {
        integrationId,
        version,
        element: {
          id: element.id,
          name: element.name,
          category: element.category,
        },
        kind,
        summary: describeDiffs(kind, diffs),
        diffs,
        before: valuesOf(before),
        after: valuesOf(after),
      },
    ];
  });
};
