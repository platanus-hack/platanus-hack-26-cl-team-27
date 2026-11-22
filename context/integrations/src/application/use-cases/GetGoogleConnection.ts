import type { Connection } from '../../domain/Connection.ts';
import type { ConnectionRepository, StoredConnection } from '../ports/index.ts';

const publicConnection = (connection: StoredConnection): Connection => ({
  id: connection.id,
  userId: connection.userId,
  provider: connection.provider,
  accountEmail: connection.accountEmail,
  scopes: connection.scopes,
  connectedAt: connection.connectedAt,
});

export class GetGoogleConnection {
  private readonly connections: ConnectionRepository;

  constructor(connections: ConnectionRepository) {
    this.connections = connections;
  }

  async execute(userId: string): Promise<Connection | null> {
    const connection = await this.connections.findForUser(userId, 'google');
    return connection === null ? null : publicConnection(connection);
  }
}
