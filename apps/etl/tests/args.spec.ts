import { parseArgs, UsageError } from '../src/cli/args.ts';

describe('argumentos', () => {
  it('sin comando es interactivo', () => {
    expect(parseArgs([])).toEqual({ name: 'interactivo', speed: 1 });
  });

  it('auto con velocidad', () => {
    expect(parseArgs(['auto', '--velocidad', '4'])).toEqual({
      name: 'auto',
      speed: 4,
    });
    expect(parseArgs(['auto', '--velocidad=2'])).toEqual({
      name: 'auto',
      speed: 2,
    });
  });

  it('paso necesita un id', () => {
    expect(parseArgs(['paso', 's3'])).toEqual({
      name: 'paso',
      id: 's3',
      speed: 1,
    });
    expect(() => parseArgs(['paso'])).toThrow(UsageError);
  });

  it('reiniciar y estado', () => {
    expect(parseArgs(['reiniciar'])).toEqual({ name: 'reiniciar' });
    expect(parseArgs(['estado'])).toEqual({ name: 'estado' });
  });

  it('rechaza lo desconocido', () => {
    expect(() => parseArgs(['auto', '--velocidad', '3'])).toThrow(
      'La velocidad debe ser 1, 2 o 4.',
    );
    expect(() => parseArgs(['volar'])).toThrow(UsageError);
    expect(() => parseArgs(['--rapido'])).toThrow(UsageError);
  });
});
