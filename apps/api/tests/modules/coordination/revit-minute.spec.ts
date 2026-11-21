import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mapMinute,
  minuteLabel,
  type RevitMinute,
  revitMinuteBody,
} from '../../../src/modules/coordination/revit-minute.ts';

const example = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../tool-use-case/revit/contract/minuta.example.json',
    ),
    'utf8',
  ),
) as unknown;

const parsed = (): RevitMinute => revitMinuteBody.parse(example);

const withChanges = (
  changes: Partial<RevitMinute['changes'][number]>[],
  model: Partial<RevitMinute['model']> = {},
): RevitMinute => {
  const base = parsed();
  const template = base.changes[0];
  if (!template) throw new Error('El ejemplo no trae cambios');
  return {
    ...base,
    model: { ...base.model, ...model },
    changes: changes.map((change) => ({ ...template, ...change })),
  };
};

const ignoredOf = (change: Partial<RevitMinute['changes'][number]>) =>
  mapMinute(withChanges([change]), 'fernanda-lagos').ignored;

describe('minuta de Revit', () => {
  it('el ejemplo del contrato cumple el schema', () => {
    expect(revitMinuteBody.safeParse(example).success).toBe(true);
  });

  it('mapea el ejemplo a dos hechos y una revisión del modelo de Revit', () => {
    const { revision, claims, ignored } = mapMinute(parsed(), 'fernanda-lagos');

    expect(ignored).toEqual([]);
    expect(claims).toEqual([
      {
        subject: 'losa-n3',
        attribute: 'espesor_cm',
        value: 20,
        unit: 'cm',
        role: 'afirma',
        locator: 'Revit · Suelos · Losa H30 20 cm (id 312456)',
      },
      {
        subject: 'ventanas-norte',
        attribute: 'ancho_cm',
        value: 150,
        unit: 'cm',
        role: 'afirma',
        locator:
          'Revit · Ventanas · Ventana PVC termopanel 150 x 150 (id 401101) y 1 más',
      },
    ]);
    expect(revision).toMatchObject({
      documentId: 'modelo-revit',
      documentName: 'Modelo Revit de arquitectura',
      kind: 'plano',
      spaceId: 'drive-proyecto',
      label: 'guardado 42',
      authorId: 'fernanda-lagos',
      sourcePointer: 'Revit · LosAromos_ARQ.rvt · guardado 42',
    });
    expect(revision.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el hash depende de los hechos y no del orden de los cambios', () => {
    const minute = parsed();
    const reversed = { ...minute, changes: [...minute.changes].reverse() };
    const other = withChanges([{ after: 21 }]);

    expect(mapMinute(reversed, 'x').revision.contentHash).toBe(
      mapMinute(minute, 'x').revision.contentHash,
    );
    expect(mapMinute(other, 'x').revision.contentHash).not.toBe(
      mapMinute(minute, 'x').revision.contentHash,
    );
  });

  it('el rótulo es «guardado N» al guardar o sincronizar y «minuta» con el id si no', () => {
    const minute = parsed();
    const sync = { ...minute, trigger: 'sync' as const };
    const manual = { ...minute, trigger: 'manual' as const };
    const noNumber = {
      ...minute,
      model: { ...minute.model, saveNumber: null },
    };

    expect(minuteLabel(sync)).toBe('guardado 42');
    expect(minuteLabel(manual)).toBe('minuta 6f1c2b9e');
    expect(minuteLabel(noNumber)).toBe('minuta 6f1c2b9e');
    expect(mapMinute(manual, 'x').revision.sourcePointer).toBe(
      'Revit · LosAromos_ARQ.rvt · minuta 6f1c2b9e',
    );
  });

  it('sin elementos el origen es el modelo', () => {
    const { claims } = mapMinute(withChanges([{ elements: [] }]), 'x');

    expect(claims[0]?.locator).toBe('Revit · LosAromos_ARQ');
  });

  it('un elemento sin categoría ni nombre igual queda ubicado por su id', () => {
    const element = {
      id: 7,
      uniqueId: 'u',
      category: null,
      name: null,
      level: null,
    };
    const { claims } = mapMinute(withChanges([{ elements: [element] }]), 'x');

    expect(claims[0]?.locator).toBe('Revit · Elemento (id 7)');
  });

  it('el origen no pasa de 200 caracteres', () => {
    const element = {
      id: 7,
      uniqueId: 'u',
      category: 'C'.repeat(200),
      name: 'N'.repeat(200),
      level: null,
    };
    const { claims } = mapMinute(withChanges([{ elements: [element] }]), 'x');

    expect(claims[0]?.locator).toHaveLength(200);
  });

  it('ignora lo que el proyecto no sigue, con su motivo', () => {
    expect(ignoredOf({ subjectId: 'proyecto' })).toEqual([
      {
        subjectId: 'proyecto',
        attribute: 'espesor_cm',
        reason: 'El proyecto no sigue ese elemento',
      },
    ]);
    expect(ignoredOf({ subjectId: 'partida-03.02' })[0]?.reason).toBe(
      'El proyecto no sigue ese elemento',
    );
    expect(ignoredOf({ attribute: 'precio_unitario' })[0]?.reason).toBe(
      'El proyecto no sigue ese atributo',
    );
  });

  it('ignora una unidad que no es la del atributo y dice cuál esperaba', () => {
    expect(ignoredOf({ unit: 'm' })[0]?.reason).toBe(
      'Espesor va en «cm» y la minuta trae «m»',
    );
    expect(ignoredOf({ attribute: 'cantidad', unit: 'cm' })[0]?.reason).toBe(
      'Cantidad va en sin unidad y la minuta trae «cm»',
    );
    expect(ignoredOf({ attribute: 'posicion_m', unit: null })[0]?.reason).toBe(
      'Distancia al eje A va en «m» y la minuta trae sin unidad',
    );
  });

  it('ignora un elemento que ya no está en el modelo', () => {
    expect(ignoredOf({ before: 15, after: null })[0]?.reason).toContain(
      'ya no está en el modelo',
    );
  });

  it('ignora valores negativos y cantidades no enteras', () => {
    expect(ignoredOf({ after: -1 })[0]?.reason).toBe(
      'El valor no puede ser negativo',
    );
    expect(
      ignoredOf({ attribute: 'cantidad', unit: null, after: 2.5 })[0]?.reason,
    ).toBe('Cantidad debe ser un número entero no negativo');
  });

  it('acepta el cero y una cantidad entera', () => {
    const { claims } = mapMinute(
      withChanges([
        { after: 0 },
        {
          subjectId: 'ventanas-norte',
          attribute: 'cantidad',
          unit: null,
          after: 24,
        },
      ]),
      'x',
    );

    expect(claims.map((claim) => claim.value)).toEqual([0, 24]);
    expect(claims[1]?.unit).toBeNull();
  });

  it('redondea a los decimales del atributo', () => {
    const { claims } = mapMinute(
      withChanges([
        { after: 20.04 },
        {
          subjectId: 'shaft-s1',
          attribute: 'posicion_m',
          unit: 'm',
          after: 6.0049,
        },
        { subjectId: 'shaft-s1', attribute: 'ancho_cm', after: 80.06 },
      ]),
      'x',
    );

    expect(claims.map((claim) => claim.value)).toEqual([20, 6, 80.1]);
  });

  it('separa lo que entra de lo que no', () => {
    const { claims, ignored } = mapMinute(
      withChanges([{ after: 20 }, { subjectId: 'proyecto' }]),
      'x',
    );

    expect(claims).toHaveLength(1);
    expect(ignored).toHaveLength(1);
  });

  it('rechaza repetir sujeto y atributo en una minuta', () => {
    const minute = parsed();
    const first = minute.changes[0];
    const result = revitMinuteBody.safeParse({
      ...minute,
      changes: [first, first],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('repite un mismo valor');
  });

  it('rechaza lo que rompe el contrato', () => {
    const minute = parsed();
    const invalid = [
      { ...minute, minuteId: minute.minuteId.toUpperCase() },
      { ...minute, trigger: 'auto' },
      { ...minute, createdAt: '21/11/2026' },
      { ...minute, changes: [] },
      { ...minute, model: { ...minute.model, title: '' } },
      { ...minute, model: { ...minute.model, saveNumber: -1 } },
    ];

    for (const body of invalid) {
      expect(revitMinuteBody.safeParse(body).success).toBe(false);
    }
  });

  it('acepta segundos fraccionarios, desfase horario y nulos explícitos', () => {
    const minute = parsed();
    const result = revitMinuteBody.safeParse({
      ...minute,
      createdAt: '2026-11-21T14:32:05.123-03:00',
      model: {
        ...minute.model,
        saveNumber: null,
        versionGuid: null,
        revitVersion: null,
      },
    });

    expect(result.success).toBe(true);
  });
});
