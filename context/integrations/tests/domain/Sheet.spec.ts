import { columnLetter, diffSnapshots } from '../../src/domain/Sheet.ts';
import {
  spreadsheetIdOf,
  spreadsheetUrl,
} from '../../src/domain/Spreadsheet.ts';
import { BUDGET } from '../fixtures.ts';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab';

describe('columnLetter', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('la columna %i es %s', (index, letter) => {
    expect(columnLetter(index)).toBe(letter);
  });
});

describe('diffSnapshots', () => {
  it('sin cambios no hay celdas', () => {
    expect(diffSnapshots(BUDGET, BUDGET)).toEqual([]);
  });

  it('dice qué celda cambió, con el antes y el después', () => {
    const after = {
      tabs: [
        {
          title: 'Partidas',
          rows: [
            ['Código', 'Descripción', 'Precio unitario', 'Unidad'],
            ['03.02', 'Hormigón H30 en losas', 150000, 'm³'],
            ['03.03', 'Acero de refuerzo en losas', 1350, 'kg'],
            ['05.04', 'Shaft', 95000, 'm²'],
          ],
        },
        BUDGET.tabs[1] ?? { title: 'Notas', rows: [] },
      ],
    };

    expect(diffSnapshots(BUDGET, after)).toEqual([
      { locator: 'Partidas!C2', before: 145000, after: 150000 },
      { locator: 'Partidas!A4', before: null, after: '05.04' },
      { locator: 'Partidas!B4', before: null, after: 'Shaft' },
      { locator: 'Partidas!C4', before: null, after: 95000 },
      { locator: 'Partidas!D4', before: null, after: 'm²' },
    ]);
  });

  it('una celda vaciada, una hoja nueva y una hoja borrada', () => {
    const after = {
      tabs: [
        {
          title: 'Partidas',
          rows: [
            ['Código', 'Descripción', 'Precio unitario', 'Unidad'],
            ['03.02', 'Hormigón H30 en losas', '', 'm³'],
            ['03.03', 'Acero de refuerzo en losas', 1350, 'kg'],
          ],
        },
        { title: 'Resumen', rows: [['Total']] },
      ],
    };

    expect(diffSnapshots(BUDGET, after)).toEqual([
      { locator: 'Partidas!C2', before: 145000, after: null },
      { locator: 'Resumen!A1', before: null, after: 'Total' },
      { locator: 'Notas!A1', before: 'Revisado por Daniela', after: null },
    ]);
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

  it('arma el link para personas', () => {
    expect(spreadsheetUrl(ID)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/edit`,
    );
  });
});
