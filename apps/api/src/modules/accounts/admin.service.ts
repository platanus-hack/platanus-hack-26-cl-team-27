import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { AccountsService, type Role } from './accounts.service.ts';

const MAX_SLUG = 48;

export const organizationSlug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '') || 'organizacion';

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
    const clean = name.trim().replace(/\s+/g, ' ');
    const taken = await this.prisma.organization.findFirst({
      where: { name: { equals: clean, mode: 'insensitive' } },
    });
    if (taken) {
      throw fail(
        HttpStatus.CONFLICT,
        'organization_exists',
        `Ya existe la organización ${taken.name}`,
      );
    }
    const id = await this.freeId(organizationSlug(clean));
    const row = await this.prisma.organization.create({
      data: { id, name: clean },
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

  private async freeId(base: string): Promise<string> {
    const used = new Set(
      (
        await this.prisma.organization.findMany({
          where: { id: { startsWith: base } },
          select: { id: true },
        })
      ).map((row) => row.id),
    );
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }
}
