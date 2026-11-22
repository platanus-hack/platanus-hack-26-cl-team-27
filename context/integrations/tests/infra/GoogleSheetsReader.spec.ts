import { GoogleSheetsReader } from '../../src/infra/adapters/GoogleSheetsReader.ts';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab';

const json = (status: number, body: object): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const META = {
  properties: { title: 'Presupuesto Los Aromos' },
  sheets: [
    { properties: { title: 'Notas', index: 1 } },
    { properties: { title: "Partidas de Daniela's", index: 0 } },
  ],
};

const VALUES = {
  valueRanges: [
    {
      values: [
        ['Código', 'Precio unitario'],
        ['03.02', 145000, { raro: true }],
      ],
    },
    {},
  ],
};

const reader = (responses: Response[]) => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  return { fetch, sheets: new GoogleSheetsReader({ fetch }) };
};

describe('GoogleSheetsReader', () => {
  it('lee todas las hojas, en orden y sin formato', async () => {
    const { fetch, sheets } = reader([json(200, META), json(200, VALUES)]);

    const content = await sheets.read('access-1', ID);

    expect(content).toEqual({
      title: 'Presupuesto Los Aromos',
      tabs: [
        {
          title: "Partidas de Daniela's",
          rows: [
            ['Código', 'Precio unitario'],
            ['03.02', 145000, null],
          ],
        },
        { title: 'Notas', rows: [] },
      ],
      pointer: `https://docs.google.com/spreadsheets/d/${ID}/edit`,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const batch = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(decodeURIComponent(batch.pathname)).toBe(
      `/v4/spreadsheets/${ID}/values:batchGet`,
    );
    expect(batch.searchParams.getAll('ranges')).toEqual([
      "'Partidas de Daniela''s'",
      "'Notas'",
    ]);
    expect(batch.searchParams.get('valueRenderOption')).toBe(
      'UNFORMATTED_VALUE',
    );
    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({ authorization: 'Bearer access-1' }),
    );
  });

  it('el hash cambia solo si cambian las celdas', async () => {
    const first = await reader([
      json(200, META),
      json(200, VALUES),
    ]).sheets.read('a', ID);
    const renamed = await reader([
      json(200, { ...META, properties: { title: 'Otro nombre' } }),
      json(200, VALUES),
    ]).sheets.read('b', ID);
    const changed = await reader([
      json(200, META),
      json(200, {
        valueRanges: [{ values: [['Código'], ['03.02', 150000]] }, {}],
      }),
    ]).sheets.read('a', ID);

    expect(renamed.contentHash).toBe(first.contentHash);
    expect(changed.contentHash).not.toBe(first.contentHash);
  });

  it.each([
    [404, {}, 'No encontramos esa planilla: revisa el link'],
    [403, {}, 'Tu cuenta de Google no tiene acceso a esa planilla'],
    [
      403,
      { error: { details: [{ reason: 'SERVICE_DISABLED' }] } },
      'La API de Google Sheets no está activada en el proyecto de Google Cloud',
    ],
    [401, {}, 'Google no aceptó el permiso: vuelve a conectar la cuenta'],
  ])('traduce un %i de Google', async (status, body, message) => {
    const { sheets } = reader([json(status, body)]);
    await expect(sheets.read('a', ID)).rejects.toThrow(message);
  });

  it('una planilla sin hojas es un error', async () => {
    const { sheets } = reader([json(200, { sheets: [] })]);
    await expect(sheets.read('a', ID)).rejects.toThrow(
      'La planilla no tiene hojas',
    );
  });
});
