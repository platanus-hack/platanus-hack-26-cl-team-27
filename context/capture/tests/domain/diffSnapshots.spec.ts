import type { ModelElement } from '../../src/domain/ModelElement.ts';
import { diffSnapshots, formatValue } from '../../src/domain/diffSnapshots.ts';

const slab = (thickness: number): ModelElement => ({
  id: 'losa-n3',
  name: 'Losa nivel 3',
  category: 'losa',
  level: 3,
  properties: [
    {
      key: 'espesor_cm',
      label: 'Espesor',
      value: thickness,
      unit: 'cm',
      editable: true,
    },
    { key: 'area_m2', label: 'Área', value: 280, unit: 'm²', editable: false },
  ],
});

const shaft: ModelElement = {
  id: 'shaft-s1',
  name: 'Shaft S1',
  category: 'shaft',
  level: null,
  properties: [
    {
      key: 'posicion_m',
      label: 'Posición',
      value: 6,
      unit: 'm',
      editable: true,
    },
  ],
};

describe('diffSnapshots', () => {
  it('no ve cambios entre dos versiones iguales', () => {
    expect(
      diffSnapshots([slab(15), shaft], [slab(15), shaft], 'rev-1'),
    ).toEqual([]);
  });

  it('describe solo las propiedades que cambiaron', () => {
    const [change, ...rest] = diffSnapshots(
      [slab(15), shaft],
      [slab(20), shaft],
      'rev-1',
    );

    expect(rest).toEqual([]);
    expect(change).toMatchObject({
      sourceId: 'rev-1',
      kind: 'modified',
      element: { id: 'losa-n3', name: 'Losa nivel 3', category: 'losa' },
      summary: 'Espesor: 15 cm → 20 cm',
      diffs: [
        {
          key: 'espesor_cm',
          label: 'Espesor',
          unit: 'cm',
          before: 15,
          after: 20,
        },
      ],
      before: { espesor_cm: 15, area_m2: 280 },
      after: { espesor_cm: 20, area_m2: 280 },
    });
  });

  it('marca los elementos nuevos y los eliminados', () => {
    const changes = diffSnapshots([slab(15)], [shaft], 'rev-1');

    expect(
      changes.map((change) => [change.element.id, change.kind, change.summary]),
    ).toEqual([
      ['losa-n3', 'removed', 'Elemento eliminado del modelo'],
      ['shaft-s1', 'added', 'Elemento nuevo en el modelo'],
    ]);
  });
});

describe('formatValue', () => {
  it('usa coma decimal y la unidad', () => {
    expect(formatValue(8.5, 'm')).toBe('8,5 m');
    expect(formatValue('Termopanel', null)).toBe('Termopanel');
    expect(formatValue(null, 'cm')).toBe('—');
  });
});
