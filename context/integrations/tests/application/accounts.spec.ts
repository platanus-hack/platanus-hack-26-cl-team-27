import { IntegrationError } from '../../src/application/errors.ts';
import { ConnectGoogle } from '../../src/application/use-cases/ConnectGoogle.ts';
import { GetGoogleConnection } from '../../src/application/use-cases/GetGoogleConnection.ts';
import { LinkSpreadsheet } from '../../src/application/use-cases/LinkSpreadsheet.ts';
import { UnlinkSource } from '../../src/application/use-cases/UnlinkSource.ts';
import {
  authorizer,
  CONNECTION,
  connections,
  reader,
  SNAPSHOT,
  SOURCE,
  sources,
} from './fakes.ts';

const SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

describe('ConnectGoogle', () => {
  it('guarda la cuenta con el permiso que entregó Google', async () => {
    const accounts = authorizer();
    accounts.exchange.mockResolvedValue({
      accountEmail: 'daniela@example.com',
      scopes: ['email'],
      refreshToken: 'refresh-1',
    });
    const repository = connections();

    await new ConnectGoogle(accounts, repository).execute('code-1');

    expect(accounts.exchange).toHaveBeenCalledWith('code-1');
    expect(repository.save).toHaveBeenCalledWith({
      provider: 'google',
      accountEmail: 'daniela@example.com',
      scopes: ['email'],
      refreshToken: 'refresh-1',
    });
  });
});

describe('GetGoogleConnection', () => {
  it('nunca devuelve el token', async () => {
    const connection = await new GetGoogleConnection(connections()).execute();
    expect(connection).toEqual({
      id: 'c1',
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
    };
    return {
      ...deps,
      useCase: new LinkSpreadsheet(
        deps.connections,
        deps.authorizer,
        deps.reader,
        deps.sources,
      ),
    };
  };

  it('abre la planilla y la vincula al documento', async () => {
    const { useCase, reader: sheets, sources: links } = link();

    await useCase.execute({ url: URL, documentId: 'presupuesto' });

    expect(sheets.read).toHaveBeenCalledWith('access-1', SHEET_ID);
    expect(links.create).toHaveBeenCalledWith({
      connectionId: 'c1',
      provider: 'google',
      externalId: SHEET_ID,
      documentId: 'presupuesto',
      title: SNAPSHOT.title,
      pointer: SNAPSHOT.pointer,
    });
  });

  it.each([
    [
      'un link que no es de Sheets',
      { url: 'https://example.com' },
      'invalid_sheet_url',
    ],
    ['sin cuenta conectada', { connected: false }, 'not_connected'],
  ] as const)('rechaza %s', async (_name, options, code) => {
    const { useCase, sources: links } = link(
      'connected' in options ? options : {},
    );
    const url = 'url' in options ? options.url : URL;

    await expect(
      useCase.execute({ url, documentId: 'presupuesto' }),
    ).rejects.toMatchObject({ code });
    expect(links.create).not.toHaveBeenCalled();
  });

  it('un documento tiene una sola planilla', async () => {
    const { useCase, sources: links, reader: sheets } = link();
    links.findByDocument.mockResolvedValue(SOURCE);

    await expect(
      useCase.execute({ url: URL, documentId: 'presupuesto' }),
    ).rejects.toMatchObject({ code: 'already_linked' });
    expect(sheets.read).not.toHaveBeenCalled();
  });
});

describe('UnlinkSource', () => {
  it('avisa si la fuente ya no estaba', async () => {
    const links = sources();
    links.remove.mockResolvedValue(false);

    await expect(new UnlinkSource(links).execute('s1')).rejects.toBeInstanceOf(
      IntegrationError,
    );
  });
});
