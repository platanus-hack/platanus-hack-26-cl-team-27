import {
  cellNumber,
  columnLetter,
  parseLocaleNumber,
} from '../../src/domain/Sheet.ts';
import {
  sheetsRevisionLabel,
  spreadsheetIdOf,
  spreadsheetUrl,
} from '../../src/domain/Spreadsheet.ts';
import { matchSubject } from '../../src/domain/Vocabulary.ts';
import { VOCABULARY } from '../fixtures.ts';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab';

describe('celdas', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('la columna %i es %s', (index, letter) => {
    expect(columnLetter(index)).toBe(letter);
  });

  it.each([
    ['145.000', 145000],
    ['1.350', 1350],
    ['5,76', 5.76],
    ['$ 2.800.000', 2800000],
    ['43.2', 43.2],
    ['', null],
    ['por definir', null],
  ])('«%s» se lee como %s', (text, value) => {
    expect(parseLocaleNumber(text)).toBe(value);
  });

  it('un número de la API se usa tal cual y un booleano no es número', () => {
    expect(cellNumber(145000)).toBe(145000);
    expect(cellNumber(true)).toBeNull();
    expect(cellNumber(null)).toBeNull();
  });
});

describe('planillas', () => {
  it('saca el id del link o acepta el id solo', () => {
    expect(
      spreadsheetIdOf(
        `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`,
      ),
    ).toBe(ID);
    expect(spreadsheetIdOf(`  ${ID}  `)).toBe(ID);
    expect(
      spreadsheetIdOf('https://docs.google.com/document/d/abc'),
    ).toBeNull();
    expect(spreadsheetIdOf('hola')).toBeNull();
  });

  it('arma el link para personas con la hoja', () => {
    expect(spreadsheetUrl(ID, 42)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=42`,
    );
  });

  it('el rótulo de la revisión va en hora de Chile', () => {
    expect(sheetsRevisionLabel(new Date('2026-11-21T21:05:12Z'))).toBe(
      'Sheets 21-11 18:05:12',
    );
  });
});

describe('matchSubject', () => {
  it.each([
    ['Losa nivel 3', 'losa-n3'],
    ['losa del nivel 2', 'losa-n2'],
    ['Ventanas del norte', 'ventanas-norte'],
    ['Losa de cubierta', 'losa-cubierta'],
  ])('«%s» es %s', (text, id) => {
    expect(matchSubject(VOCABULARY, text)?.id).toBe(id);
  });

  it.each(['Losa nivel 7', 'Losa', 'Muro norte'])(
    '«%s» no es ningún elemento',
    (text) => {
      expect(matchSubject(VOCABULARY, text)).toBeNull();
    },
  );
});
