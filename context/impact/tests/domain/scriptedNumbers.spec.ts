import {
  analyzeChange,
  type ChangeUnderAnalysis,
} from '../../src/domain/analyzeChange.ts';
import { GRAPH } from '../graph.ts';

const slab = (to: number): ChangeUnderAnalysis => ({
  id: 'c1',
  elementId: 'losa-n3',
  elementName: 'Losa nivel 3',
  category: 'losa',
  changedKeys: ['espesor_cm'],
  before: { espesor_cm: 15, area_m2: 280 },
  after: { espesor_cm: to, area_m2: 280 },
});

const windows = (to: number): ChangeUnderAnalysis => ({
  id: 'c2',
  elementId: 'ventanas-norte',
  elementName: 'Ventanas fachada norte',
  category: 'ventana',
  changedKeys: ['ancho_cm'],
  before: { cantidad: 24, ancho_cm: 120, alto_cm: 150 },
  after: { cantidad: 24, ancho_cm: to, alto_cm: 150 },
});

describe('las cifras del guion', () => {
  it('losa de 15 a 20 cm: +$3.636.500 y +1 día', () => {
    const impact = analyzeChange(slab(20), GRAPH);

    expect(impact.costDelta).toBe(3_636_500);
    expect(impact.delayDays).toBe(1);
  });

  it('ventanas de 120 a 150 cm: +$1.998.000 y la entrega no se mueve', () => {
    const impact = analyzeChange(windows(150), GRAPH);

    expect(impact.costDelta).toBe(1_998_000);
    expect(impact.delayDays).toBe(0);
  });

  it('el mismo cambio dos veces da las mismas cifras', () => {
    expect(analyzeChange(slab(20), GRAPH)).toEqual(
      analyzeChange(slab(20), GRAPH),
    );
  });
});
