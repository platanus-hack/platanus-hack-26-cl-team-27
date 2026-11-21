import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { setupApp } from '../../../src/app.setup.ts';
import { PRISMA_CLIENT } from '../../../src/modules/database/database.module.ts';
import { HealthController } from '../../../src/modules/health/health.controller.ts';

describe('HealthController', () => {
  const prisma = { $queryRaw: vi.fn() };
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PRISMA_CLIENT, useValue: prisma }],
    }).compile();
    app = setupApp(moduleRef.createNestApplication({ logger: false }));
    await app.listen(0);
    base = `${await app.getUrl()}/api`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde sin tocar la base', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/health/ready consulta la base', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('GET /api/health/ready responde 503 si la base no responde', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unavailable',
      database: 'error',
    });
  });
});
