import { ValidationError } from '../../src/application/errors.ts';
import type { ChangeRepository } from '../../src/application/ports/ChangeRepository.ts';
import { DetectChanges } from '../../src/application/use-cases/DetectChanges.ts';
import type { ChangeDraft } from '../../src/domain/Change.ts';
import type { ModelElement } from '../../src/domain/ModelElement.ts';

const slab = (thickness: number): ModelElement => ({
  id: 'losa-n3',
  name: 'Losa nivel 3',
  category: 'losa',
  level: 3,
  properties: [
    {
      key: 'espesor_cm',
      label: 'Espesor',
      value: thickness,
      unit: 'cm',
      editable: true,
    },
  ],
});

const setup = () => {
  const changes = {
    saveMany: vi.fn<ChangeRepository['saveMany']>(
      (drafts: readonly ChangeDraft[]) =>
        Promise.resolve(
          drafts.map((draft, index) => ({
            ...draft,
            id: `c${index}`,
            detectedAt: new Date(0),
          })),
        ),
    ),
    listRecent: vi.fn<ChangeRepository['listRecent']>(),
    findById: vi.fn<ChangeRepository['findById']>(),
  };
  return { changes, useCase: new DetectChanges(changes) };
};

describe('DetectChanges', () => {
  it('guarda un cambio por elemento, con la revisión de origen', async () => {
    const { changes, useCase } = setup();

    const result = await useCase.execute({
      sourceId: 'rev-1',
      base: [slab(15)],
      next: [slab(20)],
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'c0',
        sourceId: 'rev-1',
        summary: 'Espesor: 15 cm → 20 cm',
      }),
    ]);
    expect(changes.saveMany).toHaveBeenCalledTimes(1);
  });

  it('si nada cambió, no guarda nada', async () => {
    const { changes, useCase } = setup();

    await expect(
      useCase.execute({
        sourceId: 'rev-1',
        base: [slab(15)],
        next: [slab(15)],
      }),
    ).resolves.toEqual([]);
    expect(changes.saveMany).not.toHaveBeenCalled();
  });

  it('rechaza elementos con id repetido', async () => {
    const { changes, useCase } = setup();

    await expect(
      useCase.execute({
        sourceId: 'rev-1',
        base: [],
        next: [slab(15), slab(20)],
      }),
    ).rejects.toThrow(ValidationError);
    expect(changes.saveMany).not.toHaveBeenCalled();
  });

  it('exige la revisión de origen', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ sourceId: '', base: [], next: [slab(15)] }),
    ).rejects.toThrow(ValidationError);
  });
});
