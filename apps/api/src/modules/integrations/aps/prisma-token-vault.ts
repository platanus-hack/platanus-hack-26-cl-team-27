import type { PrismaClient } from '@team27/data-main';

import { InvalidCiphertextError, type TokenCipher } from './token-cipher.ts';
import {
  type ApsTokens,
  CONNECTION_STATUSES,
  type ConnectionStatus,
  type NewConnection,
  type StoredConnection,
  type TokenVault,
} from './token-vault.ts';

type ConnectionRow = NonNullable<
  Awaited<ReturnType<PrismaClient['apsConnection']['findUnique']>>
>;

const isStatus = (value: string): value is ConnectionStatus =>
  (CONNECTION_STATUSES as readonly string[]).includes(value);

const accessContext = (organizationId: string) =>
  `aps:${organizationId}:access_token`;

const refreshContext = (organizationId: string) =>
  `aps:${organizationId}:refresh_token`;

export class PrismaTokenVault implements TokenVault {
  private readonly prisma: Pick<PrismaClient, 'apsConnection'>;
  private readonly cipher: TokenCipher;

  constructor(
    prisma: Pick<PrismaClient, 'apsConnection'>,
    cipher: TokenCipher,
  ) {
    this.prisma = prisma;
    this.cipher = cipher;
  }

  async find(organizationId: string): Promise<StoredConnection | null> {
    const row = await this.prisma.apsConnection.findUnique({
      where: { organizationId },
    });
    return row ? this.toConnection(row) : null;
  }

  async save(connection: NewConnection): Promise<void> {
    const { organizationId } = connection;
    const data = {
      connectedById: connection.connectedById,
      autodeskUserId: connection.autodeskUser.id,
      autodeskEmail: connection.autodeskUser.email,
      autodeskName: connection.autodeskUser.name,
      scopes: connection.scopes.join(' '),
      ...this.encrypted(organizationId, connection.tokens),
      refreshedAt: connection.refreshedAt,
      status: 'active',
    };
    await this.prisma.apsConnection.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  async storeTokens(
    organizationId: string,
    tokens: ApsTokens,
    refreshedAt: Date,
  ): Promise<void> {
    await this.prisma.apsConnection.update({
      where: { organizationId },
      data: {
        ...this.encrypted(organizationId, tokens),
        refreshedAt,
        status: 'active',
      },
    });
  }

  async markReconnectRequired(organizationId: string): Promise<void> {
    await this.prisma.apsConnection.updateMany({
      where: { organizationId },
      data: { status: 'reconnect_required' },
    });
  }

  async remove(organizationId: string): Promise<void> {
    await this.prisma.apsConnection.deleteMany({ where: { organizationId } });
  }

  async activeRefreshedBefore(date: Date): Promise<readonly string[]> {
    const rows = await this.prisma.apsConnection.findMany({
      where: { status: 'active', refreshedAt: { lt: date } },
      select: { organizationId: true },
    });
    return rows.map((row) => row.organizationId);
  }

  private encrypted(organizationId: string, tokens: ApsTokens) {
    return {
      accessTokenCiphertext: this.cipher.encrypt(
        tokens.accessToken,
        accessContext(organizationId),
      ),
      refreshTokenCiphertext: this.cipher.encrypt(
        tokens.refreshToken,
        refreshContext(organizationId),
      ),
      expiresAt: tokens.expiresAt,
    };
  }

  private toConnection(row: ConnectionRow): StoredConnection {
    const tokens = this.decrypted(row);
    return {
      organizationId: row.organizationId,
      connectedById: row.connectedById,
      autodeskUser: {
        id: row.autodeskUserId,
        email: row.autodeskEmail,
        name: row.autodeskName,
      },
      scopes: row.scopes.split(' ').filter(Boolean),
      tokens,
      refreshedAt: row.refreshedAt,
      status:
        tokens && isStatus(row.status) ? row.status : 'reconnect_required',
      createdAt: row.createdAt,
    };
  }

  private decrypted(row: ConnectionRow): ApsTokens | null {
    try {
      return {
        accessToken: this.cipher.decrypt(
          row.accessTokenCiphertext,
          accessContext(row.organizationId),
        ),
        refreshToken: this.cipher.decrypt(
          row.refreshTokenCiphertext,
          refreshContext(row.organizationId),
        ),
        expiresAt: row.expiresAt,
      };
    } catch (error) {
      if (error instanceof InvalidCiphertextError) return null;
      throw error;
    }
  }
}
