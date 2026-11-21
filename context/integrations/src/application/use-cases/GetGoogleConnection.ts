import type { Connection } from '../../domain/Connection.ts';
import type { ConnectionRepository, StoredConnection } from '../ports/index.ts';

const publicConnection = (connection: StoredConnection): Connection => ({
  id: connection.id,
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

  async execute(): Promise<Connection | null> {
    const connection = await this.connections.find('google');
    return connection === null ? null : publicConnection(connection);
  }
}
