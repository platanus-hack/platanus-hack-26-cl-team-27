import { createHmac } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReceiveAutodeskEvent } from '@team27/context-integrations';
import { InMemoryAutodeskEventRepository } from '@team27/context-integrations/adapters';

import { APP_OPTIONS, setupApp } from '../../../src/app.setup.ts';
import { provideUseCase } from '../../../src/common/provide-use-case.ts';
import { AutodeskWebhooksController } from '../../../src/modules/integrations/autodesk-webhooks.controller.ts';
import {
  AUTODESK_CHANGE_LISTENER,
  AUTODESK_EVENT_REPOSITORY,
  AUTODESK_WEBHOOKS_CONFIG,
  AutodeskWebhooksService,
  CONNECTORS_LOGGER,
  type ConnectorsLogger,
  WEBHOOKS_OFF,
} from '../../../src/modules/integrations/autodesk-webhooks.service.ts';
import { LoggingAutodeskListener } from '../../../src/modules/integrations/change-log.ts';

const SECRET = 'secreto-de-prueba-de-los-webhooks';

const LINEAGE = 'urn:adsk.wipprod:dm.lineage:hC6k4hndRWaeIVhIjvHu8w';

const WEBHOOK = {
  version: '1.0',
  resourceUrn: LINEAGE,
  hook: {
    hookId: 'hook-1',
    system: 'data',
    event: 'dm.version.added',
  },
  payload: {
    ext: 'rvt',
    name: 'Muro fachada Ñuñoa.rvt',
    lineageUrn: LINEAGE,
    source: 'urn:adsk.wipprod:fs.file:vf.hC6k4hndRWaeIVhIjvHu8w?version=3',
    version: '3',
    modifiedTime: '2026-11-21T20:15:03+0000',
    parentFolderUrn: 'urn:adsk.wipprod:fs.folder:co.planos',
    project: 'b.los-aromos',
    user_info: { id: 'AUTODESK-USER-1' },
  },
};

const RAW = JSON.stringify(WEBHOOK, null, 2);

const LINE =
  'Autodesk: version.added «Muro fachada Ñuñoa.rvt» (v3) por AUTODESK-USER-1 en b.los-aromos / urn:adsk.wipprod:fs.folder:co.planos; el diff por elemento queda pendiente';

const sign = (raw: string, secret = SECRET): string =>
  `sha1hash=${createHmac('sha1', secret).update(raw, 'utf8').digest('hex')}`;

const start = async (secret: string | null) => {
  const logger = { log: vi.fn(), warn: vi.fn() };
  const events = new InMemoryAutodeskEventRepository();
  const moduleRef = await Test.createTestingModule({
    controllers: [AutodeskWebhooksController],
    providers: [
      { provide: CONNECTORS_LOGGER, useValue: logger },
      { provide: AUTODESK_EVENT_REPOSITORY, useValue: events },
      {
        provide: AUTODESK_CHANGE_LISTENER,
        inject: [CONNECTORS_LOGGER],
        useFactory: (connectors: ConnectorsLogger) =>
          new LoggingAutodeskListener(connectors),
      },
      provideUseCase(ReceiveAutodeskEvent, [
        AUTODESK_EVENT_REPOSITORY,
        AUTODESK_CHANGE_LISTENER,
      ]),
      { provide: AUTODESK_WEBHOOKS_CONFIG, useValue: { secret } },
      AutodeskWebhooksService,
    ],
  }).compile();
  const app: INestApplication = setupApp(
    moduleRef.createNestApplication({ ...APP_OPTIONS, logger: false }),
  );
  await app.listen(0);
  const url = `${await app.getUrl()}/api/integrations/autodesk/webhooks`;
  const post = (raw: string, signature: string | null) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signature === null ? {} : { 'x-adsk-signature': signature }),
      },
      body: raw,
    });
  return { app, post, logger, events };
};

describe('POST /api/integrations/autodesk/webhooks', () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('un aviso firmado responde 204, se guarda y deja una línea en el log', async () => {
    const started = await start(SECRET);
    app = started.app;

    const response = await started.post(RAW, sign(RAW));

    expect(response.status).toBe(204);
    expect(started.logger.log).toHaveBeenCalledTimes(1);
    expect(started.logger.log).toHaveBeenCalledWith(LINE);
    expect(started.events.list()).toHaveLength(1);
    expect(started.events.list()[0]?.change.dedupeKey).toBe(
      `hook-1|dm.version.added|${LINEAGE}|v3`,
    );
  });

  it('un reintento de Autodesk responde 204 sin guardar ni avisar de nuevo', async () => {
    const started = await start(SECRET);
    app = started.app;

    const first = await started.post(RAW, sign(RAW));
    const again = await started.post(RAW, sign(RAW));

    expect(first.status).toBe(204);
    expect(again.status).toBe(204);
    expect(started.logger.log).toHaveBeenCalledTimes(1);
    expect(started.events.list()).toHaveLength(1);
  });

  it('sin firma, con otra clave o firmado sobre otros bytes responde 403', async () => {
    const started = await start(SECRET);
    app = started.app;

    const unsigned = await started.post(RAW, null);
    const otherKey = await started.post(RAW, sign(RAW, 'otra-clave'));
    const reserialized = await started.post(RAW, sign(JSON.stringify(WEBHOOK)));
    const malformed = await started.post(RAW, 'md5=abc');

    for (const response of [unsigned, otherKey, reserialized, malformed]) {
      expect(response.status).toBe(403);
    }
    expect(await unsigned.json()).toEqual({
      code: 'invalid_signature',
      message: 'La firma del aviso de Autodesk no calza',
    });
    expect(started.logger.log).not.toHaveBeenCalled();
    expect(started.events.list()).toEqual([]);
  });

  it('un cuerpo firmado que no es un webhook responde 400', async () => {
    const started = await start(SECRET);
    app = started.app;
    const raw = '{"hola":"mundo"}';

    const response = await started.post(raw, sign(raw));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'invalid_webhook',
      message: 'El webhook no dice qué evento es',
    });
    expect(started.logger.log).not.toHaveBeenCalled();
    expect(started.events.list()).toEqual([]);
  });

  it('sin APS_WEBHOOK_SECRET responde 503 y lo dice una sola vez en el log', async () => {
    const started = await start(null);
    app = started.app;

    const first = await started.post(RAW, sign(RAW));
    const second = await started.post(RAW, null);

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(await first.json()).toEqual({
      code: 'autodesk_webhooks_off',
      message: WEBHOOKS_OFF,
    });
    expect(started.logger.warn).toHaveBeenCalledTimes(1);
    expect(started.logger.warn).toHaveBeenCalledWith(
      `Llegó un aviso de Autodesk. ${WEBHOOKS_OFF}`,
    );
    expect(started.logger.log).not.toHaveBeenCalled();
    expect(started.events.list()).toEqual([]);
  });
});
