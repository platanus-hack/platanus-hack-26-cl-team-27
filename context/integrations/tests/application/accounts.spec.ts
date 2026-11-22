import { IntegrationError } from '../../src/application/errors.ts';
import { ConnectGoogle } from '../../src/application/use-cases/ConnectGoogle.ts';
import { GetGoogleConnection } from '../../src/application/use-cases/GetGoogleConnection.ts';
import { LinkSpreadsheet } from '../../src/application/use-cases/LinkSpreadsheet.ts';
import { UnlinkSource } from '../../src/application/use-cases/UnlinkSource.ts';
import {
  authorizer,
  CONNECTION,
  CONTENT,
  connections,
  reader,
  SHEET_ID,
  snapshots,
  SOURCE,
  sources,
} from './fakes.ts';

const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;
const NOW = new Date('2026-11-21T21:05:12Z');

const request = (url: string, projectId = 'los-aromos') => ({
  userId: 'u1',
  projectId,
  url,
});

describe('ConnectGoogle', () => {
  it('guarda la cuenta con el permiso que entregó Google', async () => {
    const accounts = authorizer();
    accounts.exchange.mockResolvedValue({
      accountEmail: 'daniela@example.com',
      scopes: ['email'],
      refreshToken: 'refresh-1',
    });
    const repository = connections();

    await new ConnectGoogle(accounts, repository).execute('u1', 'code-1');

    expect(accounts.exchange).toHaveBeenCalledWith('code-1');
    expect(repository.save).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'google',
      accountEmail: 'daniela@example.com',
      scopes: ['email'],
      refreshToken: 'refresh-1',
    });
  });
});

describe('GetGoogleConnection', () => {
  it('busca la cuenta de la persona y nunca devuelve el token', async () => {
    const repository = connections();
    const connection = await new GetGoogleConnection(repository).execute('u1');
    expect(repository.findForUser).toHaveBeenCalledWith('u1', 'google');
    expect(connection).toEqual({
      id: 'c1',
      userId: 'u1',
      provider: 'google',
      accountEmail: 'daniela@example.com',
      scopes: ['email'],
      connectedAt: CONNECTION.connectedAt,
    });
  });
});

describe('LinkSpreadsheet', () => {
  const link = (options: { connected?: boolean } = {}) => {
    const deps = {
      connections: connections(options.connected === false ? null : undefined),
      authorizer: authorizer(),
      reader: reader(),
      sources: sources(),
      snapshots: snapshots(),
    };
    return {
      ...deps,
      useCase: new LinkSpreadsheet(
        deps.connections,
        deps.authorizer,
        deps.reader,
        deps.sources,
        deps.snapshots,
        () => NOW,
      ),
    };
  };

  it('abre la planilla, la vincula y guarda la primera revisión', async () => {
    const {
      useCase,
      reader: sheets,
      sources: links,
      snapshots: cache,
    } = link();

    const source = await useCase.execute(request(URL));

    expect(sheets.read).toHaveBeenCalledWith('access-1', SHEET_ID);
    expect(links.findInProject).toHaveBeenCalledWith('los-aromos', SHEET_ID);
    expect(links.create).toHaveBeenCalledWith({
      projectId: 'los-aromos',
      connectionId: 'c1',
      provider: 'google',
      externalId: SHEET_ID,
      title: CONTENT.title,
      pointer: CONTENT.pointer,
      contentHash: CONTENT.contentHash,
      checkedAt: NOW,
    });
    expect(cache.get(source.id)).toEqual({ tabs: CONTENT.tabs });
  });

  it.each([
    [
      'un link que no es de Sheets',
      'https://example.com',
      true,
      'invalid_sheet_url',
    ],
    ['sin cuenta conectada', URL, false, 'not_connected'],
  ] as const)('rechaza %s', async (_name, url, connected, code) => {
    const { useCase, sources: links } = link({ connected });

    await expect(useCase.execute(request(url))).rejects.toMatchObject({
      code,
    });
    expect(links.create).not.toHaveBeenCalled();
  });

  it('una planilla se vincula una sola vez por proyecto', async () => {
    const { useCase, sources: links, reader: sheets } = link();
    links.findInProject.mockResolvedValue(SOURCE);

    await expect(useCase.execute(request(URL))).rejects.toMatchObject({
      code: 'already_linked',
    });
    expect(sheets.read).not.toHaveBeenCalled();
  });

  it('la misma planilla se puede vincular en otro proyecto', async () => {
    const { useCase, sources: links } = link();

    const source = await useCase.execute(request(URL, 'torre'));

    expect(links.findInProject).toHaveBeenCalledWith('torre', SHEET_ID);
    expect(source.projectId).toBe('torre');
  });

  it('una planilla que quedó sin cuenta se toma con la cuenta de quien la vuelve a vincular', async () => {
    const { useCase, sources: links, snapshots: cache } = link();
    links.findInProject.mockResolvedValue({ ...SOURCE, connectionId: null });

    const source = await useCase.execute(request(URL));

    expect(links.create).not.toHaveBeenCalled();
    expect(links.relink).toHaveBeenCalledWith('s1', {
      connectionId: 'c1',
      at: NOW,
      title: CONTENT.title,
      contentHash: CONTENT.contentHash,
    });
    expect(source.connectionId).toBe('c1');
    expect(cache.get('s1')).toEqual({ tabs: CONTENT.tabs });
  });
});

describe('UnlinkSource', () => {
  it('borra la fuente y su última revisión en memoria', async () => {
    const links = sources();
    const cache = snapshots();
    cache.set('s1', { tabs: [] });

    await new UnlinkSource(links, cache).execute('los-aromos', 's1');

    expect(links.remove).toHaveBeenCalledWith('s1');
    expect(cache.get('s1')).toBeNull();
  });

  it('no borra una planilla de otro proyecto', async () => {
    const links = sources();

    await expect(
      new UnlinkSource(links, snapshots()).execute('torre', 's1'),
    ).rejects.toMatchObject({ code: 'source_not_found' });
    expect(links.remove).not.toHaveBeenCalled();
  });

  it('avisa si la fuente ya no estaba', async () => {
    const links = sources();
    links.remove.mockResolvedValue(false);

    await expect(
      new UnlinkSource(links, snapshots()).execute('los-aromos', 's1'),
    ).rejects.toBeInstanceOf(IntegrationError);
  });
});
