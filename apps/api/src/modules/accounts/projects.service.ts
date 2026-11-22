import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import type { Account } from './accounts.service.ts';
import { nameKey } from './project-id.ts';

export const TEAM_ROLE = 'Equipo';

export interface ProjectChanges {
  readonly name?: string | undefined;
  readonly location?: string | undefined;
  readonly description?: string | undefined;
}

export interface NewTeamMember {
  readonly userId: string;
  readonly role?: string | undefined;
}

interface ProjectAccess {
  readonly id: string;
  readonly organizationId: string;
  readonly authorId: string;
  readonly costOwnerId: string;
  readonly scheduleOwnerId: string;
  readonly canManage: boolean;
}

@Injectable()
export class ProjectsService {
  private readonly prisma: PrismaClient;

  constructor(@Inject(PRISMA_CLIENT) prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async access(
    account: Account,
    projectId: string,
  ): Promise<ProjectAccess> {
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        authorId: true,
        costOwnerId: true,
        scheduleOwnerId: true,
      },
    });
    const membership = row
      ? account.memberships.find(
          (item) => item.organizationId === row.organizationId,
        )
      : undefined;
    if (!row || !membership) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No encontramos ese proyecto en tus organizaciones',
      );
    }
    return {
      ...row,
      canManage: membership.role === 'admin' || row.authorId === account.id,
    };
  }

  private async manageable(
    account: Account,
    projectId: string,
  ): Promise<ProjectAccess> {
    const project = await this.access(account, projectId);
    if (!project.canManage) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'project_admin_required',
        'Solo un administrador de la organización o quien creó el proyecto puede hacerlo',
      );
    }
    return project;
  }

  async update(account: Account, projectId: string, changes: ProjectChanges) {
    const project = await this.manageable(account, projectId);
    if (changes.name !== undefined) {
      const key = nameKey(changes.name);
      const siblings = await this.prisma.project.findMany({
        where: {
          organizationId: project.organizationId,
          id: { not: project.id },
        },
        select: { name: true },
      });
      if (siblings.some((sibling) => nameKey(sibling.name) === key)) {
        throw fail(
          HttpStatus.CONFLICT,
          'project_name_taken',
          `Ya hay un proyecto llamado «${changes.name}» en esta organización`,
        );
      }
    }
    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.location !== undefined
          ? { location: changes.location }
          : {}),
        ...(changes.description !== undefined
          ? { description: changes.description }
          : {}),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        location: true,
        description: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });
    const { organization, ...rest } = updated;
    return { ...rest, organizationName: organization.name };
  }

  async team(account: Account, projectId: string) {
    const project = await this.access(account, projectId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      orderBy: { position: 'asc' },
    });
    return {
      canManage: project.canManage,
      members: members.map((member) => ({
        userId: member.id,
        name: member.name,
        role: member.role,
        email: member.handle,
        author: member.id === project.authorId,
      })),
    };
  }

  async addToTeam(account: Account, projectId: string, input: NewTeamMember) {
    const project = await this.manageable(account, projectId);
    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: input.userId,
        },
      },
      include: { user: true },
    });
    if (!membership) {
      throw fail(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'not_in_organization',
        'Esa persona no es parte de la organización del proyecto',
      );
    }
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_id: { projectId: project.id, id: input.userId } },
    });
    if (existing) {
      throw fail(
        HttpStatus.CONFLICT,
        'already_on_team',
        `${membership.user.name ?? membership.user.email} ya está en el equipo`,
      );
    }
    const last = await this.prisma.projectMember.aggregate({
      where: { projectId: project.id },
      _max: { position: true },
    });
    const member = await this.prisma.projectMember.create({
      data: {
        projectId: project.id,
        id: input.userId,
        position: (last._max.position ?? -1) + 1,
        name: membership.user.name ?? membership.user.email,
        role: input.role?.trim() || TEAM_ROLE,
        channel: 'email',
        handle: membership.user.email,
      },
    });
    return {
      userId: member.id,
      name: member.name,
      role: member.role,
      email: member.handle,
      author: false,
    };
  }

  async removeFromTeam(account: Account, projectId: string, userId: string) {
    const project = await this.manageable(account, projectId);
    if (
      [project.authorId, project.costOwnerId, project.scheduleOwnerId].includes(
        userId,
      )
    ) {
      throw fail(
        HttpStatus.CONFLICT,
        'project_owner',
        'Quien creó el proyecto, o es dueño del costo o del plazo, no sale del equipo',
      );
    }
    const [spaces, documents] = await Promise.all([
      this.prisma.projectSpace.count({
        where: { projectId: project.id, ownerId: userId },
      }),
      this.prisma.projectDocument.count({
        where: { projectId: project.id, ownerId: userId },
      }),
    ]);
    if (spaces + documents > 0) {
      throw fail(
        HttpStatus.CONFLICT,
        'owns_documents',
        'Esa persona es dueña de espacios o documentos del proyecto: pásaselos a otra antes',
      );
    }
    const removed = await this.prisma.projectMember.deleteMany({
      where: { projectId: project.id, id: userId },
    });
    if (removed.count === 0) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        'Esa persona no está en el equipo',
      );
    }
  }
}
