import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { AccountsService, type Role } from './accounts.service.ts';
import { freeId, nameKey, organizationSlug } from './project-id.ts';

@Injectable()
export class AdminService {
  private readonly prisma: PrismaClient;
  private readonly accounts: AccountsService;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(AccountsService) accounts: AccountsService,
  ) {
    this.prisma = prisma;
    this.accounts = accounts;
  }

  async users() {
    const [users, invitations] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          memberships: {
            include: { organization: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.invitation.findMany({
        where: { acceptedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { organization: true },
      }),
    ]);
    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        organizations: user.memberships.map((item) => ({
          id: item.organizationId,
          name: item.organization.name,
          role: item.role,
        })),
      })),
      invitations: invitations.map((item) => ({
        id: item.id,
        email: item.email,
        organizationId: item.organizationId,
        organizationName: item.organization.name,
        role: item.role,
        createdAt: item.createdAt,
      })),
    };
  }

  async organizations() {
    const rows = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { memberships: true, projects: true } },
      },
    });
    return {
      organizations: rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
        members: row._count.memberships,
        projects: row._count.projects,
      })),
    };
  }

  async createOrganization(name: string) {
    const key = nameKey(name);
    const existing = await this.prisma.organization.findMany({
      select: { name: true },
    });
    const twin = existing.find((row) => nameKey(row.name) === key);
    if (twin) {
      throw fail(
        HttpStatus.CONFLICT,
        'organization_name_taken',
        `Ya existe una organización llamada «${twin.name}»`,
      );
    }
    const slug = organizationSlug(name);
    const taken = await this.prisma.organization.findMany({
      where: { id: { startsWith: slug } },
      select: { id: true },
    });
    const row = await this.prisma.organization.create({
      data: {
        id: freeId(
          slug,
          taken.map((item) => item.id),
        ),
        name,
      },
    });
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      members: 0,
      projects: 0,
    };
  }

  async invite(organizationId: string, email: string, role: Role) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'organization_not_found',
        'Esa organización no existe',
      );
    }
    const invitation = await this.accounts.invite(organizationId, email, role);
    return {
      ...invitation,
      organizationId,
      organizationName: organization.name,
    };
  }
}
