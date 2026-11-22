import { ProviderError } from '../../src/application/errors.ts';
import {
  FILE_GONE,
  ReceiveNotice,
} from '../../src/application/use-cases/ReceiveNotice.ts';
import {
  MISSING_DRIVE_SCOPE,
  SubscribeSource,
} from '../../src/application/use-cases/SubscribeSource.ts';
import { UnsubscribeSource } from '../../src/application/use-cases/UnsubscribeSource.ts';
import {
  DRIVE_METADATA_SCOPE,
  type PushChannel,
} from '../../src/domain/Push.ts';
import {
  authorizer,
  CONNECTION,
  connections,
  SOURCE,
  sources,
  watcher,
} from './fakes.ts';

const NOW = new Date('2026-11-21T21:00:00Z');
const HOUR = 3_600_000;
const OPTIONS = {
  address: 'https://vigente.example/api/integrations/google/notifications',
  ttlMs: 24 * HOUR,
  renewMarginMs: 2 * HOUR,
};

const CHANNEL: PushChannel = {
  id: 'ch-1',
  resourceId: 'res-1',
  token: 'secret-1',
  expiresAt: new Date(NOW.getTime() + 10 * HOUR),
};

const DRIVE_CONNECTION = { ...CONNECTION, scopes: [DRIVE_METADATA_SCOPE] };

describe('SubscribeSource', () => {
  const build = (
    source = SOURCE,
    connection: typeof CONNECTION | null = DRIVE_CONNECTION,
  ) => {
    const deps = {
      connections: connections(connection),
      authorizer: authorizer(),
      watcher: watcher(),
      sources: sources(source),
    };
    const useCase = new SubscribeSource(
      deps.connections,
      deps.authorizer,
      deps.watcher,
      deps.sources,
      () => NOW,
    );
    return { ...deps, useCase };
  };

  it('pide a Google que avise y guarda el canal', async () => {
    const { useCase, watcher: drive, sources: links } = build();

    const result = await useCase.execute('s1', OPTIONS);

    expect(drive.watch).toHaveBeenCalledWith('access-1', SOURCE.externalId, {
      address: OPTIONS.address,
      ttlMs: OPTIONS.ttlMs,
    });
    expect(links.saveChannel).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ id: 'ch-2', resourceId: 'res-1' }),
    );
    expect(result.status).toBe('subscribed');
    expect(drive.stop).not.toHaveBeenCalled();
  });

  it('no renueva un canal que todavía no vence', async () => {
    const { useCase, watcher: drive } = build({ ...SOURCE, channel: CHANNEL });

    const result = await useCase.execute('s1', OPTIONS);

    expect(result.status).toBe('current');
    expect(drive.watch).not.toHaveBeenCalled();
  });

  it('al renovar, abre el canal nuevo antes de cerrar el viejo', async () => {
    const expiring = {
      ...CHANNEL,
      expiresAt: new Date(NOW.getTime() + HOUR),
    };
    const {
      useCase,
      watcher: drive,
      sources: links,
    } = build({
      ...SOURCE,
      channel: expiring,
    });

    const result = await useCase.execute('s1', OPTIONS);

    expect(result.status).toBe('subscribed');
    expect(drive.stop).toHaveBeenCalledWith('access-1', expiring);
    expect(links.saveChannel.mock.invocationCallOrder[0]).toBeLessThan(
      drive.stop.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sin el permiso de Drive no se suscribe y lo dice', async () => {
    const { useCase, watcher: drive } = build(SOURCE, CONNECTION);

    const result = await useCase.execute('s1', OPTIONS);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'unsupported',
        message: MISSING_DRIVE_SCOPE,
      }),
    );
    expect(drive.watch).not.toHaveBeenCalled();
  });

  it('un rechazo de Google vuelve como falla, sin lanzar', async () => {
    const { useCase, watcher: drive, sources: links } = build();
    drive.watch.mockRejectedValue(
      new ProviderError('Google no acepta la URL de avisos', 400),
    );

    const result = await useCase.execute('s1', OPTIONS);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'failed',
        message: 'Google no acepta la URL de avisos',
      }),
    );
    expect(links.saveChannel).not.toHaveBeenCalled();
  });
});

describe('ReceiveNotice', () => {
  const build = (found = { ...SOURCE, channel: CHANNEL }) => {
    const links = sources(found);
    return { links, useCase: new ReceiveNotice(links, () => NOW) };
  };

  const notice = (
    overrides: Partial<Parameters<ReceiveNotice['execute']>[0]> = {},
  ) => ({
    channelId: 'ch-1',
    resourceId: 'res-1',
    token: 'secret-1',
    state: 'update',
    changed: ['content'],
    ...overrides,
  });

  it('un cambio de contenido pide revisar la planilla', async () => {
    const { useCase, links } = build();

    expect(await useCase.execute(notice())).toEqual({
      kind: 'check',
      sourceId: 's1',
    });
    expect(links.findByChannel).toHaveBeenCalledWith('ch-1');
  });

  it('rechaza un secreto o un recurso que no calzan', async () => {
    const { useCase } = build();

    expect(await useCase.execute(notice({ token: 'otro' }))).toEqual({
      kind: 'rejected',
    });
    expect(await useCase.execute(notice({ token: null }))).toEqual({
      kind: 'rejected',
    });
    expect(await useCase.execute(notice({ resourceId: 'res-2' }))).toEqual({
      kind: 'rejected',
    });
  });

  it('un canal que no conocemos no hace nada', async () => {
    const { useCase } = build(null as never);

    expect(await useCase.execute(notice())).toEqual({ kind: 'unknown' });
  });

  it('ignora el aviso inicial de la suscripción', async () => {
    const { useCase } = build();

    expect(
      await useCase.execute(notice({ state: 'sync', changed: [] })),
    ).toEqual({ kind: 'ignored' });
  });

  it('si la planilla se borra, lo anota', async () => {
    const { useCase, links } = build();

    expect(await useCase.execute(notice({ state: 'trash' }))).toEqual({
      kind: 'gone',
      sourceId: 's1',
    });
    expect(links.recordError).toHaveBeenCalledWith('s1', {
      at: NOW,
      message: FILE_GONE,
    });
  });
});

describe('UnsubscribeSource', () => {
  it('cierra el canal en Google y lo olvida', async () => {
    const drive = watcher();
    const links = sources({ ...SOURCE, channel: CHANNEL });
    const useCase = new UnsubscribeSource(
      connections(DRIVE_CONNECTION),
      authorizer(),
      drive,
      links,
    );

    expect(await useCase.execute('s1')).toBe(true);
    expect(links.saveChannel).toHaveBeenCalledWith('s1', null);
    expect(drive.stop).toHaveBeenCalledWith('access-1', CHANNEL);
  });

  it('sin canal no llama a Google', async () => {
    const drive = watcher();
    const useCase = new UnsubscribeSource(
      connections(DRIVE_CONNECTION),
      authorizer(),
      drive,
      sources(),
    );

    expect(await useCase.execute('s1')).toBe(false);
    expect(drive.stop).not.toHaveBeenCalled();
  });

  it('si Google falla al cerrar, igual olvida el canal', async () => {
    const drive = watcher();
    drive.stop.mockRejectedValue(new ProviderError('boom', 500));
    const links = sources({ ...SOURCE, channel: CHANNEL });
    const useCase = new UnsubscribeSource(
      connections(DRIVE_CONNECTION),
      authorizer(),
      drive,
      links,
    );

    expect(await useCase.execute('s1')).toBe(false);
    expect(links.saveChannel).toHaveBeenCalledWith('s1', null);
  });
});
