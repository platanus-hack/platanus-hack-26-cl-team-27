import type { ConnectionRepository } from '../ports/index.ts';

export class DisconnectGoogle {
  private readonly connections: ConnectionRepository;

  constructor(connections: ConnectionRepository) {
    this.connections = connections;
  }

  execute(): Promise<boolean> {
    return this.connections.remove('google');
  }
}
