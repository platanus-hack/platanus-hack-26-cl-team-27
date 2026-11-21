import {
  DeliveryError,
  IntegrationError,
  ProviderError,
} from '../../src/application/errors.ts';
import {
  SyncSource,
  UNCHANGED_MESSAGE,
  WAITING_MESSAGE,
} from '../../src/application/use-cases/SyncSource.ts';
import type { SourceLink } from '../../src/domain/Connection.ts';
import { VOCABULARY } from '../fixtures.ts';
import {
  authorizer,
  connections,
  reader,
  sink,
  SNAPSHOT,
  SOURCE,
  sources,
} from './fakes.ts';

const NOW = new Date('2026-11-21T21:05:12Z');

const setup = (
  options: {
    source?: SourceLink;
    epoch?: number | null;
    connected?: boolean;
  } = {},
) => {
  const deps = {
    connections: connections(options.connected === false ? null : undefined),
    authorizer: authorizer(),
    reader: reader(),
    sources: sources(options.source ?? SOURCE),
    sink: sink(options.epoch === undefined ? 1 : options.epoch),
  };
  const useCase = new SyncSource(
    deps.connections,
    deps.authorizer,
    deps.reader,
    deps.sources,
    deps.sink,
    VOCABULARY,
    () => NOW,
  );
  return { ...deps, useCase };
};

const read = (hash: string, epoch: number) => ({
  at: new Date('2026-11-21T20:00:00Z'),
  hash,
  epoch,
  label: 'Sheets 21-11 17:00:00',
  ignored: [],
});

describe('SyncSource', () => {
  it('entrega la planilla como revisión nueva del documento', async () => {
    const {
      useCase,
      sink: revisions,
      sources: links,
      reader: sheets,
    } = setup();

    const result = await useCase.execute('s1');

    expect(sheets.read).toHaveBeenCalledWith('access-1', 'sheet-1');
    expect(revisions.deliver).toHaveBeenCalledWith({
      documentId: 'presupuesto',
      label: 'Sheets 21-11 18:05:12',
      pointer: SNAPSHOT.pointer,
      contentHash: SNAPSHOT.contentHash,
      chunks: expect.arrayContaining([
        expect.objectContaining({ locator: 'Partidas!C14', kind: 'fila' }),
      ]),
    });
    expect(links.recordRead).toHaveBeenCalledWith(
      's1',
      {
        at: NOW,
        hash: SNAPSHOT.contentHash,
        epoch: 1,
        label: 'Sheets 21-11 18:05:12',
        ignored: expect.arrayContaining([
          expect.objectContaining({ locator: 'Partidas!A18' }),
        ]),
      },
      'Presupuesto Los Aromos',
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ingested',
        message:
          'Llegó la revisión: abrimos 1 propuesta y avisamos a 2 personas.',
        receipt: expect.objectContaining({ revisionId: 'r1' }),
      }),
    );
  });

  it('espera sin leer mientras la obra no tenga la carga inicial', async () => {
    const { useCase, reader: sheets, sources: links } = setup({ epoch: null });

    const result = await useCase.execute('s1');

    expect(result.status).toBe('waiting');
    expect(result.message).toBe(WAITING_MESSAGE);
    expect(sheets.read).not.toHaveBeenCalled();
    expect(links.recordError).not.toHaveBeenCalled();
  });

  it('si la planilla no cambió, solo anota la revisión', async () => {
    const {
      useCase,
      sink: revisions,
      sources: links,
    } = setup({
      source: { ...SOURCE, lastRead: read(SNAPSHOT.contentHash, 1) },
    });

    const result = await useCase.execute('s1');

    expect(result.status).toBe('unchanged');
    expect(result.message).toBe(UNCHANGED_MESSAGE);
    expect(revisions.deliver).not.toHaveBeenCalled();
    expect(links.recordCheck).toHaveBeenCalledWith(
      's1',
      NOW,
      'Presupuesto Los Aromos',
    );
  });

  it('vuelve a entregar la misma planilla después de reiniciar la sala', async () => {
    const { useCase, sink: revisions } = setup({
      source: { ...SOURCE, lastRead: read(SNAPSHOT.contentHash, 1) },
      epoch: 2,
    });

    expect((await useCase.execute('s1')).status).toBe('ingested');
    expect(revisions.deliver).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new ProviderError('Tu cuenta de Google no tiene acceso a esa planilla')],
    [new DeliveryError('La revisión trae hechos que el proyecto no reconoce')],
  ])('anota el error %s sin lanzar', async (error) => {
    const { useCase, sink: revisions, sources: links } = setup();
    revisions.deliver.mockRejectedValue(error);

    const result = await useCase.execute('s1');

    expect(result).toEqual(
      expect.objectContaining({ status: 'failed', message: error.message }),
    );
    expect(result.failure).toBeUndefined();
    expect(links.recordError).toHaveBeenCalledWith('s1', {
      at: NOW,
      message: error.message,
    });
    expect(links.recordRead).not.toHaveBeenCalled();
  });

  it('una hoja sin encabezados queda como error de la fuente', async () => {
    const { useCase, reader: sheets } = setup();
    sheets.read.mockResolvedValue({
      ...SNAPSHOT,
      tab: { title: 'Notas', rows: [['nada']] },
    });

    const result = await useCase.execute('s1');

    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/no tiene la fila de encabezados/);
  });

  it('una planilla sin precios de la obra no se entrega', async () => {
    const { useCase, reader: sheets, sink: revisions } = setup();
    sheets.read.mockResolvedValue({
      ...SNAPSHOT,
      tab: {
        title: 'Partidas',
        rows: [
          ['Código', 'Precio unitario', 'Unidad'],
          ['01.01', 1, 'gl'],
        ],
      },
    });

    const result = await useCase.execute('s1');

    expect(result.status).toBe('failed');
    expect(result.message).toBe(
      'La planilla no trae precios de las partidas que sigue la obra',
    );
    expect(revisions.deliver).not.toHaveBeenCalled();
  });

  it('sin la cuenta de Google conectada, falla con un mensaje claro', async () => {
    const result = await setup({ connected: false }).useCase.execute('s1');

    expect(result.status).toBe('failed');
    expect(result.message).toBe(
      'Conecta tu cuenta de Google para leer la planilla',
    );
  });

  it('un error inesperado queda con un mensaje genérico y su causa', async () => {
    const { useCase, sink: revisions } = setup();
    const boom = new Error('connection reset');
    revisions.deliver.mockRejectedValue(boom);

    const result = await useCase.execute('s1');

    expect(result.message).toBe('Algo falló al leer la planilla');
    expect(result.failure).toBe(boom);
  });

  it('una fuente que no existe es un error del pedido', async () => {
    const { useCase, sources: links } = setup();
    links.find.mockResolvedValue(null);

    await expect(useCase.execute('nada')).rejects.toBeInstanceOf(
      IntegrationError,
    );
  });
});
