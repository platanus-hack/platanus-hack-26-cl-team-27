import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccountGuard, CurrentAccount } from './account.guard.ts';
import type { Account } from './accounts.service.ts';
import { ProjectsService } from './projects.service.ts';

const projectId = z.string().min(1).max(64);

const userId = z.uuid();

export const projectChangesBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    location: z.string().trim().max(200).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.location !== undefined ||
      body.description !== undefined,
    { message: 'Cambia al menos el nombre, el lugar o la descripción' },
  );

export const teamMemberBody = z.object({
  userId,
  role: z.string().trim().max(80).optional(),
});

@Controller('projects/:projectId')
@UseGuards(AccountGuard)
export class ProjectsController {
  private readonly projects: ProjectsService;

  constructor(@Inject(ProjectsService) projects: ProjectsService) {
    this.projects = projects;
  }

  @Patch()
  update(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Body({ schema: projectChangesBody })
    body: z.output<typeof projectChangesBody>,
  ) {
    return this.projects.update(account, id, body);
  }

  @Get('team')
  @Header('Cache-Control', 'no-store')
  team(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
  ) {
    return this.projects.team(account, id);
  }

  @Post('team')
  addToTeam(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Body({ schema: teamMemberBody }) body: z.output<typeof teamMemberBody>,
  ) {
    return this.projects.addToTeam(account, id, body);
  }

  @Delete('team/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromTeam(
    @CurrentAccount() account: Account,
    @Param('projectId', { schema: projectId }) id: string,
    @Param('userId', { schema: userId }) member: string,
  ): Promise<void> {
    await this.projects.removeFromTeam(account, id, member);
  }
}
