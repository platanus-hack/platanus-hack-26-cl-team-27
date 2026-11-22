import { parseAutodeskWebhook } from '../../src/domain/autodesk/AutodeskChange.ts';
import { InMemoryAutodeskEventRepository } from '../../src/infra/adapters/InMemoryAutodeskEventRepository.ts';

const changeAt = (version: number) =>
  parseAutodeskWebhook({
    hook: { system: 'data', event: 'dm.version.added' },
    payload: {
      name: 'Muro.rvt',
      lineageUrn: 'urn:adsk.wipprod:dm.lineage:muro',
      version: String(version),
    },
  });

describe('InMemoryAutodeskEventRepository', () => {
  it('guarda cada llave una vez, en el orden en que llegó', async () => {
    const events = new InMemoryAutodeskEventRepository();
    const first = new Date('2026-11-21T20:15:05Z');
    const later = new Date('2026-11-21T20:16:00Z');

    expect(await events.recordIfNew(changeAt(3), first)).toBe(true);
    expect(await events.recordIfNew(changeAt(3), later)).toBe(false);
    expect(await events.recordIfNew(changeAt(4), later)).toBe(true);

    expect(
      events
        .list()
        .map(({ change, receivedAt }) => [change.resource.version, receivedAt]),
    ).toEqual([
      [3, first],
      [4, later],
    ]);
  });
});
