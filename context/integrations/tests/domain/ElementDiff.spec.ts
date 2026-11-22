import {
  type AecElement,
  type AecElementDifference,
  countBySubject,
  toElementChanges,
  toMinuteChanges,
} from '../../src/domain/autodesk/ElementDiff.ts';
import { minuteIdFor } from '../../src/domain/autodesk/MinuteId.ts';

const slab = (subject: string | null, revitId = '312456'): AecElement => ({
  id: `el-${revitId}`,
  name: 'Losa H30 20 cm',
  alternativeIdentifiers: {
    externalElementId: `8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-${revitId}`,
    revitElementId: revitId,
  },
  properties: {
    results: [
      ...(subject
        ? [{ name: 'Clave obra', displayValue: subject, value: subject }]
        : []),
      { name: 'Category', displayValue: 'Floors', value: 'Floors' },
      { name: 'Level', displayValue: 'Nivel 3', value: 'Nivel 3' },
    ],
  },
});

const thickness = (before: number, after: number, unit = 'Meters') => ({
  type: 'MODIFICATION' as const,
  oldItem: {
    name: 'Thickness',
    value: before,
    definition: { units: { name: unit } },
  },
  item: {
    name: 'Thickness',
    value: after,
    definition: { units: { name: unit } },
  },
});

const losaN3: AecElementDifference = {
  type: 'MODIFICATION',
  element: slab('losa-n3'),
  differences: {
    results: [
      thickness(0.15, 0.2),
      {
        type: 'MODIFICATION',
        oldItem: { name: 'Type Name', value: 'Losa H30 15 cm' },
        item: { name: 'Type Name', value: 'Losa H30 20 cm' },
      },
    ],
  },
};

describe('toElementChanges', () => {
  it('lee el elemento, su clave, su categoría, su nivel y lo que cambió', () => {
    const [change] = toElementChanges([losaN3]);
    expect(change).toEqual({
      type: 'modified',
      elementId: 'el-312456',
      uniqueId: '8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-312456',
      revitId: 312456,
      name: 'Losa H30 20 cm',
      category: 'Floors',
      level: 'Nivel 3',
      subjectId: 'losa-n3',
      properties: [
        { name: 'Thickness', before: 0.15, after: 0.2, unit: 'Meters' },
        {
          name: 'Type Name',
          before: 'Losa H30 15 cm',
          after: 'Losa H30 20 cm',
          unit: null,
        },
      ],
    });
  });

  it('descarta las propiedades que no cambiaron de valor', () => {
    const [change] = toElementChanges([
      {
        type: 'MODIFICATION',
        element: slab('losa-n3'),
        differences: { results: [thickness(0.2, 0.2)] },
      },
    ]);
    expect(change?.properties).toEqual([]);
  });
});

describe('toMinuteChanges', () => {
  it('la losa N3 de 15 a 20 cm sale igual que la minuta del add-in', () => {
    const draft = toMinuteChanges(toElementChanges([losaN3]));
    expect(draft.ignored).toEqual([]);
    expect(draft.changes).toEqual([
      {
        subjectId: 'losa-n3',
        attribute: 'espesor_cm',
        before: 15,
        after: 20,
        unit: 'cm',
        elements: [
          {
            id: 312456,
            uniqueId: '8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-312456',
            category: 'Floors',
            name: 'Losa H30 20 cm',
            level: 'Nivel 3',
          },
        ],
      },
    ]);
  });

  it.each([
    ['Feet', 0.5, 0.65616797, 15.2, 20],
    ['Millimeters', 150, 200, 15, 20],
    ['Centimeters', 15, 20, 15, 20],
  ])(
    'convierte %s y redondea a un decimal',
    (unit, before, after, cmBefore, cmAfter) => {
      const draft = toMinuteChanges(
        toElementChanges([
          {
            type: 'MODIFICATION',
            element: slab('losa-n3'),
            differences: { results: [thickness(before, after, unit)] },
          },
        ]),
      );
      expect(draft.changes[0]).toMatchObject({
        before: cmBefore,
        after: cmAfter,
      });
    },
  );

  it('lee la unidad del texto cuando no viene el número', () => {
    const draft = toMinuteChanges(
      toElementChanges([
        {
          type: 'MODIFICATION',
          element: slab('losa-n3'),
          differences: {
            results: [
              {
                type: 'MODIFICATION',
                oldItem: { name: 'Grosor', displayValue: '150 mm' },
                item: { name: 'Grosor', displayValue: '200 mm' },
              },
            ],
          },
        },
      ]),
    );
    expect(draft.changes[0]).toMatchObject({
      attribute: 'espesor_cm',
      before: 15,
      after: 20,
    });
  });

  it('la distancia al eje va en metros con dos decimales', () => {
    const draft = toMinuteChanges(
      toElementChanges([
        {
          type: 'MODIFICATION',
          element: slab('shaft-s1', '500001'),
          differences: {
            results: [
              {
                type: 'MODIFICATION',
                oldItem: {
                  name: 'Distancia eje A',
                  value: 6,
                  definition: { units: { name: 'Meters' } },
                },
                item: {
                  name: 'Distancia eje A',
                  value: 8.5,
                  definition: { units: { name: 'Meters' } },
                },
              },
            ],
          },
        },
      ]),
    );
    expect(draft.changes[0]).toMatchObject({
      subjectId: 'shaft-s1',
      attribute: 'posicion_m',
      before: 6,
      after: 8.5,
      unit: 'm',
    });
  });

  it('un elemento agregado no tiene valor anterior y uno quitado no tiene valor nuevo', () => {
    const draft = toMinuteChanges(
      toElementChanges([
        {
          type: 'ADDITION',
          element: slab('losa-n4', '1'),
          differences: { results: [thickness(0, 0.15)] },
        },
        {
          type: 'REMOVAL',
          element: slab('losa-n5', '2'),
          differences: { results: [thickness(0.15, 0)] },
        },
      ]),
    );
    expect(
      draft.changes.map(({ subjectId, before, after }) => ({
        subjectId,
        before,
        after,
      })),
    ).toEqual([
      { subjectId: 'losa-n4', before: null, after: 15 },
      { subjectId: 'losa-n5', before: 15, after: null },
    ]);
  });

  it('si los elementos de una clave no coinciden, vale el valor que más se repite', () => {
    const windows = ['1', '2', '3'].map((id, index) => ({
      type: 'MODIFICATION' as const,
      element: slab('ventanas-norte', id),
      differences: {
        results: [
          {
            type: 'MODIFICATION' as const,
            oldItem: {
              name: 'Width',
              value: 1.2,
              definition: { units: { name: 'Meters' } },
            },
            item: {
              name: 'Width',
              value: index === 2 ? 1.4 : 1.5,
              definition: { units: { name: 'Meters' } },
            },
          },
        ],
      },
    }));
    const draft = toMinuteChanges(toElementChanges(windows));
    expect(draft.changes).toHaveLength(1);
    expect(draft.changes[0]).toMatchObject({
      attribute: 'ancho_cm',
      before: 120,
      after: 150,
    });
    expect(draft.changes[0]?.elements).toHaveLength(3);
  });

  it('deja afuera, con su motivo, lo que no puede entrar a la minuta', () => {
    const draft = toMinuteChanges(
      toElementChanges([
        {
          type: 'MODIFICATION',
          element: slab(null, '10'),
          differences: { results: [thickness(0.15, 0.2)] },
        },
        {
          type: 'MODIFICATION',
          element: slab('losa-n3', '11'),
          differences: {
            results: [
              {
                type: 'MODIFICATION',
                oldItem: { name: 'Comments', value: 'a' },
                item: { name: 'Comments', value: 'b' },
              },
            ],
          },
        },
        {
          type: 'MODIFICATION',
          element: slab('losa-n3', '12'),
          differences: { results: [thickness(1, 2, 'Furlongs')] },
        },
        {
          type: 'MODIFICATION',
          element: { ...slab('losa-n3', '13'), alternativeIdentifiers: null },
          differences: { results: [thickness(0.15, 0.2)] },
        },
      ]),
    );
    expect(draft.changes).toEqual([]);
    expect(draft.ignored.map((item) => item.reason)).toEqual([
      'sin_clave',
      'sin_atributo_seguido',
      'unidad_desconocida',
      'sin_identificador_revit',
    ]);
  });

  it('suma la cantidad cuando cambia el número de elementos de una clave', () => {
    const before = countBySubject([
      slab('ventanas-norte', '1'),
      slab('ventanas-norte', '2'),
      slab(null, '3'),
    ]);
    const after = countBySubject([slab('ventanas-norte', '1')]);
    expect(before).toEqual({ 'ventanas-norte': 2 });
    const draft = toMinuteChanges([], { before, after });
    expect(draft.changes).toEqual([
      {
        subjectId: 'ventanas-norte',
        attribute: 'cantidad',
        before: 2,
        after: 1,
        unit: null,
        elements: [],
      },
    ]);
  });
});

describe('minuteIdFor', () => {
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('es un UUID en minúsculas y el mismo para el mismo modelo y versiones', () => {
    const id = minuteIdFor('modelo-1', 7, 8);
    expect(id).toMatch(UUID);
    expect(minuteIdFor('modelo-1', 7, 8)).toBe(id);
  });

  it('cambia con el modelo o las versiones', () => {
    const ids = new Set([
      minuteIdFor('modelo-1', 7, 8),
      minuteIdFor('modelo-1', 8, 9),
      minuteIdFor('modelo-2', 7, 8),
    ]);
    expect(ids.size).toBe(3);
  });
});
