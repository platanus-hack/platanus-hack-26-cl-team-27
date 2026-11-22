import { parseAutodeskWebhook } from '../../src/domain/autodesk/AutodeskChange.ts';
import { PrismaAutodeskEventRepository } from '../../src/infra/adapters/PrismaAutodeskEventRepository.ts';

const LINEAGE = 'urn:adsk.wipprod:dm.lineage:hC6k4hndRWaeIVhIjvHu8w';

const VERSION_ADDED = {
  version: '1.0',
  resourceUrn: LINEAGE,
  hook: { hookId: 'hook-1', system: 'data', event: 'dm.version.added' },
  payload: {
    ext: 'rvt',
    name: 'Muro.rvt',
    lineageUrn: LINEAGE,
    source: 'urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=3',
    version: '3',
    modifiedTime: '2026-11-21T20:15:03+0000',
    parentFolderUrn: 'urn:adsk.wipprod:fs.folder:co.folder',
    project: 'b.project-1',
    user_info: { id: 'AUTODESK-USER-1' },
  },
};

const RECEIVED = new Date('2026-11-21T20:15:05Z');

describe('PrismaAutodeskEventRepository', () => {
  it('guarda la fila con su llave y dice si era nueva', async () => {
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const repository = new PrismaAutodeskEventRepository({
      autodeskEvent: { createMany },
    } as never);
    const change = parseAutodeskWebhook(VERSION_ADDED);

    expect(await repository.recordIfNew(change, RECEIVED)).toBe(true);
    expect(await repository.recordIfNew(change, RECEIVED)).toBe(false);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          dedupeKey: `hook-1|dm.version.added|${LINEAGE}|v3`,
          event: 'dm.version.added',
          kind: 'version.added',
          source: 'data_management',
          hookId: 'hook-1',
          resourceKind: 'model',
          resourceUrn:
            'urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=3',
          lineageUrn: LINEAGE,
          name: 'Muro.rvt',
          version: 3,
          folderUrn: 'urn:adsk.wipprod:fs.folder:co.folder',
          projectId: 'b.project-1',
          actorId: 'AUTODESK-USER-1',
          occurredAt: new Date('2026-11-21T20:15:03Z'),
          needsElementDiff: true,
          receivedAt: RECEIVED,
        },
      ],
      skipDuplicates: true,
    });
  });
});
