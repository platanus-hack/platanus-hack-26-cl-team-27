import {
  describeExtraction,
  describeLoad,
  describeProposal,
  quantity,
  money,
  signedDays,
  signedMoney,
} from '../src/cli/format.ts';
import type { IngestResponse } from '../src/load/api.ts';

const empty: IngestResponse = {
  revisionId: 'r',
  claims: [],
  proposals: [],
  discrepancies: [],
  backed: [],
  stale: [],
};

describe('formato', () => {
  it('formatea pesos y días como en Chile', () => {
    expect(money(3636500)).toBe('3.636.500');
    expect(money(999)).toBe('999');
    expect(signedMoney(3636500)).toBe('+$3.636.500');
    expect(signedMoney(-1000)).toBe('-$1.000');
    expect(signedDays(1)).toBe('+1 día');
    expect(signedDays(2)).toBe('+2 días');
  });

  it('describe la propuesta de la losa', () => {
    expect(
      describeProposal({
        id: 'p',
        title: 'Losa nivel 3 · Espesor: 15 cm → 20 cm',
        costDelta: 3636500,
        delayDays: 1,
        reviewers: ['a', 'b', 'c', 'd'],
        filtered: [{ stakeholderId: 'marcos-fuentes', reason: 'holgura' }],
      }),
    ).toBe(
      'Propuesta: Losa nivel 3 · Espesor: 15 cm → 20 cm · 4 de 7 avisados · +$3.636.500 · +1 día',
    );
  });

  it('omite costo y atraso cuando son cero', () => {
    expect(
      describeProposal({
        id: 'p',
        title: 'Shaft',
        costDelta: 0,
        delayDays: 0,
        reviewers: ['a', 'b', 'c'],
        filtered: [],
      }),
    ).toBe('Propuesta: Shaft · 3 de 7 avisados');
  });

  it('describe una discrepancia y un respaldo, con unidades de Chile', () => {
    const lines = describeLoad({
      ...empty,
      claims: [
        {
          subjectId: 'ventanas-norte',
          attribute: 'ancho_cm',
          value: 150,
          outcome: 'discrepancy',
        },
      ],
      discrepancies: [{ id: 'd', ownerId: 'fernanda-lagos' }],
      backed: ['d0'],
      stale: [
        { revisionId: 'r', subjectId: 'losa-n3', attribute: 'espesor_cm' },
      ],
    });
    expect(lines).toEqual([
      'Discrepancia para Fernanda Lagos: ventanas del norte, ancho 150 cm',
      'Respaldo: este documento respalda 1 discrepancia.',
    ]);
  });

  it('escribe los decimales con coma', () => {
    expect(quantity(8.5, 'posicion_m')).toBe('8,5 m');
    expect(quantity(24, 'cantidad')).toBe('24');
  });

  it('dice cuando no cambia nada', () => {
    expect(describeLoad(empty)).toEqual([
      'Sin cambios: todo coincide con lo vigente.',
    ]);
  });

  it('cuenta los hechos extraídos', () => {
    expect(
      describeExtraction('drive-proyecto/E-102_revC.json', {
        documentId: 'e102',
        label: 'rev C',
        spaceId: 'drive-proyecto',
        authorId: 'fernanda-lagos',
        pointer: 'p',
        contentHash: 'h',
        claims: new Array(5).fill(null),
      }),
    ).toBe('Extraje drive-proyecto/E-102_revC.json: e102 rev C, 5 hechos.');
  });
});
