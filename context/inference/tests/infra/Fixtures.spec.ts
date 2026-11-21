import {
  FixtureAffectedEstimator,
  FixtureClaimReader,
} from '../../src/infra/adapters/Fixtures.ts';
import { slabChange, vocabulary } from '../support.ts';

describe('FixtureAffectedEstimator', () => {
  it('devuelve las estimaciones del guion para el sujeto y el atributo del cambio', async () => {
    const estimate = {
      stakeholderId: 'camila',
      probability: 0.72,
      reason: 'Ductos embutidos en la losa',
      evidence: 'E-102 rev C',
      question: '¿Tus canalizaciones van embutidas en la losa N3?',
    };
    const estimator = new FixtureAffectedEstimator([
      { subjectId: 'losa-n3', attribute: 'espesor_cm', estimates: [estimate] },
      { subjectId: 'ventanas-norte', attribute: 'ancho_cm', estimates: [] },
    ]);

    const query = {
      change: slabChange,
      vocabulary,
      candidates: vocabulary.stakeholders,
      evidence: [],
    };

    expect(await estimator.estimate(query)).toEqual([estimate]);
    expect(
      await estimator.estimate({
        ...query,
        change: { ...slabChange, subjectId: 'shaft-s1' },
      }),
    ).toEqual([]);
  });
});

describe('FixtureClaimReader', () => {
  it('devuelve las afirmaciones del documento por su título', async () => {
    const claim = {
      subject: 'ventanas-norte',
      attribute: 'ancho_cm',
      value: 150,
      unit: 'cm',
      role: 'afirma' as const,
      locator: '«quedaron en 150»',
      confidence: 0.65,
    };
    const reader = new FixtureClaimReader([
      { title: 'WhatsApp 14:02', claims: [claim] },
    ]);
    const evidence = {
      kind: 'text' as const,
      source: 'mensaje' as const,
      title: 'WhatsApp 14:02',
      text: 'Las ventanas del norte quedaron en 150',
    };

    expect(await reader.read({ evidence, vocabulary })).toEqual([claim]);
    expect(
      await reader.read({
        evidence: { ...evidence, title: 'otro' },
        vocabulary,
      }),
    ).toEqual([]);
  });
});
