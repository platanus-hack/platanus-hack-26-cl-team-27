import {
  screenClaims,
  type ClaimCandidate,
} from '../../src/domain/ExtractedClaim.ts';
import { vocabulary } from '../support.ts';

const claim = (overrides: Partial<ClaimCandidate> = {}): ClaimCandidate => ({
  subject: 'ventanas-norte',
  attribute: 'ancho_cm',
  value: 150,
  unit: 'cm',
  role: 'afirma',
  locator: 'mensaje 14:02',
  confidence: 0.9,
  ...overrides,
});

describe('screenClaims', () => {
  it('acepta lo que calza con el vocabulario y toma la unidad del proyecto', () => {
    const { accepted, rejected } = screenClaims(
      [claim({ unit: null, locator: '  cajetín rev C ' })],
      vocabulary,
      0.7,
    );

    expect(rejected).toEqual([]);
    expect(accepted).toEqual([claim({ unit: 'cm', locator: 'cajetín rev C' })]);
  });

  it.each([
    [
      claim({ subject: 'muro-m1' }),
      'El sujeto o el atributo no está en el proyecto',
    ],
    [claim({ value: 'ciento cincuenta' }), 'Se esperaba un número en cm'],
    [claim({ unit: 'm' }), 'La unidad es m y el proyecto usa cm'],
    [claim({ locator: ' ' }), 'No dice dónde lo leyó'],
    [claim({ confidence: 0.4 }), 'Confianza 0,40, bajo el mínimo de 0,70'],
  ])('rechaza con su razón: %#', (candidate, reason) => {
    const { accepted, rejected } = screenClaims([candidate], vocabulary, 0.7);

    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ candidate, reason }]);
  });

  it('acepta texto en atributos sin unidad', () => {
    const { accepted } = screenClaims(
      [claim({ attribute: 'material', value: 'PVC termopanel', unit: null })],
      vocabulary,
      0.7,
    );

    expect(accepted).toHaveLength(1);
  });

  it('con dos lecturas del mismo valor y rol, se queda con la más confiable', () => {
    const weak = claim({ value: 140, confidence: 0.75 });
    const strong = claim({ value: 150, confidence: 0.95 });

    const { accepted, rejected } = screenClaims(
      [weak, strong],
      vocabulary,
      0.7,
    );

    expect(accepted).toEqual([strong]);
    expect(rejected).toEqual([
      {
        candidate: weak,
        reason: 'Otra lectura del mismo valor tiene más confianza',
      },
    ]);
  });

  it('afirmar y usar el mismo valor son lecturas distintas', () => {
    const { accepted } = screenClaims(
      [claim(), claim({ role: 'usa', value: 120 })],
      vocabulary,
      0.7,
    );

    expect(accepted).toHaveLength(2);
  });
});
