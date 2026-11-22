import type { Prisma, PrismaClient } from '@team27/data-main';

import type {
  ConnectionRepository,
  StoredConnection,
} from '../../application/ports/index.ts';
import type {
  Connection,
  ConnectionGrant,
  Provider,
} from '../../domain/Connection.ts';
import type { TokenCipher } from './TokenCipher.ts';

type ConnectionRow = Prisma.IntegrationConnectionGetPayload<object>;

const toConnection = (row: ConnectionRow): Connection => ({
  id: row.id,
  userId: row.userId,
  provider: row.provider as Provider,
  accountEmail: row.accountEmail,
  scopes: row.scopes,
  connectedAt: row.connectedAt,
});

export class PrismaConnectionRepository implements ConnectionRepository {
  private readonly prisma: PrismaClient;
  private readonly cipher: TokenCipher;

  constructor(prisma: PrismaClient, cipher: TokenCipher) {
    this.prisma = prisma;
    this.cipher = cipher;
  }

  async findForUser(
    userId: string,
    provider: Provider,
  ): Promise<StoredConnection | null> {
    const row = await this.prisma.integrationConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    return row === null ? null : this.stored(row);
  }

  async find(id: string): Promise<StoredConnection | null> {
    const row = await this.prisma.integrationConnection.findUnique({
      where: { id },
    });
    return row === null ? null : this.stored(row);
  }

  async save(grant: ConnectionGrant): Promise<Connection> {
    const data = {
      accountEmail: grant.accountEmail,
      scopes: [...grant.scopes],
      refreshTokenSealed: this.cipher.encrypt(grant.refreshToken),
      connectedAt: new Date(),
    };
    const row = await this.prisma.integrationConnection.upsert({
      where: {
        userId_provider: { userId: grant.userId, provider: grant.provider },
      },
      create: { userId: grant.userId, provider: grant.provider, ...data },
      update: data,
    });
    return toConnection(row);
  }

  async remove(userId: string, provider: Provider): Promise<boolean> {
    const removed = await this.prisma.integrationConnection.deleteMany({
      where: { userId, provider },
    });
    return removed.count > 0;
  }

  private stored(row: ConnectionRow): StoredConnection {
    return {
      ...toConnection(row),
      refreshToken: this.cipher.decrypt(row.refreshTokenSealed),
    };
  }
}
