import type {
  BaselineEntry,
  ClaimValue,
  ModelElement,
} from '@team27/context-lake';

export type ValueOverrides = Readonly<
  Record<string, Readonly<Record<string, ClaimValue>>>
>;

export const elementsFromBaseline = (
  model: readonly ModelElement[],
  baseline: readonly Pick<BaselineEntry, 'subject' | 'attribute' | 'value'>[],
  overrides: ValueOverrides = {},
): ModelElement[] =>
  model.map((element) => {
    const values = new Map<string, ClaimValue>();
    for (const entry of baseline) {
      if (entry.subject === element.id)
        values.set(entry.attribute, entry.value);
    }
    for (const [key, value] of Object.entries(overrides[element.id] ?? {})) {
      values.set(key, value);
    }
    return {
      ...element,
      properties: element.properties.map((property) => {
        const value = values.get(property.key);
        return typeof value === 'number' || typeof value === 'string'
          ? { ...property, value }
          : property;
      }),
    };
  });
