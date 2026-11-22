import type { AutodeskChange } from '../../src/domain/autodesk/AutodeskChange.ts';
import { AutodeskEventError } from '../../src/domain/autodesk/AutodeskChange.ts';
import { ReceiveAutodeskEvent } from '../../src/application/use-cases/ReceiveAutodeskEvent.ts';
import { InMemoryAutodeskEventRepository } from '../../src/infra/adapters/InMemoryAutodeskEventRepository.ts';

const LINEAGE = 'urn:adsk.wipprod:dm.lineage:hC6k4hndRWaeIVhIjvHu8w';

const versionAdded = (version: number) => ({
  version: '1.0',
  resourceUrn: LINEAGE,
  hook: {
    hookId: 'hook-1',
    system: 'data',
    event: 'dm.version.added',
  },
  payload: {
    ext: 'rvt',
    name: 'Muro.rvt',
    lineageUrn: LINEAGE,
    source: `urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=${version}`,
    version: String(version),
    modifiedTime: '2026-11-21T20:15:03+0000',
    parentFolderUrn: 'urn:adsk.wipprod:fs.folder:co.folder',
    project: 'b.project-1',
    user_info: { id: 'AUTODESK-USER-1' },
  },
});

const RECEIVED = new Date('2026-11-21T20:15:05Z');

const setup = () => {
  const events = new InMemoryAutodeskEventRepository();
  const heard: AutodeskChange[] = [];
  const listener = {
    changed: async (change: AutodeskChange) => {
      heard.push(change);
    },
  };
  const receive = new ReceiveAutodeskEvent(events, listener, () => RECEIVED);
  return { events, heard, receive };
};

describe('ReceiveAutodeskEvent', () => {
  it('guarda un aviso nuevo y se lo pasa al listener', async () => {
    const { events, heard, receive } = setup();

    const outcome = await receive.execute(versionAdded(3));

    expect(outcome.kind).toBe('recorded');
    expect(outcome.change).toMatchObject({
      kind: 'version.added',
      needsElementDiff: true,
      resource: { name: 'Muro.rvt', version: 3 },
    });
    expect(heard).toEqual([outcome.change]);
    expect(events.list()).toEqual([
      { change: outcome.change, receivedAt: RECEIVED },
    ]);
  });

  it('un reintento de Autodesk no se avisa dos veces', async () => {
    const { events, heard, receive } = setup();

    await receive.execute(versionAdded(3));
    const again = await receive.execute(versionAdded(3));
    const next = await receive.execute(versionAdded(4));

    expect(again.kind).toBe('duplicate');
    expect(next.kind).toBe('recorded');
    expect(heard.map((change) => change.resource.version)).toEqual([3, 4]);
    expect(events.list()).toHaveLength(2);
  });

  it('otro evento del mismo archivo y versión no es un repetido', async () => {
    const { heard, receive } = setup();
    const modified = {
      ...versionAdded(3),
      hook: { ...versionAdded(3).hook, event: 'dm.version.modified' },
    };

    await receive.execute(versionAdded(3));
    const outcome = await receive.execute(modified);

    expect(outcome.kind).toBe('recorded');
    expect(heard.map((change) => change.kind)).toEqual([
      'version.added',
      'version.modified',
    ]);
  });

  it('si el listener falla, el error sube y el aviso ya quedó guardado', async () => {
    const events = new InMemoryAutodeskEventRepository();
    const failing = {
      changed: () => Promise.reject(new Error('la cola no responde')),
    };
    const receive = new ReceiveAutodeskEvent(events, failing, () => RECEIVED);

    await expect(receive.execute(versionAdded(3))).rejects.toThrow(
      'la cola no responde',
    );
    expect(events.list()).toHaveLength(1);
  });

  it('un cuerpo que no es un webhook lanza AutodeskEventError y no guarda nada', async () => {
    const { events, heard, receive } = setup();

    await expect(receive.execute({ hola: 'mundo' })).rejects.toBeInstanceOf(
      AutodeskEventError,
    );
    await expect(receive.execute('texto')).rejects.toBeInstanceOf(
      AutodeskEventError,
    );
    expect(events.list()).toEqual([]);
    expect(heard).toEqual([]);
  });
});
