import {
  decodeBox,
  encodeBox,
  makeBox,
  roundBox,
  translate,
} from '../../src/domain/spatial/index.ts';

describe('boxText', () => {
  it('codifica la caja con el formato canónico', () => {
    expect(encodeBox(makeBox([29.8, 5.7, 0], [30.2, 6.3, 2.55]))).toBe(
      'x 29.8..30.2 · y 5.7..6.3 · z 0..2.55',
    );
  });

  it('decodifica lo que codifica, también con negativos', () => {
    const box = makeBox([-1.5, 2, -0.25], [3, 4.125, 0]);
    expect(decodeBox(encodeBox(box))).toEqual(box);
  });

  it('recorta a 4 decimales', () => {
    const box = makeBox([0.123456, 0, 0], [1.000049, 1, 1]);
    expect(encodeBox(box)).toBe('x 0.1235..1 · y 0..1 · z 0..1');
    expect(roundBox(box).min[0]).toBe(0.1235);
  });

  it('devuelve null si el texto no es una caja', () => {
    expect(decodeBox('hola')).toBeNull();
    expect(decodeBox('x 1..2 · y a..b · z 0..1')).toBeNull();
  });

  it('roundBox de un traslado es lo que vuelve del texto', () => {
    const moved = translate(makeBox([29.8, 5.7, 0], [30.2, 6.3, 2.55]), {
      dx: 0,
      dy: 0.4,
      dz: 0,
    });
    expect(decodeBox(encodeBox(moved))).toEqual(roundBox(moved));
  });
});
