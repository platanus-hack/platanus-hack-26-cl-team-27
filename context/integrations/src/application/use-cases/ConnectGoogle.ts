import type { Connection } from '../../domain/Connection.ts';
import type {
  AccountAuthorizer,
  ConnectionRepository,
} from '../ports/index.ts';

export class ConnectGoogle {
  private readonly authorizer: AccountAuthorizer;
  private readonly connections: ConnectionRepository;

  constructor(
    authorizer: AccountAuthorizer,
    connections: ConnectionRepository,
  ) {
    this.authorizer = authorizer;
    this.connections = connections;
  }

  authorizationUrl(state: string): string {
    return this.authorizer.authorizationUrl(state);
  }

  async execute(userId: string, code: string): Promise<Connection> {
    const grant = await this.authorizer.exchange(code);
    return this.connections.save({ userId, provider: 'google', ...grant });
  }
}
