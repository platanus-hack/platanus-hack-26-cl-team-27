import {
  areaLabel,
  footprintModel,
  spanOf,
  spatialKindOf,
} from '../../src/scenario/areas.ts';

describe('grilla', () => {
  it.each([
    [0, 'A-B'],
    [3.99, 'A-B'],
    [4, 'B-C'],
    [6, 'B-C'],
    [8, 'C-D'],
    [8.5, 'C-D'],
    [10, 'C-D'],
    [12, 'D-E'],
    [13.5, 'D-E'],
    [16, 'D-E'],
  ])('%s m cae en el tramo %s', (meters, span) => {
    expect(spanOf(meters)).toBe(span);
  });

  it.each([-0.1, 16.1, Number.NaN, '8', null, undefined])(
    '%s no cae en ningún tramo',
    (meters) => {
      expect(spanOf(meters)).toBeNull();
    },
  );
});

describe('huellas', () => {
  it('el shaft ocupa todos los niveles, la celda de su posición en el eje 3, sanitarias y eléctricas', () => {
    const at6 = footprintModel('shaft-s1', { posicion_m: 6 });
    expect(at6.kind).toBe('ocupante');
    expect(at6.areas.map((area) => area.nivel)).toEqual([
      'n1',
      'n2',
      'n3',
      'n4',
      'n5',
      'n6',
    ]);
    expect(new Set(at6.areas.map((area) => area.celda))).toEqual(
      new Set(['B-C/3']),
    );
    expect(at6.areas[0]?.sistemas).toEqual(['sanitarias', 'electricas']);
    expect(
      new Set(
        footprintModel('shaft-s1', { posicion_m: 8.5 }).areas.map(
          (area) => area.celda,
        ),
      ),
    ).toEqual(new Set(['C-D/3']));
  });

  it('el shaft sin posición válida no ocupa nada', () => {
    expect(footprintModel('shaft-s1', {}).areas).toEqual([]);
    expect(footprintModel('shaft-s1', { posicion_m: 40 }).areas).toEqual([]);
  });

  it('el colector ocupa solo el nivel 3, en sanitarias', () => {
    expect(footprintModel('colector-b2', { posicion_m: 10 })).toEqual({
      kind: 'ocupante',
      areas: [{ nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] }],
    });
    expect(
      footprintModel('colector-b2', { posicion_m: 13.5 }).areas[0]?.celda,
    ).toBe('D-E/3');
  });

  it('las ventanas ocupan la fachada norte de los niveles 1 a 5, sin depender de sus valores', () => {
    const windows = footprintModel('ventanas-norte', { ancho_cm: 150 });
    expect(windows.kind).toBe('ocupante');
    expect(windows.areas).toHaveLength(5 * 4);
    expect(new Set(windows.areas.map((area) => area.celda.split('/')[1]))).toEqual(
      new Set(['1']),
    );
    expect(windows.areas.every((area) => area.sistemas[0] === 'arquitectura')).toBe(true);
  });

  it('las losas son soporte: su nivel y todas las celdas, estructura', () => {
    const slab = footprintModel('losa-n3', { espesor_cm: 20 });
    expect(slab.kind).toBe('soporte');
    expect(slab.areas).toHaveLength(16);
    expect(slab.areas.every((area) => area.nivel === 'n3')).toBe(true);
    expect(footprintModel('losa-cubierta', {}).areas[0]?.nivel).toBe('n6');
  });

  it.each(['partida-03.02', 'proyecto', 'inexistente'])(
    '%s no es espacial',
    (subject) => {
      expect(spatialKindOf(subject)).toBe('ninguno');
      expect(footprintModel(subject, {})).toEqual({ kind: 'ninguno', areas: [] });
    },
  );

  it('rotula un área como «nivel 3 · C-D/3 · sanitarias»', () => {
    expect(
      areaLabel({ nivel: 'n3', celda: 'C-D/3', sistemas: ['sanitarias'] }),
    ).toBe('nivel 3 · C-D/3 · sanitarias');
    expect(
      areaLabel({
        nivel: 'n6',
        celda: 'A-B/1',
        sistemas: ['sanitarias', 'electricas'],
      }),
    ).toBe('cubierta · A-B/1 · sanitarias y eléctricas');
  });
});
