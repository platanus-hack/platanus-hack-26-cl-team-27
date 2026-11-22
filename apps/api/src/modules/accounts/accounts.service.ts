import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@team27/data-main';

import { fail } from '../coordination/http-errors.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { type Identity, InvalidTokenError } from './identity.ts';

export const IDENTITY = 'IDENTITY';

export const SUPERADMINS = 'SUPERADMINS';

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
  readonly superadmin: boolean;
  readonly memberships: readonly AccountMembership[];
}

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);

@Injectable()
export class AccountsService {
  private readonly prisma: PrismaClient;
  private readonly identity: Identity | null;
  private readonly superadmins: ReadonlySet<string>;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(IDENTITY) identity: Identity | null,
    @Inject(SUPERADMINS) superadmins: readonly string[] = [],
  ) {
    this.prisma = prisma;
    this.identity = identity;
    this.superadmins = new Set(
      superadmins.map((email) => email.trim().toLowerCase()),
    );
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

  requireSuperadmin(account: Account): void {
    if (!account.superadmin) {
      throw fail(
        HttpStatus.FORBIDDEN,
        'superadmin_required',
        'Solo un superadmin de Vigente puede hacerlo',
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
      select: {
        id: true,
        organizationId: true,
        name: true,
        location: true,
        description: true,
      },
    });
    return rows;
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
      superadmin: this.superadmins.has(user.email.toLowerCase()),
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
