import {
  readBudgetSheet,
  SheetFormatError,
} from '../../src/domain/readBudgetSheet.ts';
import type { SheetTab } from '../../src/domain/Sheet.ts';
import { BUDGET_V2, VOCABULARY } from '../fixtures.ts';

const claimsOf = (tab: SheetTab) =>
  readBudgetSheet(tab, VOCABULARY).chunks.flatMap((chunk) => chunk.claims);

const withRow = (row: readonly (string | number)[]): SheetTab => ({
  title: 'Partidas',
  rows: [['Código', 'Precio unitario', 'Unidad'], row],
});

describe('readBudgetSheet', () => {
  it('lee el presupuesto v2 igual que el parser del ETL', () => {
    expect(claimsOf(BUDGET_V2)).toEqual([
      {
        subject: 'partida-03.02',
        attribute: 'precio_unitario',
        value: 145000,
        unit: '$/m³',
        role: 'afirma',
        locator: 'Partidas!C14',
      },
      {
        subject: 'losa-n3',
        attribute: 'espesor_cm',
        value: 15,
        unit: 'cm',
        role: 'usa',
        locator: 'Partidas!F14',
      },
      {
        subject: 'partida-03.03',
        attribute: 'precio_unitario',
        value: 1350,
        unit: '$/kg',
        role: 'afirma',
        locator: 'Partidas!C15',
      },
      {
        subject: 'partida-05.04',
        attribute: 'precio_unitario',
        value: 95000,
        unit: '$/m²',
        role: 'afirma',
        locator: 'Partidas!C16',
      },
      {
        subject: 'partida-07.01',
        attribute: 'precio_unitario',
        value: 185000,
        unit: '$/m²',
        role: 'afirma',
        locator: 'Partidas!C17',
      },
      {
        subject: 'ventanas-norte',
        attribute: 'ancho_cm',
        value: 120,
        unit: 'cm',
        role: 'usa',
        locator: 'Partidas!F17',
      },
    ]);
  });

  it('un fragmento de tipo fila por celda con hechos', () => {
    const { chunks } = readBudgetSheet(BUDGET_V2, VOCABULARY);
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toEqual({
      locator: 'Partidas!C14',
      kind: 'fila',
      claims: [expect.objectContaining({ subject: 'partida-03.02' })],
    });
  });

  it('deja fuera, con su razón, las partidas que la obra no sigue', () => {
    expect(readBudgetSheet(BUDGET_V2, VOCABULARY).ignored).toEqual([
      { locator: 'Partidas!A18', reason: 'La obra no sigue la partida 01.01' },
      { locator: 'Partidas!A20', reason: 'La obra no sigue la partida 02.01' },
    ]);
  });

  it('acepta precios escritos como texto con formato chileno', () => {
    expect(claimsOf(withRow(['03.02', '$150.000', 'm3']))).toEqual([
      expect.objectContaining({ value: 150000, unit: '$/m³' }),
    ]);
  });

  it('usa la unidad de la obra si la celda de unidad está vacía', () => {
    expect(claimsOf(withRow(['03.03', 1400, '']))).toEqual([
      expect.objectContaining({ value: 1400, unit: '$/kg' }),
    ]);
  });

  it('ignora un precio que no es número o una unidad distinta', () => {
    const notNumber = readBudgetSheet(
      withRow(['03.02', 'por definir', 'm³']),
      VOCABULARY,
    );
    expect(notNumber.chunks).toEqual([]);
    expect(notNumber.ignored).toEqual([
      {
        locator: 'Partidas!B2',
        reason: 'El precio de la partida 03.02 no es un número',
      },
    ]);
    expect(
      readBudgetSheet(withRow(['03.02', 150000, 'm²']), VOCABULARY).ignored,
    ).toEqual([
      {
        locator: 'Partidas!C2',
        reason: 'La partida 03.02 va en $/m³, no en $/m²',
      },
    ]);
  });

  it('encuentra el encabezado aunque no parta en la columna A', () => {
    const tab: SheetTab = {
      title: 'Hoja 1',
      rows: [
        ['', 'Item', 'codigo', 'precio unitario', 'UNIDAD'],
        ['', 'Hormigón', '03.02', 150000, 'm³'],
      ],
    };
    expect(claimsOf(tab)).toEqual([
      expect.objectContaining({ value: 150000, locator: 'Hoja 1!D2' }),
    ]);
  });

  it('reconoce la dimensión sin el separador', () => {
    const tab: SheetTab = {
      title: 'Partidas',
      rows: [
        ['Código', 'Precio unitario', 'Unidad', 'Dimensión de diseño usada'],
        ['03.02', 145000, 'm³', 'Losa nivel 3 espesor 20 cm'],
      ],
    };
    expect(claimsOf(tab)[1]).toEqual(
      expect.objectContaining({ subject: 'losa-n3', value: 20, role: 'usa' }),
    );
  });

  it('deja fuera una dimensión que no reconoce', () => {
    const tab: SheetTab = {
      title: 'Partidas',
      rows: [
        ['Código', 'Precio unitario', 'Unidad', 'Dimensión de diseño usada'],
        ['03.02', 145000, 'm³', 'Losa nivel 9 · espesor 15 cm'],
      ],
    };
    const reading = readBudgetSheet(tab, VOCABULARY);
    expect(reading.chunks).toHaveLength(1);
    expect(reading.ignored).toEqual([
      {
        locator: 'Partidas!D2',
        reason:
          'No reconocemos «Losa nivel 9 · espesor 15 cm» como una dimensión de la obra',
      },
    ]);
  });

  it('falla si no encuentra la fila de encabezados', () => {
    expect(() =>
      readBudgetSheet(
        { title: 'Notas', rows: [['Código', 'Descripción']] },
        VOCABULARY,
      ),
    ).toThrow(SheetFormatError);
  });
});
