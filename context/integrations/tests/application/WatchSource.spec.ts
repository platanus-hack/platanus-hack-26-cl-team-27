import { ProviderError } from '../../src/application/errors.ts';
import { ORPHAN_SOURCE } from '../../src/application/use-cases/requireGoogle.ts';
import {
  UNCHANGED_MESSAGE,
  WatchSource,
} from '../../src/application/use-cases/WatchSource.ts';
import { DRIVE_METADATA_SCOPE } from '../../src/domain/Push.ts';
import {
  authorizer,
  CONNECTION,
  CONTENT,
  connections,
  listener,
  reader,
  snapshots,
  SOURCE,
  sources,
  watcher,
} from './fakes.ts';

const NOW = new Date('2026-11-21T21:05:12Z');

const CHANGED = {
  ...CONTENT,
  contentHash: 'b'.repeat(64),
  tabs: [
    {
      title: 'Partidas',
      rows: [
        ['Código', 'Descripción', 'Precio unitario', 'Unidad'],
        ['03.02', 'Hormigón H30 en losas', 150000, 'm³'],
        ['03.03', 'Acero de refuerzo en losas', 1350, 'kg'],
      ],
    },
    ...CONTENT.tabs.slice(1),
  ],
};

const setup = (options: { connected?: boolean } = {}) => {
  const deps = {
    connections: connections(options.connected === false ? null : undefined),
    authorizer: authorizer(),
    reader: reader(),
    sources: sources(),
    snapshots: snapshots(),
    listener: listener(),
  };
  const useCase = new WatchSource(
    deps.connections,
    deps.authorizer,
    deps.reader,
    deps.sources,
    deps.snapshots,
    deps.listener,
    () => NOW,
  );
  return { ...deps, useCase };
};

describe('WatchSource', () => {
  it('si el hash es el mismo, solo anota la revisión y no avisa', async () => {
    const {
      useCase,
      sources: links,
      listener: heard,
      reader: sheets,
    } = setup();

    const result = await useCase.execute('s1');

    expect(sheets.read).toHaveBeenCalledWith('access-1', SOURCE.externalId);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'unchanged',
        message: UNCHANGED_MESSAGE,
        cells: 0,
      }),
    );
    expect(links.recordCheck).toHaveBeenCalledWith('s1', {
      at: NOW,
      title: CONTENT.title,
      contentHash: CONTENT.contentHash,
      changed: false,
      by: null,
    });
    expect(heard.changed).not.toHaveBeenCalled();
  });

  it('avisa qué celdas cambiaron respecto de la revisión anterior', async () => {
    const {
      useCase,
      sources: links,
      listener: heard,
      reader: sheets,
    } = setup();
    await useCase.execute('s1');
    sheets.read.mockResolvedValue(CHANGED);

    const result = await useCase.execute('s1');

    expect(result).toEqual(
      expect.objectContaining({
        status: 'changed',
        message: 'La planilla cambió: 1 celda',
        cells: 1,
      }),
    );
    expect(links.recordCheck).toHaveBeenLastCalledWith('s1', {
      at: NOW,
      title: CONTENT.title,
      contentHash: CHANGED.contentHash,
      changed: true,
      by: null,
    });
    expect(heard.changed).toHaveBeenCalledWith({
      source: expect.objectContaining({ id: 's1', changedAt: NOW }),
      at: NOW,
      cells: [{ locator: 'Partidas!C2', before: 145000, after: 150000 }],
      by: null,
    });
  });

  it('con permiso de Drive, dice quién hizo el cambio', async () => {
    const drive = watcher();
    const deps = {
      connections: connections({
        ...CONNECTION,
        scopes: [DRIVE_METADATA_SCOPE],
      }),
      reader: reader(),
      sources: sources(),
      listener: listener(),
    };
    const useCase = new WatchSource(
      deps.connections,
      authorizer(),
      deps.reader,
      deps.sources,
      snapshots(),
      deps.listener,
      () => NOW,
      drive,
    );
    await useCase.execute('s1');
    expect(drive.lastEditor).not.toHaveBeenCalled();
    deps.reader.read.mockResolvedValue(CHANGED);

    await useCase.execute('s1');

    expect(drive.lastEditor).toHaveBeenCalledWith(
      'access-1',
      SOURCE.externalId,
    );
    expect(deps.listener.changed).toHaveBeenCalledWith(
      expect.objectContaining({
        by: { name: 'Daniela Soto', email: 'daniela@example.com' },
      }),
    );
  });

  it('si Google no dice quién editó, igual avisa el cambio', async () => {
    const drive = watcher();
    drive.lastEditor.mockRejectedValue(new ProviderError('boom', 500));
    const deps = {
      reader: reader(),
      listener: listener(),
    };
    const useCase = new WatchSource(
      connections({ ...CONNECTION, scopes: [DRIVE_METADATA_SCOPE] }),
      authorizer(),
      deps.reader,
      sources(),
      snapshots(),
      deps.listener,
      () => NOW,
      drive,
    );
    await useCase.execute('s1');
    deps.reader.read.mockResolvedValue(CHANGED);

    const result = await useCase.execute('s1');

    expect(result.status).toBe('changed');
    expect(deps.listener.changed).toHaveBeenCalledWith(
      expect.objectContaining({ by: null }),
    );
  });

  it('si cambia el hash pero ninguna celda tiene otro valor, no avisa', async () => {
    const {
      useCase,
      sources: links,
      listener: heard,
      reader: sheets,
    } = setup();
    await useCase.execute('s1');
    sheets.read.mockResolvedValue({
      ...CONTENT,
      contentHash: 'c'.repeat(64),
      tabs: [
        {
          title: 'Partidas',
          rows: [...(CONTENT.tabs[0]?.rows ?? []), ['', '']],
        },
        ...CONTENT.tabs.slice(1),
      ],
    });

    const result = await useCase.execute('s1');

    expect(result.status).toBe('unchanged');
    expect(links.recordCheck).toHaveBeenLastCalledWith(
      's1',
      expect.objectContaining({ contentHash: 'c'.repeat(64), changed: false }),
    );
    expect(heard.changed).not.toHaveBeenCalled();
  });

  it('después de reiniciar la API avisa el cambio sin el detalle', async () => {
    const { useCase, listener: heard, reader: sheets } = setup();
    sheets.read.mockResolvedValue(CHANGED);

    const result = await useCase.execute('s1');

    expect(result.message).toBe('La planilla cambió');
    expect(result.cells).toBeNull();
    expect(heard.changed).toHaveBeenCalledWith(
      expect.objectContaining({ cells: null }),
    );
  });

  it('anota el error de Google sin lanzar', async () => {
    const {
      useCase,
      sources: links,
      reader: sheets,
      listener: heard,
    } = setup();
    sheets.read.mockRejectedValue(
      new ProviderError('Tu cuenta de Google no tiene acceso a esa planilla'),
    );

    const result = await useCase.execute('s1');

    expect(result).toEqual(
      expect.objectContaining({
        status: 'failed',
        message: 'Tu cuenta de Google no tiene acceso a esa planilla',
      }),
    );
    expect(result.failure).toBeUndefined();
    expect(links.recordError).toHaveBeenCalledWith('s1', {
      at: NOW,
      message: 'Tu cuenta de Google no tiene acceso a esa planilla',
    });
    expect(heard.changed).not.toHaveBeenCalled();
  });

  it('lee con la cuenta de quien vinculó la planilla', async () => {
    const { useCase, connections: accounts } = setup();

    await useCase.execute('s1');

    expect(accounts.find).toHaveBeenCalledWith('c1');
  });

  it('si esa cuenta se desconectó, falla con un mensaje claro', async () => {
    const result = await setup({ connected: false }).useCase.execute('s1');
    expect(result.status).toBe('failed');
    expect(result.message).toBe(ORPHAN_SOURCE);
  });

  it('una planilla sin cuenta no le pregunta a Google', async () => {
    const { useCase, sources: links, reader: sheets } = setup();
    links.find.mockResolvedValue({ ...SOURCE, connectionId: null });

    const result = await useCase.execute('s1');

    expect(result.message).toBe(ORPHAN_SOURCE);
    expect(sheets.read).not.toHaveBeenCalled();
  });

  it('no revisa una planilla de otro proyecto', async () => {
    const { useCase, reader: sheets } = setup();

    await expect(useCase.execute('s1', 'torre')).rejects.toMatchObject({
      code: 'source_not_found',
    });
    expect(sheets.read).not.toHaveBeenCalled();
  });

  it('un error inesperado queda con un mensaje genérico y su causa', async () => {
    const { useCase, listener: heard, reader: sheets } = setup();
    sheets.read.mockResolvedValue(CHANGED);
    const boom = new Error('connection reset');
    heard.changed.mockRejectedValue(boom);

    const result = await useCase.execute('s1');

    expect(result.message).toBe('Algo falló al revisar la planilla');
    expect(result.failure).toBe(boom);
  });

  it('una fuente que no existe es un error del pedido', async () => {
    const { useCase, sources: links } = setup();
    links.find.mockResolvedValue(null);

    await expect(useCase.execute('nada')).rejects.toMatchObject({
      code: 'source_not_found',
    });
  });
});
