import { hasAuthority } from '../../src/domain/Authority.ts';

describe('hasAuthority', () => {
  it.each([
    ['plano', 'espesor_cm', true],
    ['eett', 'ancho_cm', true],
    ['cotizacion', 'ancho_cm', false],
    ['cotizacion', 'precio_unitario', true],
    ['presupuesto', 'precio_unitario', true],
    ['plano', 'precio_unitario', false],
    ['carta_gantt', 'entrega_dias', true],
    ['acta', 'entrega_dias', true],
    ['mensaje', 'espesor_cm', false],
    ['libro_obra', 'posicion_m', false],
    ['plano', 'atributo_desconocido', false],
  ] as const)('%s sobre %s: %s', (kind, attribute, expected) => {
    expect(hasAuthority(kind, attribute)).toBe(expected);
  });
});
