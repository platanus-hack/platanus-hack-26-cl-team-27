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

  async find(provider: Provider): Promise<StoredConnection | null> {
    const row = await this.prisma.integrationConnection.findUnique({
      where: { provider },
    });
    if (row === null) return null;
    return {
      ...toConnection(row),
      refreshToken: this.cipher.decrypt(row.refreshTokenSealed),
    };
  }

  async save(grant: ConnectionGrant): Promise<Connection> {
    const data = {
      accountEmail: grant.accountEmail,
      scopes: [...grant.scopes],
      refreshTokenSealed: this.cipher.encrypt(grant.refreshToken),
      connectedAt: new Date(),
    };
    const row = await this.prisma.integrationConnection.upsert({
      where: { provider: grant.provider },
      create: { provider: grant.provider, ...data },
      update: data,
    });
    return toConnection(row);
  }

  async remove(provider: Provider): Promise<boolean> {
    const removed = await this.prisma.integrationConnection.deleteMany({
      where: { provider },
    });
    return removed.count > 0;
  }
}
