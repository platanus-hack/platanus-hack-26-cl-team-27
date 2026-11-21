export type Properties = Readonly<Record<string, number | string>>;

export interface QuantityDefinition {
  readonly label: string;
  readonly unit: string;
  readonly compute: (properties: Properties) => number;
}

const numeric = (properties: Properties, key: string): number => {
  const value = properties[key];
  return typeof value === 'number' ? value : 0;
};

export const CONCRETE_WEIGHT_KN_M3 = 25;

export const QUANTITIES: Readonly<
  Record<string, Readonly<Record<string, QuantityDefinition>>>
> = {
  losa: {
    volumen: {
      label: 'Volumen de hormigón',
      unit: 'm³',
      compute: (p) => (numeric(p, 'area_m2') * numeric(p, 'espesor_cm')) / 100,
    },
    peso_propio: {
      label: 'Peso propio',
      unit: 'kN/m²',
      compute: (p) => (numeric(p, 'espesor_cm') / 100) * CONCRETE_WEIGHT_KN_M3,
    },
  },
  ventana: {
    superficie: {
      label: 'Superficie de ventanas',
      unit: 'm²',
      compute: (p) =>
        (numeric(p, 'cantidad') *
          numeric(p, 'ancho_cm') *
          numeric(p, 'alto_cm')) /
        10_000,
    },
  },
  shaft: {
    perforacion: {
      label: 'Perforación por losa',
      unit: 'm²',
      compute: (p) =>
        (numeric(p, 'ancho_cm') * numeric(p, 'largo_cm')) / 10_000,
    },
  },
};

export const quantityDefinition = (
  category: string,
  key: string,
): QuantityDefinition | null => QUANTITIES[category]?.[key] ?? null;

export const quantityOf = (
  category: string,
  key: string,
  properties: Properties,
): number => quantityDefinition(category, key)?.compute(properties) ?? 0;
