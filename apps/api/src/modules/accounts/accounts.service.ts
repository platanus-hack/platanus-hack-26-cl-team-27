import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { type Identity, InvalidTokenError } from './identity.ts';
import { freeProjectId, projectNameKey, projectSlug } from './project-id.ts';

export const IDENTITY = 'IDENTITY';

export const ROLES = ['admin', 'member'] as const;

export type Role = (typeof ROLES)[number];

export interface AccountMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: Role;
}

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly memberships: readonly AccountMembership[];
}

export interface NewProject {
  readonly organizationId: string;
  readonly name: string;
  readonly location: string;
  readonly description: string;
}

export const CREATOR_ROLE = 'Creador del proyecto';

const PROJECT_SUMMARY = {
  id: true,
  organizationId: true,
  name: true,
  location: true,
  description: true,
} as const;

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);

@Injectable()
export class AccountsService {
  private readonly prisma: PrismaClient;
  private readonly identity: Identity | null;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(IDENTITY) identity: Identity | null,
  ) {
    this.prisma = prisma;
    this.identity = identity;
  }

  async authenticate(token: string): Promise<Account> {
    const identity = this.requireIdentity();
    let subject: string;
    try {
      ({ subject } = await identity.verify(token));
    } catch (error) {
      throw this.unauthorized(error);
    }
    const known = await this.prisma.user.findUnique({
      where: { authSubject: subject },
    });
    const user = known ?? (await this.register(identity, token, subject));
    await this.acceptInvitations(user.id, user.email);
    return this.account(user.id);
  }

  requireMember(account: Account, organizationId: string): AccountMembership {
    const membership = account.memberships.find(
      (item) => item.organizationId === organizationId,
    );
    if (!membership) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'not_a_member',
        'No eres parte de esa organización',
      );
    }
    return membership;
  }

  requireAdmin(account: Account, organizationId: string): void {
    if (this.requireMember(account, organizationId).role !== 'admin') {
      throw fail(
        HttpStatus.FORBIDDEN,
        'admin_required',
        'Solo un administrador de la organización puede hacerlo',
      );
    }
  }

  async projects(account: Account) {
    const rows = await this.prisma.project.findMany({
      where: {
        organizationId: {
          in: account.memberships.map((item) => item.organizationId),
        },
      },
      orderBy: { createdAt: 'asc' },
      select: PROJECT_SUMMARY,
    });
    return rows;
  }

  async project(account: Account, projectId: string) {
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ...PROJECT_SUMMARY,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });
    if (
      !row ||
      !account.memberships.some(
        (item) => item.organizationId === row.organizationId,
      )
    ) {
      throw fail(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No encontramos ese proyecto en tus organizaciones',
      );
    }
    const { organization, ...project } = row;
    return { ...project, organizationName: organization.name };
  }

  async createProject(account: Account, input: NewProject) {
    this.requireMember(account, input.organizationId);
    const siblings = await this.prisma.project.findMany({
      where: { organizationId: { in: [input.organizationId] } },
      select: { name: true },
    });
    const key = projectNameKey(input.name);
    if (siblings.some((sibling) => projectNameKey(sibling.name) === key)) {
      throw fail(
        HttpStatus.CONFLICT,
        'project_name_taken',
        `Ya hay un proyecto llamado «${input.name}» en esta organización`,
      );
    }
    const slug = projectSlug(input.name);
    const taken = await this.prisma.project.findMany({
      where: { id: { startsWith: slug } },
      select: { id: true },
    });
    const id = freeProjectId(
      slug,
      taken.map((row) => row.id),
    );
    return this.prisma.project.create({
      data: {
        id,
        organizationId: input.organizationId,
        name: input.name,
        location: input.location,
        description: input.description,
        authorId: account.id,
        costOwnerId: account.id,
        scheduleOwnerId: account.id,
        modelDocumentId: null,
        longitudinalAxes: [],
        transversalAxes: [],
        members: {
          create: [
            {
              id: account.id,
              position: 0,
              name: account.name ?? account.email,
              role: CREATOR_ROLE,
              channel: 'email',
              handle: account.email,
            },
          ],
        },
      },
      select: PROJECT_SUMMARY,
    });
  }

  async requireProject(account: Account, projectId: string): Promise<void> {
    await this.project(account, projectId);
  }

  async members(organizationId: string) {
    const [memberships, invitations] = await Promise.all([
      this.prisma.membership.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId, acceptedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      members: memberships.map((item) => ({
        userId: item.userId,
        email: item.user.email,
        name: item.user.name,
        role: item.role,
      })),
      invitations: invitations.map((item) => ({
        id: item.id,
        email: item.email,
        role: item.role,
        createdAt: item.createdAt,
      })),
    };
  }

  async invite(organizationId: string, email: string, role: Role) {
    const normalized = email.trim().toLowerCase();
    const member = await this.prisma.membership.findFirst({
      where: { organizationId, user: { email: normalized } },
    });
    if (member) {
      throw fail(
        HttpStatus.CONFLICT,
        'already_member',
        `${normalized} ya es parte de la organización`,
      );
    }
    const invitation = await this.prisma.invitation.upsert({
      where: { organizationId_email: { organizationId, email: normalized } },
      create: { organizationId, email: normalized, role },
      update: { role, acceptedAt: null },
    });
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
    };
  }

  private requireIdentity(): Identity {
    if (!this.identity) {
      throw fail(
        HttpStatus.SERVICE_UNAVAILABLE,
        'auth_not_configured',
        'Faltan AUTH0_DOMAIN y AUTH0_AUDIENCE',
      );
    }
    return this.identity;
  }

  private unauthorized(error: unknown) {
    return fail(
      HttpStatus.UNAUTHORIZED,
      'invalid_token',
      error instanceof InvalidTokenError
        ? `Tu sesión no es válida: ${error.message}`
        : 'Tu sesión no es válida',
    );
  }

  private async register(identity: Identity, token: string, subject: string) {
    let profile;
    try {
      profile = await identity.profile(token);
    } catch (error) {
      throw this.unauthorized(error);
    }
    if (!profile.emailVerified) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'email_not_verified',
        'Confirma tu correo antes de entrar',
      );
    }
    return this.prisma.user.upsert({
      where: { authSubject: subject },
      create: {
        authSubject: subject,
        email: profile.email,
        name: profile.name,
      },
      update: {},
    });
  }

  private async acceptInvitations(userId: string, email: string) {
    const pending = await this.prisma.invitation.findMany({
      where: { email, acceptedAt: null },
    });
    if (pending.length === 0) return;
    const now = new Date();
    await this.prisma.$transaction([
      ...pending.map((invitation) =>
        this.prisma.membership.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId,
            },
          },
          create: {
            organizationId: invitation.organizationId,
            userId,
            role: invitation.role,
          },
          update: { role: invitation.role },
        }),
      ),
      this.prisma.invitation.updateMany({
        where: { id: { in: pending.map((invitation) => invitation.id) } },
        data: { acceptedAt: now },
      }),
    ]);
  }

  private async account(userId: string): Promise<Account> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.flatMap((item) =>
        isRole(item.role)
          ? [
              {
                organizationId: item.organizationId,
                organizationName: item.organization.name,
                role: item.role,
              },
            ]
          : [],
      ),
    };
  }
}
