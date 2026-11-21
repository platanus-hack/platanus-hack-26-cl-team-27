import type { ImpactRepository } from '../../src/application/ports/ImpactRepository.ts';
import { AnalyzeChange } from '../../src/application/use-cases/AnalyzeChange.ts';
import { GetImpacts } from '../../src/application/use-cases/GetImpacts.ts';
import { GRAPH } from '../graph.ts';

const repository = () => ({
  save: vi.fn<ImpactRepository['save']>().mockResolvedValue(),
  findByChangeIds: vi
    .fn<ImpactRepository['findByChangeIds']>()
    .mockResolvedValue([]),
});

describe('AnalyzeChange', () => {
  it('analiza el cambio contra el grafo del proyecto y guarda el impacto', async () => {
    const impacts = repository();
    const graph = { load: vi.fn().mockResolvedValue(GRAPH) };

    const impact = await new AnalyzeChange(graph, impacts).execute({
      id: 'c1',
      elementId: 'losa-n3',
      elementName: 'Losa nivel 3',
      category: 'losa',
      changedKeys: ['espesor_cm'],
      before: { espesor_cm: 15, area_m2: 280 },
      after: { espesor_cm: 20, area_m2: 280 },
    });

    expect(impact.costDelta).toBe(3_636_500);
    expect(impacts.save).toHaveBeenCalledWith(impact);
  });
});

describe('GetImpacts', () => {
  it('sin ids no consulta el repositorio', async () => {
    const impacts = repository();

    await expect(new GetImpacts(impacts).execute([])).resolves.toEqual([]);
    expect(impacts.findByChangeIds).not.toHaveBeenCalled();
  });
});
