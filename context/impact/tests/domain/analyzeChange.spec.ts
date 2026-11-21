import {
  analyzeChange,
  type ChangeUnderAnalysis,
} from '../../src/domain/analyzeChange.ts';
import { GRAPH } from '../graph.ts';

const slabChange = (from: number, to: number): ChangeUnderAnalysis => ({
  id: 'c1',
  elementId: 'losa-n3',
  elementName: 'Losa nivel 3',
  category: 'losa',
  changedKeys: ['espesor_cm'],
  before: { espesor_cm: from, area_m2: 280 },
  after: { espesor_cm: to, area_m2: 280 },
});

const windowChange: ChangeUnderAnalysis = {
  id: 'c2',
  elementId: 'ventanas-norte',
  elementName: 'Ventanas fachada norte',
  category: 'ventana',
  changedKeys: ['ancho_cm'],
  before: { cantidad: 24, ancho_cm: 120, alto_cm: 150 },
  after: { cantidad: 24, ancho_cm: 150, alto_cm: 150 },
};

describe('analyzeChange', () => {
  it('engrosar la losa suma hormigón y acero al presupuesto', () => {
    const impact = analyzeChange(slabChange(15, 20), GRAPH);

    expect(impact.costLines).toEqual([
      expect.objectContaining({
        code: '03.02',
        before: 42,
        after: 56,
        delta: 2_030_000,
      }),
      expect.objectContaining({
        code: '03.03',
        before: 3570,
        after: 4760,
        delta: 1_606_500,
      }),
    ]);
    expect(impact.costDelta).toBe(3_636_500);
  });

  it('si la tarea que se alarga está en la ruta crítica, la entrega se corre', () => {
    const impact = analyzeChange(slabChange(15, 20), GRAPH);

    expect(impact).toMatchObject({
      delayDays: 1,
      projectDaysBefore: 29,
      projectDaysAfter: 30,
    });
    expect(impact.tasks).toEqual([
      {
        id: 'losa',
        name: 'Hormigonado losa nivel 3',
        daysBefore: 3,
        daysAfter: 4,
        floatDays: 0,
        critical: true,
      },
    ]);
  });

  it('avisa a quien depende del elemento, a costos y a obra, y a nadie más', () => {
    const impact = analyzeChange(slabChange(15, 20), GRAPH);

    expect(
      impact.findings.map((finding) => [finding.stakeholderId, finding.topic]),
    ).toEqual([
      ['calculista', 'dependency'],
      ['sanitarias', 'dependency'],
      ['costos', 'cost'],
      ['obra', 'schedule'],
    ]);
    expect(impact.findings[0]).toMatchObject({
      summary: 'Cambia el peso propio de la losa nivel 3',
      details: ['Peso propio: 3,75 → 5 kN/m² (+1,25)'],
      action: 'Revisa vigas bajo la losa nivel 3',
    });
    expect(impact.findings[3]?.summary).toBe('La entrega se corre 1 día');
    expect(impact.filtered).toEqual([]);
  });

  it('si la holgura absorbe el atraso, no le avisa a obra y explica por qué', () => {
    const impact = analyzeChange(windowChange, GRAPH);

    expect(impact.delayDays).toBe(0);
    expect(impact.findings.map((finding) => finding.stakeholderId)).toEqual([
      'proveedor',
      'costos',
    ]);
    expect(impact.filtered).toEqual([
      {
        stakeholderId: 'obra',
        reason:
          'Instalación de ventanas: 4 días → 5 días, con 5 días de holgura: la holgura lo absorbe y la entrega no se mueve.',
      },
    ]);
  });

  it('adelgazar la losa baja el costo y adelanta la entrega', () => {
    const impact = analyzeChange(slabChange(20, 15), GRAPH);

    expect(impact.costDelta).toBe(-3_636_500);
    expect(impact.delayDays).toBe(-1);
    expect(
      impact.findings.find((finding) => finding.topic === 'cost')?.summary,
    ).toBe('El presupuesto baja $3.636.500');
  });

  it('un cambio que nadie vigila no genera avisos', () => {
    const impact = analyzeChange(
      { ...slabChange(15, 15), changedKeys: ['terminacion'] },
      GRAPH,
    );

    expect(impact).toMatchObject({
      costDelta: 0,
      delayDays: 0,
      findings: [],
      filtered: [],
    });
  });
});
