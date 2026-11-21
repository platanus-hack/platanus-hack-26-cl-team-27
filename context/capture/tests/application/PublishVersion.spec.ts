import { ValidationError } from '../../src/application/errors.ts';
import type { ChangeRepository } from '../../src/application/ports/ChangeRepository.ts';
import type { SnapshotRepository } from '../../src/application/ports/SnapshotRepository.ts';
import { PublishVersion } from '../../src/application/use-cases/PublishVersion.ts';
import type { ChangeDraft } from '../../src/domain/Change.ts';
import type { ModelElement, Snapshot } from '../../src/domain/ModelElement.ts';

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

const setup = (latest: Snapshot | null) => {
  const snapshots = {
    latest: vi.fn<SnapshotRepository['latest']>().mockResolvedValue(latest),
    save: vi.fn<SnapshotRepository['save']>().mockResolvedValue(),
  };
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
  return {
    snapshots,
    changes,
    useCase: new PublishVersion(snapshots, changes),
  };
};

const snapshot = (version: number, elements: ModelElement[]): Snapshot => ({
  integrationId: 'bim',
  version,
  publishedAt: new Date(0),
  elements,
});

describe('PublishVersion', () => {
  it('la primera versión es la base: se guarda sin cambios', async () => {
    const { snapshots, changes, useCase } = setup(null);

    const result = await useCase.execute({
      integrationId: 'bim',
      elements: [slab(15)],
    });

    expect(result).toEqual({ version: 1, changes: [] });
    expect(snapshots.save).toHaveBeenCalledWith(
      expect.objectContaining({ integrationId: 'bim', version: 1 }),
    );
    expect(changes.saveMany).not.toHaveBeenCalled();
  });

  it('guarda la versión siguiente y los cambios contra la anterior', async () => {
    const { snapshots, useCase } = setup(snapshot(3, [slab(15)]));

    const result = await useCase.execute({
      integrationId: 'bim',
      elements: [slab(20)],
    });

    expect(result.version).toBe(4);
    expect(result.changes).toEqual([
      expect.objectContaining({
        id: 'c0',
        version: 4,
        summary: 'Espesor: 15 cm → 20 cm',
      }),
    ]);
    expect(snapshots.save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
    );
  });

  it('si nada cambió, no crea una versión nueva', async () => {
    const { snapshots, useCase } = setup(snapshot(3, [slab(15)]));

    await expect(
      useCase.execute({ integrationId: 'bim', elements: [slab(15)] }),
    ).resolves.toEqual({ version: 3, changes: [] });
    expect(snapshots.save).not.toHaveBeenCalled();
  });

  it('rechaza elementos con id repetido', async () => {
    const { snapshots, useCase } = setup(null);

    await expect(
      useCase.execute({ integrationId: 'bim', elements: [slab(15), slab(20)] }),
    ).rejects.toThrow(ValidationError);
    expect(snapshots.latest).not.toHaveBeenCalled();
  });
});
