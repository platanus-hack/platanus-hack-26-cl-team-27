import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { MAX_CHANGES, type Snapshot } from '@team27/context-capture';
import { z } from 'zod';

import { LOS_AROMOS, type Scenario } from '../../scenario/los-aromos.ts';
import {
  CoordinationService,
  type PublishResult,
} from './coordination.service.ts';
import type { FeedChange } from './feed.ts';

const integrationId = z.literal(LOS_AROMOS.integration.id);

const changeId = z.uuid();

const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_CHANGES).default(20),
});

const property = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  value: z.union([z.number().finite(), z.string().max(120)]),
  unit: z.string().max(16).nullable(),
  editable: z.boolean(),
});

const element = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(32),
  level: z.number().int().nullable(),
  properties: z.array(property).max(50),
});

const publishBody = z.object({
  elements: z
    .array(element)
    .min(1)
    .max(500)
    .refine(
      (elements) => new Set(elements.map((e) => e.id)).size === elements.length,
      {
        message: 'Cada elemento debe tener un id único',
      },
    ),
});

export type DemoInfo = Omit<Scenario, 'model' | 'graph'>;

@Controller()
export class CoordinationController {
  private readonly coordination: CoordinationService;

  constructor(@Inject(CoordinationService) coordination: CoordinationService) {
    this.coordination = coordination;
  }

  @Get('demo')
  demo(): DemoInfo {
    const { project, integration, stakeholders, presets } = LOS_AROMOS;
    return { project, integration, stakeholders, presets };
  }

  @Post('demo/reset')
  @HttpCode(204)
  async reset(): Promise<void> {
    await this.coordination.reset();
  }

  @Get('integrations/:integrationId/model')
  async model(
    @Param('integrationId', { schema: integrationId }) id: string,
  ): Promise<Snapshot> {
    const snapshot = await this.coordination.latestModel(id);
    if (!snapshot)
      throw new NotFoundException('Todavía no hay una versión publicada');
    return snapshot;
  }

  @Post('integrations/:integrationId/versions')
  publish(
    @Param('integrationId', { schema: integrationId }) id: string,
    @Body({ schema: publishBody }) body: z.output<typeof publishBody>,
  ): Promise<PublishResult> {
    return this.coordination.publish(id, body.elements);
  }

  @Get('changes')
  feed(
    @Query({ schema: feedQuery }) query: z.output<typeof feedQuery>,
  ): Promise<FeedChange[]> {
    return this.coordination.feed(query.limit);
  }

  @Get('changes/:id')
  async change(
    @Param('id', { schema: changeId }) id: string,
  ): Promise<FeedChange> {
    const change = await this.coordination.change(id);
    if (!change) throw new NotFoundException(`No existe el cambio ${id}`);
    return change;
  }
}
