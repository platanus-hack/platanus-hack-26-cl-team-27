import { describe, expect, it } from 'vitest';

import {
  firstName,
  formatCLP,
  formatDays,
  formatSignedCLP,
  formatSignedDays,
  formatValue,
  joinNames,
  plural,
} from './format';

describe('formatCLP', () => {
  it('usa punto como separador de miles y sin decimales', () => {
    expect(formatCLP(3_636_500)).toBe('$3.636.500');
    expect(formatCLP(185_000)).toBe('$185.000');
  });
});

describe('formatSignedCLP', () => {
  it('antepone el signo', () => {
    expect(formatSignedCLP(1_998_000)).toBe('+$1.998.000');
    expect(formatSignedCLP(-500)).toBe('−$500');
    expect(formatSignedCLP(0)).toBe('$0');
  });
});

describe('formatDays', () => {
  it('singulariza un día', () => {
    expect(formatDays(1)).toBe('1 día');
    expect(formatDays(4)).toBe('4 días');
    expect(formatDays(0)).toBe('0 días');
  });

  it('firma el atraso', () => {
    expect(formatSignedDays(1)).toBe('+1 día');
    expect(formatSignedDays(2)).toBe('+2 días');
    expect(formatSignedDays(0)).toBe('Sin atraso');
  });
});

describe('formatValue', () => {
  it('usa coma decimal y añade la unidad', () => {
    expect(formatValue(8.5, 'm')).toBe('8,5 m');
    expect(formatValue(20, 'cm')).toBe('20 cm');
    expect(formatValue('H30', null)).toBe('H30');
  });
});

describe('joinNames', () => {
  it('une con comas y una y final', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Paula'])).toBe('Paula');
    expect(joinNames(['Paula', 'Javier'])).toBe('Paula y Javier');
    expect(joinNames(['Paula', 'Javier', 'Camila'])).toBe(
      'Paula, Javier y Camila',
    );
  });
});

describe('textos', () => {
  it('toma el primer nombre y pluraliza', () => {
    expect(firstName('Paula Rojas')).toBe('Paula');
    expect(plural(1, 'documento', 'documentos')).toBe('1 documento');
    expect(plural(9, 'documento', 'documentos')).toBe('9 documentos');
  });
});
