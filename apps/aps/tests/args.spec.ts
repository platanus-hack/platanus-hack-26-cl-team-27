import { parseArgs, UsageError } from '../src/args.ts';

describe('parseArgs', () => {
  it('reconoce check y models con sus opciones', () => {
    expect(parseArgs(['check'])).toEqual({ name: 'check' });
    expect(parseArgs(['models'])).toEqual({
      name: 'models',
      force: false,
      folder: null,
    });
    expect(parseArgs(['models', '--force', '--carpeta', 'models'])).toEqual({
      name: 'models',
      force: true,
      folder: 'models',
    });
  });

  it('rechaza lo que no entiende', () => {
    for (const argv of [
      [],
      ['subir'],
      ['models', 'extra'],
      ['check', '--force'],
      ['models', '--fuerza'],
    ]) {
      expect(() => parseArgs(argv)).toThrow(UsageError);
    }
  });
});
