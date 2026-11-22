import { describe, expect, it } from 'vitest';

import {
  firstName,
  formatCLP,
  formatDays,
  formatSignedCLP,
  formatSignedDays,
  formatChange,
  formatDate,
  formatRelative,
  formatValue,
  joinNames,
  latest,
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

describe('formatChange', () => {
  it('une el antes y el después con flecha', () => {
    expect(formatChange(15, 20, 'cm')).toBe('15 cm → 20 cm');
    expect(formatChange(null, 8.5, 'm')).toBe('Sin dato → 8,5 m');
    expect(formatChange(6, null, 'm')).toBe('6 m → Se elimina');
  });
});

describe('formatRelative', () => {
  const at = '2026-11-21T10:00:00.000Z';
  const base = new Date(at).getTime();

  it('dice recién, minutos u horas', () => {
    expect(formatRelative(at, base + 20_000)).toBe('Recién');
    expect(formatRelative(at, base + 5 * 60_000)).toBe('Hace 5 min');
    expect(formatRelative(at, base + 2 * 3_600_000)).toBe('Hace 2 h');
  });

  it('cae a la hora cuando no conoce el ahora o pasó más de un día', () => {
    expect(formatRelative(at, 0)).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(formatRelative(at, base + 30 * 3_600_000)).toMatch(/\d{2}:\d{2}/);
  });

  it('no inventa con fechas inválidas', () => {
    expect(formatRelative('no-es-fecha', base)).toBe('');
  });
});

describe('latest', () => {
  it('elige la fecha más nueva e ignora los vacíos', () => {
    expect(latest(['2026-11-21T10:00:00Z', null, '2026-11-21T11:00:00Z'])).toBe(
      '2026-11-21T11:00:00Z',
    );
    expect(latest([null, null])).toBeNull();
  });
});

describe('formatDate', () => {
  it('da el día en Santiago, con el mes en palabras', () => {
    expect(formatDate('2026-11-21T02:00:00Z')).toBe('20 de noviembre de 2026');
    expect(formatDate('no es fecha')).toBe('');
  });
});
