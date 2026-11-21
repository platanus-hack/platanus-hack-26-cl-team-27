import { readBudgetSheet } from '@team27/context-integrations';

import { checkRevision } from '../../../src/modules/coordination/revision-body.ts';
import {
  OAuthStates,
  STATE_TTL_MS,
} from '../../../src/modules/integrations/oauth-states.ts';
import { deliverySummary } from '../../../src/modules/integrations/revision-sink.ts';
import {
  buildSourceVocabulary,
  linkableDocuments,
} from '../../../src/modules/integrations/vocabulary.ts';
import { documentOf } from '../../../src/scenario/documents.ts';

const BUDGET = {
  title: 'Partidas',
  rows: [
    [
      'Código',
      'Descripción',
      'Precio unitario',
      'Unidad',
      'Cantidad',
      'Dimensión de diseño usada',
    ],
    [
      '03.02',
      'Hormigón H30 en losas',
      150000,
      'm³',
      210,
      'Losa nivel 3 · espesor 20 cm',
    ],
    ['03.03', 'Acero de refuerzo en losas', 1350, 'kg', 17850, ''],
    ['05.04', 'Perforaciones y sellos del shaft', 95000, 'm²', 5.76, ''],
    [
      '07.01',
      'Ventanas de PVC termopanel',
      185000,
      'm²',
      43.2,
      'Ventanas fachada norte · ancho 120 cm',
    ],
    ['01.01', 'Instalación de faenas', 2800000, 'gl', 1, ''],
  ],
};

describe('vocabulario de la obra para los conectores', () => {
  it('lo que lee la planilla pasa la validación de la ingesta', () => {
    const reading = readBudgetSheet(BUDGET, buildSourceVocabulary());
    const chunks = reading.chunks.map((chunk) => ({
      locator: chunk.locator,
      kind: chunk.kind,
      claims: chunk.claims.map((claim) => ({ ...claim })),
    }));

    expect(chunks).toHaveLength(6);
    expect(reading.ignored).toEqual([
      { locator: 'Partidas!A6', reason: 'La obra no sigue la partida 01.01' },
    ]);
    expect(() =>
      checkRevision(
        { spaceId: 'carpeta-costos', chunks },
        documentOf('presupuesto'),
      ),
    ).not.toThrow();
  });

  it('por ahora solo se vincula el presupuesto', () => {
    expect(linkableDocuments().map((document) => document.id)).toEqual([
      'presupuesto',
    ]);
  });
});

describe('OAuthStates', () => {
  it('un estado sirve una vez y vence', () => {
    let now = 0;
    const states = new OAuthStates(() => now);
    const first = states.issue();
    const second = states.issue();

    expect(states.consume(first)).toBe(true);
    expect(states.consume(first)).toBe(false);
    expect(states.consume(undefined)).toBe(false);
    now = STATE_TTL_MS + 1;
    expect(states.consume(second)).toBe(false);
  });
});

describe('deliverySummary', () => {
  const response = (overrides: object) =>
    ({
      proposals: [],
      discrepancies: [],
      ...overrides,
    }) as unknown as Parameters<typeof deliverySummary>[0];

  it('cuenta propuestas y personas avisadas', () => {
    expect(
      deliverySummary(
        response({
          proposals: [{ reviewers: ['paula-rojas', 'marcos-fuentes'] }],
        }),
      ),
    ).toBe('Llegó la revisión: abrimos 1 propuesta y avisamos a 2 personas.');
  });

  it('dice cuando la obra ya tenía esos valores', () => {
    expect(deliverySummary(response({}))).toBe(
      'Llegó la revisión: la obra ya tenía esos valores.',
    );
  });
});
